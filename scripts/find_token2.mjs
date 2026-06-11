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

console.log('PAGE:', await authPage?.title());

// Search for auth tokens
const tokens = await authPage.evaluate(() => {
  const found = {};
  
  // Check Google Identity Services token store
  try {
    const tokens = document.cookie;
    found.cookies = tokens.substring(0, 200);
  } catch(e) { found.cookieErr = e.message; }
  
  // Check sessionStorage for tokens
  try {
    const sessionKeys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k) sessionKeys.push(k);
    }
    found.sessionKeys = sessionKeys;
    
    // Look for access token in sessionStorage
    for (const k of sessionKeys) {
      const val = sessionStorage.getItem(k);
      if (val && (val.includes('access_token') || val.includes('ya29.'))) {
        found.foundTokenIn = k;
        found.tokenPrefix = val.substring(0, 30);
      }
    }
  } catch(e) { found.sessionErr = e.message; }
  
  // Check localStorage  
  try {
    const localKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) localKeys.push(k);
    }
    found.localKeys = localKeys;
    
    for (const k of localKeys) {
      const val = localStorage.getItem(k);
      if (val && (val.includes('access_token') || val.includes('ya29.'))) {
        found.foundTokenInLocal = k;
        found.localTokenPrefix = val.substring(0, 30);
      }
    }
  } catch(e) { found.localErr = e.message; }
  
  // Try to find Google OAuth iframe
  const iframes = document.querySelectorAll('iframe');
  found.iframeCount = iframes.length;
  found.iframeSrcs = Array.from(iframes).slice(0, 5).map(f => f.src.substring(0, 80));
  
  // Check for indexDB / Google auth DB
  found.hasIndexedDB = typeof indexedDB !== 'undefined';
  
  return found;
});
console.log('Search result:', JSON.stringify(tokens, null, 2));

// Try to make authenticated API call via fetch
const apiTest = await authPage.evaluate(async () => {
  const results = {};
  
  try {
    // Try to get access token via Google Auth library
    // Check if window has Google Identity Services library
    if (typeof google !== 'undefined' && google?.accounts?.oauth2) {
      results.hasGIS = true;
      results.gisToken = typeof google.accounts.oauth2.getToken;
    } else {
      results.hasGIS = false;
    }
  } catch(e) { results.gisErr = e.message; }
  
  // Try to find token in the Google OAuth iframe content
  try {
    const iframes = document.querySelectorAll('iframe[src*="accounts.google"]');
    results.oauthIframes = iframes.length;
  } catch(e) {}
  
  // API call with credentials: 'include'
  try {
    const resp = await fetch(
      'https://identitytoolkit.googleapis.com/v2/projects/hermes-idleviber/defaultSupportedIdpConfigs',
      { 
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      }
    );
    results.apiStatus = resp.status;
    const text = await resp.text();
    results.apiBody = text.substring(0, 300);
  } catch(e) {
    results.apiError = e.message;
  }
  
  return results;
});
console.log('\nAPI test:', JSON.stringify(apiTest, null, 2));

await browser.disconnect();
process.exit(0);
