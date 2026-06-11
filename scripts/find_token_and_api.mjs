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

// Strategy: Find the OAuth token from the page's JavaScript runtime
// and use it to call the Firebase Management API directly

console.log('Looking for access token...');

const token = await authPage.evaluate(async () => {
  // Method 1: Check for OAuth token in various places
  const results = {};
  
  // Check window properties
  for (const key of Object.keys(window)) {
    if (key.toLowerCase().includes('token') || key.toLowerCase().includes('oauth') || key.toLowerCase().includes('credential') || key.toLowerCase().includes('auth')) {
      results[key] = typeof window[key];
    }
  }
  
  // Method 2: Look for google-oauth iframe
  const iframes = document.querySelectorAll('iframe[src*="oauth"], iframe[src*="accounts.google"]');
  results.oauthIframes = iframes.length;
  
  // Method 3: Look for the Firebase Auth instance
  try {
    // The Firebase console uses firebase/auth internally
    if (typeof firebase !== 'undefined') {
      results.hasFirebase = true;
    }
  } catch(e) {}
  
  // Method 4: Search for Google auth in indexedDB
  try {
    const dbs = await indexedDB.databases?.();
    results.indexedDBs = dbs?.map(d => d.name);
  } catch(e) {}
  
  // Method 5: Try to find token in the oauth iframe
  try {
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          results.iframeContent = iframeDoc.body?.innerText?.substring(0, 200);
          // Check for token
          const scripts = iframeDoc.querySelectorAll('script');
          for (const s of scripts) {
            if (s.text.includes('access_token') || s.text.includes('ya29.')) {
              results.foundTokenInIframe = true;
              results.tokenSnippet = s.text.substring(0, 200);
            }
          }
        }
      } catch(e) {
        results.iframeError = e.message;
      }
    }
  } catch(e) {}
  
  // Method 6: Use google.accounts.oauth2
  try {
    if (typeof google !== 'undefined' && google?.accounts?.oauth2) {
      results.hasGoogleOAuth2 = true;
      results.gisVersion = google.accounts.oauth2.version;
    }
  } catch(e) {}
  
  // Method 7: Intercept the gapi client
  try {
    if (typeof gapi !== 'undefined' && gapi?.client) {
      results.hasGapiClient = true;
    }
  } catch(e) {}
  
  // Method 8: Get cookies for auth
  const cookies = document.cookie.split(';').map(c => c.trim());
  const authCookies = cookies.filter(c => 
    c.startsWith('__Secure-') || c.startsWith('SAPISID') || c.startsWith('APISID')
  );
  results.authCookies = authCookies;
  
  return results;
});

console.log('Token search:', JSON.stringify(token, null, 2));

// Now, try using the Firebase Auth REST API with the page's session
// The Firebase console's internal API uses a specific token pattern
console.log('\nAttempting API call with session cookies...');

const apiResult = await authPage.evaluate(async () => {
  const results = {};
  
  try {
    // Try the Identity Toolkit API with credentials: 'include'
    const resp = await fetch(
      'https://identitytoolkit.googleapis.com/v2/projects/hermes-idleviber/defaultSupportedIdpConfigs/google.com', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Goog-User-Project': 'hermes-idleviber'
        },
        body: JSON.stringify({
          enabled: true
        })
      }
    );
    results.status = resp.status;
    results.body = (await resp.text()).substring(0, 500);
  } catch(e) {
    results.error = e.message;
  }
  
  // Also try without PATCH (GET it first)
  try {
    const resp2 = await fetch(
      'https://identitytoolkit.googleapis.com/v2/projects/hermes-idleviber/defaultSupportedIdpConfigs', {
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );
    results.getStatus = resp2.status;
    results.getBody = (await resp2.text()).substring(0, 500);
  } catch(e) {
    results.getError = e.message;
  }
  
  return results;
});

console.log('\nAPI result:', JSON.stringify(apiResult, null, 2));

await browser.disconnect();
process.exit(0);
