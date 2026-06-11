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

// 1. Click Google tile
await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('[aria-label="Google"], .provider-tile');
  for (const t of tiles) {
    if (t.textContent.trim() === 'Google') t.click();
  }
});
console.log('Clicked Google tile');
await new Promise(r => setTimeout(r, 2000));

// 2. Click switch using page.click on the mdc-switch element
// First find its position
const switchPos = await authPage.evaluate(() => {
  const sw = document.querySelector('.mdc-switch');
  if (!sw) return null;
  const rect = sw.getBoundingClientRect();
  return { x: rect.x + rect.width/2, y: rect.y + rect.height/2 };
});
console.log('Switch position:', switchPos);

if (switchPos) {
  await authPage.mouse.click(switchPos.x, switchPos.y);
  console.log('Clicked switch at center');
  await new Promise(r => setTimeout(r, 1000));
  
  // Also try native control
  await authPage.evaluate(() => {
    const nc = document.querySelector('.mdc-switch__native-control');
    if (nc) {
      nc.checked = true;
      nc.dispatchEvent(new Event('change', { bubbles: true }));
      nc.dispatchEvent(new InputEvent('input', { bubbles: true }));
      // Dispatch click for Angular
      nc.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  console.log('Also set native control');
  await new Promise(r => setTimeout(r, 1000));
}

// 3. Try Save
const saveResult = await authPage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  let trySave = null;
  for (const b of buttons) {
    if (b.textContent.trim() === 'Save') {
      trySave = { disabled: b.disabled };
      if (!b.disabled) {
        b.click();
        trySave.clicked = true;
      }
    }
  }
  return trySave || { notFound: true };
});
console.log('Save button:', JSON.stringify(saveResult));

await new Promise(r => setTimeout(r, 3000));

// Check provider status
const status = await authPage.evaluate(() => {
  return document.body.innerText.substring(0, 2000);
});
// Show just the provider lines
const lines = status.split('\n').filter(l => 
  l.includes('check_circle') || 
  l.includes('Enabled') || 
  l.includes('Google') || 
  l.includes('Email/Password') ||
  l.includes('Provider')
);
console.log('\nProvider status:');
lines.forEach(l => console.log('  -', l.trim()));

// Show if Google is enabled
const isGoogleEnabled = await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('.provider-tile');
  for (const t of tiles) {
    if (t.textContent.includes('Google')) {
      return {
        text: t.textContent.trim().substring(0, 100),
        classes: t.className,
        ariaLabel: t.getAttribute('aria-label')
      };
    }
  }
  return 'google tile not found';
});
console.log('\nGoogle tile:', JSON.stringify(isGoogleEnabled));

await browser.disconnect();
process.exit(0);
