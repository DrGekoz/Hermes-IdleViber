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
await new Promise(r => setTimeout(r, 1000));

// Close any open panel by clicking Email/Password tile
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

// Find all switches and use page.click() which should work with shadow DOM / complex components
const switchElements = await authPage.$$('[role="switch"]');
console.log('Switches found:', switchElements.length);

if (switchElements.length > 0) {
  // Try to get the actual bounding box and click in the center
  const box = await switchElements[0].boundingBox();
  console.log('Switch box:', box);
  
  if (box) {
    // Click slightly to the right (on the thumb/track, not the label text)
    await authPage.mouse.click(box.x + box.width - 5, box.y + box.height / 2);
    console.log('Clicked switch at right side');
    await new Promise(r => setTimeout(r, 1500));
  } else {
    // Fallback to evaluate click
    await authPage.evaluate(() => {
      const sw = document.querySelector('[role="switch"]');
      if (sw) {
        sw.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        sw.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        sw.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });
    console.log('Dispatched mouse events on switch');
    await new Promise(r => setTimeout(r, 1500));
  }
}

// Also try clicking the native control
await authPage.evaluate(() => {
  const nc = document.querySelector('.mdc-switch__native-control') || 
             document.querySelector('input.mdc-switch__native-control');
  if (nc && window.getComputedStyle(nc).display !== 'none') {
    nc.click();
    console.log('Native control clicked');
    nc.checked = true;
    nc.dispatchEvent(new Event('change', { bubbles: true }));
    nc.dispatchEvent(new Event('input', { bubbles: true }));
  }
});

await new Promise(r => setTimeout(r, 1000));

// Check Save button
const saveState = await authPage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    if (b.textContent.replace(/\\s+/g, ' ').trim() === 'Save') {
      return { disabled: b.disabled, text: b.textContent.trim() };
    }
  }
  return 'not found';
});
console.log('Save state:', JSON.stringify(saveState));

if (saveState && !saveState.disabled) {
  await authPage.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      if (b.textContent.replace(/\\s+/g, ' ').trim() === 'Save') {
        b.click();
        return;
      }
    }
  });
  console.log('✅ Save clicked!');
  await new Promise(r => setTimeout(r, 3000));
}

// Check final status
const status = await authPage.evaluate(() => {
  const lines = document.body.innerText.split('\n');
  return lines.filter(l => l.includes('check_circle') || l.includes('Enabled') || l.includes('Google') || l.includes('Email'));
});
console.log('\nProvider status:', status);

await browser.disconnect();
process.exit(0);
