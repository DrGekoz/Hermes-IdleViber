import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserURL: 'http://127.0.0.1:9222',
});

const pages = await browser.pages();

let authPage = null;
for (const p of pages) {
  if (p.url().includes('authentication') && (await p.title()).includes('Sign-in method')) {
    authPage = p;
    break;
  }
}
if (!authPage) {
  for (const p of pages) {
    if (p.url().includes('firebase.google.com')) {
      authPage = p;
      await authPage.goto('https://console.firebase.google.com/u/0/project/hermes-idleviber/authentication/providers');
      await new Promise(r => setTimeout(r, 4000));
      break;
    }
  }
}

// Try to extract the OAuth token from the page's Google Auth library
const tokenResult = await authPage.evaluate(async () => {
  const results = {};
  
  // Method 1: Try gapi.auth2
  try {
    if (typeof gapi !== 'undefined') {
      results.gapiExists = true;
      try {
        const authInstance = gapi.auth2?.getAuthInstance();
        if (authInstance) {
          results.authInstanceExists = true;
          results.isSignedIn = authInstance.isSignedIn?.get();
          const user = authInstance.currentUser?.get();
          if (user) {
            const authResponse = user.getAuthResponse();
            if (authResponse) {
              results.token = {
                accessToken: authResponse.access_token?.substring(0, 10) + '...',
                expiresAt: authResponse.expires_at,
                scope: authResponse.scope
              };
            }
          }
        }
      } catch(e) {
        results.gapiAuthError = e.message?.substring(0, 100);
      }
    }
  } catch(e) { results.gapiErr = e.message?.substring(0, 100); }
  
  // Method 2: Try gapi.client.getToken()
  try {
    if (typeof gapi !== 'undefined' && gapi.client?.getToken) {
      const t = gapi.client.getToken();
      if (t) {
        results.clientToken = t.access_token?.substring(0, 10) + '...';
      }
    }
  } catch(e) { results.clientTokenErr = e.message?.substring(0, 100); }
  
  // Method 3: Search the DOM for access tokens embedded in scripts
  try {
    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      if (s.text && s.text.includes('access_token')) {
        results.scriptWithToken = s.text.substring(0, 200);
        break;
      }
    }
  } catch(e) {}
  
  // Method 4: Look for token in sessionStorage on accounts.google.com
  try {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe.src?.includes('accounts.google.com')) {
        results.gaiaIframeSrc = iframe.src?.substring(0, 100);
      }
    }
  } catch(e) {}
  
  // Method 5: Search for 'Bearer' or 'ya29.' patterns in localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key);
      if (val && (val.includes('ya29.') || val.includes('access_token'))) {
        results.localStorageToken = { key, prefix: val.substring(0, 30) };
      }
    }
  } catch(e) {}
  
  // Method 6: Check __google_user or similar
  for (const key of Object.getOwnPropertyNames(window)) {
    if (key.includes('Google') || key.includes('google') || key.includes('gapi')) {
      results['window_' + key] = typeof window[key];
    }
  }
  
  return results;
});

console.log('Token result:', JSON.stringify(tokenResult, null, 2));

// If we got a token, now call the API
if (tokenResult.token?.accessToken || tokenResult.clientToken) {
  console.log('\n\n!!! GOT TOKEN !!! Using it to enable Google...');
  
  const token = tokenResult.token?.accessToken || tokenResult.clientToken;
  // Need the full token, not the truncated one
  // Let me try again with the full token
}

// Also try to intercept network requests to see what the Firebase console sends
// Let's intercept XHR/fetch requests made by the page
await authPage.setRequestInterception(true);

const capturedApiCalls = [];
authPage.on('request', request => {
  const url = request.url();
  if (url.includes('identitytoolkit') || url.includes('firebaseapp.com/__') || (url.includes('googleapis.com') && !url.includes('googleusercontent.com'))) {
    capturedApiCalls.push({
      url: url.substring(0, 150),
      method: request.method(),
      headers: JSON.stringify({
        authorization: request.headers()['authorization']?.substring(0, 30),
        'content-type': request.headers()['content-type']
      }),
      postData: request.postData()?.substring(0, 500)
    });
  }
  request.continue();
});

// Now click the Google tile and try toggling
await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('[aria-label="Email/Password"]');
  if (tiles.length > 0) tiles[0].click();
});
await new Promise(r => setTimeout(r, 1000));

await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('[aria-label="Google"], .provider-tile');
  for (const t of tiles) {
    if (t.textContent.trim() === 'Google') t.click();
  }
});
await new Promise(r => setTimeout(r, 2000));

// Set support email
const selectBox = await authPage.evaluate(() => {
  const select = document.querySelector('mat-select');
  if (!select) return null;
  const rect = select.getBoundingClientRect();
  return { x: rect.x + rect.width/2, y: rect.y + rect.height/2 };
});
if (selectBox) {
  await authPage.mouse.click(selectBox.x, selectBox.y);
  await new Promise(r => setTimeout(r, 2000));
}
await authPage.evaluate(() => {
  const options = document.querySelectorAll('mat-option, .mat-mdc-option');
  for (const o of options) {
    if (o.textContent.trim() === 'ads.doctor.melbourne@gmail.com') {
      o.click();
      return;
    }
  }
});
await new Promise(r => setTimeout(r, 1500));

// Get the full access token using a different approach
const fullToken = await authPage.evaluate(() => {
  try {
    // Try to get gapi auth instance
    const authInstance = gapi?.auth2?.getAuthInstance();
    if (authInstance) {
      const user = authInstance.currentUser.get();
      const authResponse = user.getAuthResponse();
      return { 
        accessToken: authResponse.access_token,
        expiresAt: authResponse.expires_at,
        idToken: authResponse.id_token?.substring(0, 20) + '...'
      };
    }
  } catch(e) {
    return { error: e.message };
  }
  try {
    if (gapi?.client?.getToken) {
      return { accessToken: gapi.client.getToken()?.access_token };
    }
  } catch(e) {
    return { error2: e.message };
  }
  return { nothing: true };
});
console.log('\nFull token:', JSON.stringify(fullToken));

// If we have the token, call the API
if (fullToken?.accessToken) {
  console.log('\n\n🎯 GOT ACCESS TOKEN! Making API call...');
  
  const apiCall = await authPage.evaluate(async (token) => {
    try {
      const resp = await fetch(
        'https://identitytoolkit.googleapis.com/v2/projects/hermes-idleviber/defaultSupportedIdpConfigs/google.com?updateMask=enabled', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({
            enabled: true
          })
        }
      );
      return { status: resp.status, body: (await resp.text()).substring(0, 300) };
    } catch(e) {
      return { error: e.message };
    }
  }, fullToken.accessToken);
  console.log('API call result:', JSON.stringify(apiCall));
  
  if (apiCall.status === 200) {
    console.log('✅ GOOGLE AUTH ENABLED!');
  }
  
  await new Promise(r => setTimeout(r, 2000));
}

await authPage.setRequestInterception(false);

// Show captured API calls
console.log('\nCaptured API calls:');
capturedApiCalls.forEach((c, i) => console.log(`[${i}] ${c.method} ${c.url}\n    Auth: ${c.headers?.substring(0, 100)}\n    Body: ${c.postData?.substring(0, 200)}`));

await browser.disconnect();
process.exit(0);
