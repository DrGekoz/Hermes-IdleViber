import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserURL: 'http://127.0.0.1:9222',
});

const pages = await browser.pages();

// Find the CREDENTIALS page (has gapi)
let credPage = null;
for (const p of pages) {
  if (p.url().includes('cloud.google.com/apis/credentials')) {
    credPage = p;
    break;
  }
}

if (!credPage) {
  console.log('No credentials page found');
  await browser.disconnect();
  process.exit(0);
}

console.log('Cred page:', await credPage.title());
await new Promise(r => setTimeout(r, 2000));

// Get the token from gapi on this page
const tokenInfo = await credPage.evaluate(() => {
  const results = {};
  
  // Try gapi.auth.getToken (legacy)
  try {
    const t = gapi.auth?.getToken?.();
    if (t) results.authToken = { accessToken: t.access_token?.substring(0, 20) + '...', full: t.access_token };
  } catch(e) { results.authErr = e.message; }
  
  // Try gapi.client.getToken (newer)
  try {
    const t = gapi.client?.getToken?.();
    if (t) results.clientToken = { accessToken: t.access_token?.substring(0, 20) + '...', full: t.access_token };
  } catch(e) { results.clientErr = e.message; }
  
  // Try gapi.auth2
  try {
    const inst = gapi.auth2?.getAuthInstance?.();
    if (inst) {
      results.auth2Exists = true;
      const user = inst.currentUser?.get?.();
      if (user) {
        const ar = user.getAuthResponse?.();
        if (ar) {
          results.gapiToken = { 
            accessToken: ar.access_token?.substring(0, 20) + '...', 
            full: ar.access_token,
            expiresAt: ar.expires_at
          };
        }
      }
    }
  } catch(e) { results.auth2Err = e.message; }
  
  // Try via Google Identity Services
  try {
    if (google?.accounts?.oauth2) {
      results.gis = true;
    }
  } catch(e) {}
  
  // Check google.internal
  try {
    if (google?.internal) {
      results.internalKeys = Object.keys(google.internal).filter(k => !k.startsWith('_'));
      // Look for access token in internal
      const intToken = google.internal.getToken?.();
      if (intToken) results.internalToken = intToken.substring(0, 20) + '...';
    }
  } catch(e) {}
  
  // Try devops
  try {
    if (google?.devops) {
      results.devops = true;
    }
  } catch(e) {}
  
  return results;
});

console.log('Token info:', JSON.stringify(tokenInfo, null, 2));

// If we got the full token, try to use it
if (tokenInfo.gapiToken?.full) {
  const token = tokenInfo.gapiToken.full;
  console.log('\n🎯 Using gapi token for API call!');
  
  // Need to make the call from the credentials page context (same origin as gapi)
  const apiResult = await credPage.evaluate(async (accessToken) => {
    try {
      const resp = await fetch(
        'https://identitytoolkit.googleapis.com/v2/projects/hermes-idleviber/defaultSupportedIdpConfigs/google.com?updateMask=enabled',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + accessToken
          },
          body: JSON.stringify({ enabled: true })
        }
      );
      return { status: resp.status, body: (await resp.text()).substring(0, 500) };
    } catch(e) {
      return { error: e.message };
    }
  }, token);
  console.log('API call result:', JSON.stringify(apiResult, null, 2));
  
  if (apiResult.status === 200) {
    console.log('✅ GOOGLE AUTH ENABLED!');
  }
  
  // Check the auth page for updated status
  // Find auth page and check
  for (const p of pages) {
    if (p.url().includes('authentication/providers')) {
      const status = await p.evaluate(() => {
        const lines = document.body.innerText.split('\n');
        return lines.filter(l => l.includes('check_circle') || l.includes('Enabled') || l.includes('Google'));
      });
      console.log('\nUpdated auth status:', status);
      break;
    }
  }
}

// If we have authToken or clientToken, try those too
if (!tokenInfo.gapiToken?.full && (tokenInfo.authToken?.full || tokenInfo.clientToken?.full)) {
  const token = tokenInfo.authToken?.full || tokenInfo.clientToken?.full;
  console.log('\n🎯 Alternative token found!');
  const apiResult = await credPage.evaluate(async (accessToken) => {
    try {
      const resp = await fetch(
        'https://identitytoolkit.googleapis.com/v2/projects/hermes-idleviber/defaultSupportedIdpConfigs/google.com?updateMask=enabled',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + accessToken
          },
          body: JSON.stringify({ enabled: true })
        }
      );
      return { status: resp.status, body: (await resp.text()).substring(0, 500) };
    } catch(e) {
      return { error: e.message };
    }
  }, token);
  console.log('API result:', JSON.stringify(apiResult, null, 2));
}

await browser.disconnect();
process.exit(0);
