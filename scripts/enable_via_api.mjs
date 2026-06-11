import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserURL: 'http://127.0.0.1:9222',
});

const pages = await browser.pages();

let authPage = null;
let firePage = null;

for (const p of pages) {
  const url = p.url();
  if (url.includes('authentication/providers')) authPage = p;
  if (url.includes('firestore')) firePage = p;
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

// ====== USE API DIRECTLY ======
// The Firebase console uses internal APIs.
// Let's intercept the actual API call instead of toggling UI elements.

console.log('PAGE:', await authPage?.title());
await new Promise(r => setTimeout(r, 1000));

// Click Google tile
await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('[aria-label="Google"], .provider-tile');
  for (const t of tiles) {
    if (t.textContent.trim() === 'Google') {
      t.click();
      return;
    }
  }
});
await new Promise(r => setTimeout(r, 2000));

// Instead of toggling UI, inject the API call directly
const apiResult = await authPage.evaluate(async () => {
  try {
    // Get the Firebase auth token from the page's gapi or firebase auth
    // Look for the access token in the page's auth library
    const token = await new Promise((resolve, reject) => {
      // Try to find gapi
      if (typeof gapi !== 'undefined' && gapi.auth) {
        gapi.auth.getToken().then(t => resolve(t.access_token));
      } else if (typeof __gapi !== 'undefined') {
        resolve(__gapi.getToken());
      } else {
        // Try to find firebase auth token
        resolve(null);
      }
    });
    
    // Try via fetch with the page's cookies
    const resp = await fetch(
      'https://identitytoolkit.googleapis.com/v2/projects/hermes-idleviber/defaultSupportedIdpConfigs/google.com?updateMask=enabled',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true })
      }
    );
    return { status: resp.status, body: await resp.text() };
  } catch(e) {
    return { error: e.message };
  }
});
console.log('API direct call result:', JSON.stringify(apiResult));

// Try alternative - maybe it needs a different endpoint
const apiResult2 = await authPage.evaluate(async () => {
  try {
    const resp = await fetch(
      'https://console.firebase.google.com/v1/projects/hermes-idleviber/identityPlatform:updateConfig',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signInProviders: {
            google: { enabled: true }
          }
        })
      }
    );
    return { status: resp.status, body: await resp.text() };
  } catch(e) {
    return { error: e.message };
  }
});
console.log('API call 2:', JSON.stringify(apiResult2));

await browser.disconnect();
process.exit(0);
