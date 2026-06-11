import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserURL: 'http://127.0.0.1:9222',
});

const pages = await browser.pages();

// Close the Google config panel first by clicking somewhere neutral
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

console.log('PAGE:', await authPage?.title());
await new Promise(r => setTimeout(r, 1000));

// Close any open panel by clicking on Email/Password tile (top-left)
await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('[aria-label="Email/Password"]');
  if (tiles.length > 0) tiles[0].click();
});
await new Promise(r => setTimeout(r, 1500));

// Click Google tile
await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('[aria-label="Google"], .provider-tile');
  for (const t of tiles) {
    if (t.textContent.trim() === 'Google') t.click();
  }
});
await new Promise(r => setTimeout(r, 2000));

// Intercept network requests for the toggle action
// Set up request interception before clicking
await authPage.setRequestInterception(true);

const capturedRequests = [];

authPage.on('request', request => {
  const url = request.url();
  // Capture Firebase/Google API calls
  if (url.includes('identitytoolkit') || url.includes('firebase') || url.includes('googleapis')) {
    capturedRequests.push({
      url: url.substring(0, 120),
      method: request.method(),
      headers: JSON.stringify(request.headers()).substring(0, 200),
      postData: request.postData()?.substring(0, 300)
    });
  }
  request.continue();
});

// Now toggle the switch - click the role="switch" button directly via puppeteer
const switches = await authPage.$$('[role="switch"]');
console.log('Found switches:', switches.length);

if (switches.length > 0) {
  // Click the first visible switch (Google's toggle)
  await switches[0].click();
  console.log('Clicked switch via page.$');
  await new Promise(r => setTimeout(r, 2000));
}

// Check the captured requests
console.log('\nCaptured API requests:');
capturedRequests.forEach((r, i) => {
  console.log(`\n[${i}] ${r.method} ${r.url}`);
  if (r.postData) console.log('    POST:', r.postData.substring(0, 500));
});

await authPage.setRequestInterception(false);

// Try clicking Save
const saveResult = await authPage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    if (b.textContent.replace(/\\s+/g, ' ').trim() === 'Save') {
      if (!b.disabled) {
        b.click();
        return { clicked: true, disabled: false };
      }
      return { clicked: false, disabled: true };
    }
  }
  return { notFound: true };
});
console.log('\nSave result:', JSON.stringify(saveResult));

await new Promise(r => setTimeout(r, 2000));

// If Save is still disabled, try clicking the native control directly
if (saveResult.disabled) {
  console.log('\nSave still disabled. Trying native checkbox approach...');
  
  await authPage.evaluate(() => {
    // Find the mdc native control
    const nc = document.querySelector('.mdc-switch__native-control');
    if (nc) {
      // Simulate the full click sequence
      nc.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      nc.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      nc.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      nc.checked = true;
      nc.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Also try finding the mat-slide-toggle inside Angular
    const slideToggle = document.querySelector('.mat-mdc-slide-toggle');
    if (slideToggle) {
      slideToggle.click();
    }
  });
  await new Promise(r => setTimeout(r, 1000));
  
  // Try Save again
  const saveResult2 = await authPage.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      if (b.textContent.replace(/\\s+/g, ' ').trim() === 'Save' && !b.disabled) {
        b.click();
        return 'save clicked on 2nd try';
      }
    }
    return 'Save still disabled';
  });
  console.log('2nd try:', saveResult2);
}

await new Promise(r => setTimeout(r, 2000));

// Check provider status
const status = await authPage.evaluate(() => {
  const lines = document.body.innerText.split('\n');
  return lines.filter(l => l.includes('check_circle') || l.includes('Enabled') || l.includes('Google') || l.includes('Email') || l.includes('edit'));
});
console.log('\nProvider status:', status);

await browser.disconnect();
process.exit(0);
