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

console.log('PAGE:', await authPage?.title());

// Close panel and re-open Google
await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('[aria-label="Email/Password"]');
  if (tiles.length > 0) tiles[0].click();
});
await new Promise(r => setTimeout(r, 1000));

// Click Google tile
await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('[aria-label="Google"], .provider-tile');
  for (const t of tiles) {
    if (t.textContent.trim() === 'Google') t.click();
  }
});
await new Promise(r => setTimeout(r, 2000));

// Step 1: Open the mat-select dropdown
console.log('\n=== STEP 1: Opening support email dropdown ===');
const selectBox = await authPage.evaluate(() => {
  const select = document.querySelector('mat-select');
  if (!select) return null;
  const rect = select.getBoundingClientRect();
  return { x: rect.x + rect.width/2, y: rect.y + rect.height/2 };
});

if (selectBox) {
  await authPage.mouse.click(selectBox.x, selectBox.y);
  console.log('Clicked mat-select at center');
  await new Promise(r => setTimeout(r, 2000));
}

// Step 2: Click the email option
console.log('\n=== STEP 2: Selecting email option ===');
const optionClicked = await authPage.evaluate(() => {
  const options = document.querySelectorAll('mat-option, .mat-mdc-option');
  console.log('Options found:', options.length);
  for (const o of options) {
    const text = o.textContent.trim();
    if (text && !text.includes('Not configured')) {
      o.click();
      console.log('Clicked option:', text);
      return 'clicked: ' + text;
    }
  }
  return 'no option found';
});
console.log('Option result:', optionClicked);
await new Promise(r => setTimeout(r, 2000));

// Check if value was set
const selectValue = await authPage.evaluate(() => {
  const trigger = document.querySelector('.mat-mdc-select-value');
  return trigger?.textContent?.trim().substring(0, 60) || 'not found';
});
console.log('Select now shows:', selectValue);

// Step 3: Toggle the switch
console.log('\n=== STEP 3: Toggling Enable ===');

// Click the slide toggle label (the "Enable" label next to the switch)
await authPage.evaluate(() => {
  // Method 1: Click the label
  const label = document.querySelector('.mat-mdc-slide-toggle .mdc-label');
  if (label) {
    label.click();
    console.log('Clicked mdc-label');
    return;
  }
  // Method 2: Click the entire slide toggle
  const toggle = document.querySelector('.mat-mdc-slide-toggle');
  if (toggle) {
    toggle.click();
    console.log('Clicked slide toggle');
    return;
  }
  // Method 3: Click the switch
  const sw = document.querySelector('[role="switch"]');
  if (sw) {
    sw.click();
    console.log('Clicked switch');
  }
});
await new Promise(r => setTimeout(r, 1500));

// Check switch state
const switchState = await authPage.evaluate(() => {
  const sw = document.querySelector('[role="switch"]');
  if (sw) return sw.getAttribute('aria-checked');
  return 'no switch';
});
console.log('Switch state:', switchState);

// Step 4: Click Save!
console.log('\n=== STEP 4: Clicking Save ===');
const saveClicked = await authPage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    if (b.textContent.replace(/\s+/g, ' ').trim() === 'Save') {
      if (!b.disabled) {
        b.click();
        return 'save clicked';
      }
      return 'save disabled: ' + b.disabled;
    }
  }
  return 'save not found';
});
console.log('Save result:', saveClicked);

await new Promise(r => setTimeout(r, 3000));

// Final status
const status = await authPage.evaluate(() => {
  const lines = document.body.innerText.split('\n');
  return lines.filter(l => l.includes('check_circle') || l.includes('Enabled') || l.includes('Google') || l.includes('Email'));
});
console.log('\n=== PROVIDER STATUS ===');
status.forEach(s => console.log(' ', s));

await browser.disconnect();
process.exit(0);
