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

// Try to find the Google OAuth token via Google Identity Services
const tokenResults = await authPage.evaluate(() => {
  const results = {};
  
  // Look at google object
  if (typeof google !== 'undefined') {
    results.googleKeys = Object.keys(google);
    
    if (google?.accounts?.oauth2) {
      results.hasOAuth2 = true;
      try {
        // Try to get an existing token
        const tokenResponse = google.accounts.oauth2.hasGrantedAllScopes?.();
        results.hasGrantedScopes = tokenResponse;
      } catch(e) { results.oauth2Error = e.message; }
    }
    
    if (google?.accounts?.id) {
      results.hasGoogleID = true;
    }
  }
  
  // Look for Firebase auth instances
  if (typeof firebase !== 'undefined') {
    results.hasFirebase = true;
    for (const key of Object.keys(firebase)) {
      if (key.includes('auth') || key.includes('Auth')) {
        results['firebase_' + key] = typeof firebase[key];
      }
    }
    
    // Try firebase.auth()
    try {
      const auth = firebase.auth();
      if (auth) {
        results.firebaseAuthExists = true;
        results.currentUser = auth.currentUser ? 'exists' : 'null';
      }
    } catch(e) { results.firebaseAuthError = e.message; }
  }
  
  // Look for the Firebase token from the console
  // The Firebase console uses a custom auth system
  // Check __fbToken or similar
  for (const key of Object.keys(window)) {
    if (key.startsWith('__') && (key.includes('fb') || key.includes('FB') || key.includes('gt') || key.includes('token') || key.includes('auth'))) {
      results[key] = typeof window[key];
    }
  }
  
  // Check for firebase token in app check / installations
  try {
    results.localStorageKeys_firebase = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('firebase')) {
        results.localStorageKeys_firebase.push(k);
        const val = localStorage.getItem(k);
        if (val && (val.includes('token') || val.includes('ya29') || val.length > 50)) {
          results['firebase_ls_' + k] = val.substring(0, 60);
        }
      }
    }
  } catch(e) {}
  
  // Check sessionStorage too
  try {
    results.sessionStorageKeys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k) results.sessionStorageKeys.push(k);
    }
  } catch(e) {}
  
  // Check for stsTokenManager (Firebase Auth stores tokens here)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const val = localStorage.getItem(k);
      if (val && val.includes('stsTokenManager')) {
        try {
          const parsed = JSON.parse(val);
          results.stsToken = {
            accessToken: parsed.stsTokenManager?.accessToken?.substring(0, 15) + '...',
            refreshToken: parsed.stsTokenManager?.refreshToken?.substring(0, 15) + '...',
          };
        } catch(e) {
          results.stsTokenRaw = val.substring(0, 100);
        }
      }
    }
  } catch(e) {}
  
  return results;
});

console.log('Token search:', JSON.stringify(tokenResults, null, 2));

// The Firebase console uses the Google Cloud Console's auth
// Let me try another approach - look at the credential page
// to find what auth mechanism is being used
console.log('\n--- Checking credential pages for auth info ---');

// Get auth info from the credentials page
let credPage = null;
for (const p of pages) {
  if (p.url().includes('cloud.google.com/apis/credentials')) {
    credPage = p;
    break;
  }
}

if (credPage) {
  const credAuth = await credPage.evaluate(() => {
    const results = {};
    
    if (typeof gapi !== 'undefined') {
      results.credGapiExists = true;
      try {
        results.credGapiToken = gapi.auth?.getToken?.() || gapi.client?.getToken?.();
      } catch(e) { results.credGapiErr = e.message; }
    }
    
    if (typeof google !== 'undefined') {
      results.credGoogleKeys = Object.keys(google);
      try {
        if (google?.accounts?.oauth2) {
          results.credHasOAuth2 = true;
        }
      } catch(e) {}
    }
    
    return results;
  });
  console.log('Cred page auth:', JSON.stringify(credAuth, null, 2));
}

await browser.disconnect();
process.exit(0);
