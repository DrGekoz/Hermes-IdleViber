import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserURL: 'http://127.0.0.1:9222',
});

const pages = await browser.pages();

// Find or navigate to auth providers page
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
      await p.goto('https://console.firebase.google.com/u/0/project/hermes-idleviber/authentication/providers');
      authPage = p;
      await new Promise(r => setTimeout(r, 4000));
      break;
    }
  }
}

console.log('PAGE:', await authPage?.title());

// ====== ENABLE GOOGLE ======
console.log('\n🔵 Enabling Google...');

// Click Google tile first
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

// Now find all switches and their positions
const switchInfo = await authPage.evaluate(() => {
  const switches = document.querySelectorAll('[role="switch"]');
  const result = [];
  switches.forEach((s, i) => {
    const rect = s.getBoundingClientRect();
    const parentDiv = s.closest('.provider-config') || s.parentElement;
    result.push({
      index: i,
      checked: s.getAttribute('aria-checked'),
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      parentText: (parentDiv?.textContent || '').trim().substring(0, 100)
    });
  });
  return result;
});
console.log('Switches:', JSON.stringify(switchInfo, null, 2));

// Click the first switch (Google's toggle) using its coordinates
if (switchInfo.length > 0) {
  const s = switchInfo[0];
  await authPage.mouse.click(s.x + s.width/2, s.y + s.height/2);
  console.log('Clicked Google toggle at:', s.x, s.y);
} else {
  console.log('No switches found, trying button approach');
  await authPage.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      if (b.textContent.trim() === 'Enable' && !b.disabled && b.getAttribute('role') !== 'switch') {
        b.click();
        return;
      }
    }
  });
}

await new Promise(r => setTimeout(r, 1000));

// Now click Save
const saveResult = await authPage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    if (b.textContent.trim() === 'Save' && !b.disabled) {
      b.click();
      return 'save clicked';
    }
  }
  return 'no save button enabled';
});
console.log('Save result:', saveResult);

await new Promise(r => setTimeout(r, 3000));

// ====== CHECK STATUS ======
const providerList = await authPage.evaluate(() => {
  const lines = document.body.innerText.split('\n');
  return lines.filter(l => 
    l.includes('Provider') || l.includes('Status') || 
    l.includes('Email/Password') || l.includes('Google') || 
    l.includes('GitHub') || l.includes('Enabled') || 
    l.includes('check_circle') || l.includes('edit')
  );
});
console.log('\nProviders status:', providerList);

// ====== FIRESTORE ======
console.log('\n🔥 Setting up Firestore...');

let firePage = null;
for (const p of pages) {
  if (p.url().includes('firestore')) {
    firePage = p;
    break;
  }
}

if (!firePage) {
  firePage = await browser.newPage();
}

await firePage.goto('https://console.firebase.google.com/u/0/project/hermes-idleviber/firestore', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));

const firestoreText = await firePage.evaluate(() => document.body.innerText.substring(0, 2000));
console.log('Firestore page:', firestoreText.substring(0, 500));

// Check for Create database button
const buttons = await firePage.evaluate(() => {
  return Array.from(document.querySelectorAll('button')).map(b => ({
    text: b.textContent.trim().substring(0, 40),
    disabled: b.disabled,
    ariaLabel: b.getAttribute('aria-label')?.substring(0, 30)
  }));
});
console.log('Firestore buttons:', JSON.stringify(buttons, null, 2));

await browser.disconnect();
process.exit(0);
