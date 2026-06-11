import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserURL: 'http://127.0.0.1:9222',
});

const pages = await browser.pages();

let authPage = null;
for (const p of pages) {
  if (p.url().includes('authentication/providers')) {
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

// Find the auth token used by the Firebase console
const authInfo = await authPage.evaluate(() => {
  const results = {};
  
  // Check for window.gapi
  results.hasGapi = typeof gapi !== 'undefined';
  results.hasGapiAuth = typeof gapi?.auth !== 'undefined';
  results.hasGapiClient = typeof gapi?.client !== 'undefined';
  
  // Check for google.accounts.oauth2
  results.hasGoogleAccounts = typeof google?.accounts?.oauth2 !== 'undefined';
  
  // Check for __googleToken
  results.googleToken = typeof window.__googleToken;
  
  // Look for token in various places
  const possibleTokens = [
    'window.__googleToken',
    'window.gapi.auth2',
    'localStorage'
  ];
  
  // Check localStorage for tokens
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('token') || key.includes('oauth') || key.includes('credential') || key.includes('session'))) {
      keys.push(key);
    }
  }
  results.localStorageKeys = keys;
  
  // Try to get gapi auth instance
  if (gapi?.auth2) {
    try {
      results.auth2 = gapi.auth2.getAuthInstance();
      results.auth2SignedIn = results.auth2?.isSignedIn?.get();
    } catch(e) {
      results.auth2Error = e.message;
    }
  }
  
  return results;
});
console.log('Auth info:', JSON.stringify(authInfo, null, 2));

// Look for GAPI auth token
const tokenResult = await authPage.evaluate(async () => {
  const results = {};
  
  // Try to get GAPI token
  if (gapi?.auth2) {
    try {
      const instance = gapi.auth2.getAuthInstance();
      if (instance) {
        const user = instance.currentUser.get();
        const token = user?.getAuthResponse?.();
        results.gapiToken = token ? {
          access_token: token.access_token?.substring(0, 20) + '...',
          expires_at: token.expires_at,
          scope: token.scope
        } : 'no token';
      }
    } catch(e) {
      results.gapiError = e.message;
    }
  }
  
  // Try to get IT (Google Identity Services) token
  if (google?.accounts?.oauth2) {
    try {
      results.gisAvailable = true;
    } catch(e) {}
  }
  
  // Try getting from URL hash
  results.hash = window.location.hash?.substring(0, 50);
  
  // Try looking at session cookies
  results.cookies = document.cookie?.substring(0, 100);
  
  // Try the fetch with credentials
  try {
    const resp = await fetch(
      'https://identitytoolkit.googleapis.com/v2/projects/hermes-idleviber/defaultSupportedIdpConfigs',
      { credentials: 'include' }
    );
    results.apiStatus = resp.status;
    const text = await resp.text();
    results.apiBody = text.substring(0, 300);
  } catch(e) {
    results.apiError = e.message;
  }
  
  return results;
});
console.log('\nToken result:', JSON.stringify(tokenResult, null, 2));

await browser.disconnect();
process.exit(0);
