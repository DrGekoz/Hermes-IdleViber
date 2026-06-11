import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserURL: 'http://127.0.0.1:9222',
});

const pages = await browser.pages();

// ====== FIND/CREATE PAGES ======
let authPage = null;
let firePage = null;

for (const p of pages) {
  const url = p.url();
  if (url.includes('authentication/providers')) {
    authPage = p;
  }
  if (url.includes('firestore')) {
    firePage = p;
  }
}

if (!firePage) {
  firePage = await browser.newPage();
  await firePage.goto('https://console.firebase.google.com/u/0/project/hermes-idleviber/firestore', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 3000));
}

if (!authPage) {
  for (const p of pages) {
    if (p.url().includes('firebase.google.com')) {
      authPage = p;
      await authPage.goto('https://console.firebase.google.com/u/0/project/hermes-idleviber/authentication/providers');
      await new Promise(r => setTimeout(r, 3000));
      break;
    }
  }
}

console.log('AUTH PAGE:', await authPage?.title());
console.log('FIRESTORE PAGE:', await firePage?.title());

// ====== ENABLE GOOGLE PROPERLY ======
console.log('\n🔵 Enabling Google...');

// Click Google tile first
await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('[aria-label="Google"], .provider-tile');
  for (const t of tiles) {
    if (t.textContent.trim() === 'Google') {
      t.click();
      console.log('Clicked Google tile');
      return;
    }
  }
  // Try finding via provider name
  const allTiles = document.querySelectorAll('.provider-name, .provider-tile div');
  for (const t of allTiles) {
    if (t.textContent.trim() === 'Google') {
      t.closest('[role="button"]')?.click() || t.click();
      console.log('Clicked Google via name');
      return;
    }
  }
});
await new Promise(r => setTimeout(r, 2000));

// Try clicking the mdc-switch track directly (more reliable than role="switch")
await authPage.evaluate(() => {
  // Find the switch inside the Google config panel
  const switchTrack = document.querySelector('.mdc-switch__track');
  const switchNative = document.querySelector('.mdc-switch__native-control');
  const switchThumb = document.querySelector('.mdc-switch__thumb');
  
  if (switchNative) {
    // Set checked property directly on the hidden checkbox
    switchNative.checked = true;
    // Dispatch change event
    switchNative.dispatchEvent(new Event('change', { bubbles: true }));
    switchNative.dispatchEvent(new Event('input', { bubbles: true }));
    console.log('Set switch via native control');
  } else if (switchTrack) {
    switchTrack.click();
    console.log('Clicked switch track');
  }
  
  // Also try clicking the label/container
  const switchEl = document.querySelector('.mdc-switch');
  if (switchEl) {
    // Check if there's a label that toggles it
    const label = switchEl.closest('label');
    if (label) {
      label.click();
      console.log('Clicked label');
    }
  }
});
await new Promise(r => setTimeout(r, 1000));

// Check if switch state changed
const switchState = await authPage.evaluate(() => {
  const sw = document.querySelector('[role="switch"]');
  if (sw) return { 
    'aria-checked': sw.getAttribute('aria-checked'),
    classes: sw.className
  };
  // Check native control
  const nc = document.querySelector('.mdc-switch__native-control');
  if (nc) return { checked: nc.checked };
  return 'no switch found';
});
console.log('Switch state:', JSON.stringify(switchState));

// Try clicking the role="switch" element directly
if (switchState['aria-checked'] === 'false' || switchState.checked === false) {
  // Use page.click which is more reliable
  const switchEl = await authPage.$('[role="switch"]');
  if (switchEl) {
    await switchEl.click();
    console.log('Clicked switch via page.$');
    await new Promise(r => setTimeout(r, 1000));
  }
}

// Check updated state
const switchState2 = await authPage.evaluate(() => {
  const sw = document.querySelector('[role="switch"]');
  if (sw) return sw.getAttribute('aria-checked');
  const nc = document.querySelector('.mdc-switch__native-control');
  if (nc) return String(nc.checked);
  return 'unknown';
});
console.log('Switch state after:', switchState2);

// Now try Save
await authPage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    const t = b.textContent.trim();
    if (t === 'Save' && !b.disabled) {
      b.click();
      console.log('Clicked Save');
      return;
    }
  }
  console.log('No enabled Save button');
  
  // If Save is disabled, try clicking toggle differently
  // Maybe the native input needs dispatching
  const native = document.querySelector('.mdc-switch__native-control');
  if (native && !native.checked) {
    native.checked = true;
    native.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    native.dispatchEvent(new Event('change', { bubbles: true }));
  }
});
await new Promise(r => setTimeout(r, 1500));

// Try Save again
await authPage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    if (b.textContent.trim() === 'Save' && !b.disabled) {
      b.click();
      console.log('Clicked Save (2nd try)');
      return;
    }
  }
  const saveBtn = Array.from(buttons).find(b => b.textContent.trim() === 'Save');
  console.log('Save disabled:', saveBtn?.disabled, 'button found:', !!saveBtn);
});

await new Promise(r => setTimeout(r, 2000));

// Check final Google status
const googleStatus = await authPage.evaluate(() => {
  const providers = Array.from(document.querySelectorAll('.provider-tile'));
  return providers.map(p => ({
    name: p.getAttribute('aria-label') || p.textContent?.trim().substring(0, 20),
    classes: p.className
  }));
});
console.log('\nProvider tiles:', JSON.stringify(googleStatus));

// ====== CREATE FIRESTORE DATABASE ======
console.log('\n🔥 Creating Firestore database...');
await new Promise(r => setTimeout(r, 1000));

const firestoreCreateBtn = await firePage.$('button:has-text("Create database")');
if (firestoreCreateBtn) {
  await firestoreCreateBtn.click();
  console.log('Clicked Create database');
} else {
  // Try evaluate
  await firePage.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      if (b.textContent.trim() === 'Create database') {
        b.click();
        console.log('Clicked Create database via eval');
        return;
      }
    }
  });
}

await new Promise(r => setTimeout(r, 3000));

// Check what's on the Firestore creation dialog
const firestoreDialog = await firePage.evaluate(() => {
  return document.body.innerText.substring(0, 2000);
});
console.log('Firestore dialog:', firestoreDialog.substring(0, 600));

// Check for modal buttons
const modalButtons = await firePage.evaluate(() => {
  return Array.from(document.querySelectorAll('button')).map(b => ({
    text: b.textContent.trim().substring(0, 40),
    disabled: b.disabled
  }));
});
console.log('Dialog buttons:', JSON.stringify(modalButtons, null, 2));

await browser.disconnect();
process.exit(0);
