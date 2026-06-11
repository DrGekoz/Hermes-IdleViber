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
  // Try the other auth page
  for (const p of pages) {
    if (p.url().includes('authentication')) {
      authPage = p;
      break;
    }
  }
}

if (!authPage) {
  console.log('NO AUTH PAGE FOUND');
  // Navigate to auth page
  for (const p of pages) {
    if (p.url().includes('firebase.google.com')) {
      await p.goto('https://console.firebase.google.com/u/0/project/hermes-idleviber/authentication/providers');
      authPage = p;
      await new Promise(r => setTimeout(r, 3000));
      break;
    }
  }
}

if (!authPage) {
  console.log('STILL NO PAGE');
  await browser.disconnect();
  process.exit(0);
}

console.log('USING PAGE:', await authPage.title());

// ========== ENABLE EMAIL/PASSWORD ==========
console.log('\n📧 Enabling Email/Password...');

// Click on the Email/Password provider tile
await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('[aria-label="Email/Password"], .provider-tile');
  for (const t of tiles) {
    if (t.textContent.includes('Email/Password')) {
      t.click();
      return;
    }
  }
});
await new Promise(r => setTimeout(r, 1500));

// Toggle the Enable switch ON
const emailToggled = await authPage.evaluate(() => {
  const switches = document.querySelectorAll('[role="switch"]');
  for (const s of switches) {
    if (s.getAttribute('aria-checked') === 'false' && 
        s.parentElement?.textContent?.trim().startsWith('Enable')) {
      s.click();
      return 'toggled ON';
    }
  }
  return 'no un-toggled switch found';
});
console.log('Email toggle:', emailToggled);
await new Promise(r => setTimeout(r, 500));

// Click Save
await authPage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    if (b.textContent.trim() === 'Save') {
      b.click();
      return;
    }
  }
});
console.log('✅ Email/Password saved!');
await new Promise(r => setTimeout(r, 2000));

// ========== ENABLE GOOGLE ==========
console.log('\n🔵 Enabling Google...');

await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('[aria-label="Google"], .provider-tile');
  for (const t of tiles) {
    if (t.textContent.includes('Google')) {
      t.click();
      return;
    }
  }
});
await new Promise(r => setTimeout(r, 1500));

// Check if Google needs a project name or has a simpler flow
const googlePage = await authPage.evaluate(() => {
  return document.body.innerText.substring(0, 2000);
});
console.log('Google dialog:', googlePage.substring(0, 500));

// Click Enable/Save for Google
const googleSaved = await authPage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    const t = b.textContent.trim();
    if (t === 'Enable' || t === 'Save') {
      // Check if there's a Web SDK configuration needed
      b.click();
      return 'clicked ' + t;
    }
  }
  return 'no enable/save found';
});
console.log('Google result:', googleSaved);
await new Promise(r => setTimeout(r, 2000));

// ========== ENABLE GITHUB ==========
console.log('\n🐙 Enabling GitHub...');

await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('[aria-label="GitHub"], .provider-tile');
  for (const t of tiles) {
    if (t.textContent.includes('GitHub')) {
      t.click();
      return;
    }
  }
});
await new Promise(r => setTimeout(r, 1500));

const gitHubPage = await authPage.evaluate(() => {
  return document.body.innerText.substring(0, 2000);
});
console.log('GitHub dialog:', gitHubPage.substring(0, 500));

// For GitHub, may need client ID / secret - check
const githubNeedsConfig = await authPage.evaluate(() => {
  const inputs = document.querySelectorAll('input');
  return Array.from(inputs).map(i => ({ 
    placeholder: i.placeholder, 
    type: i.type, 
    id: i.id?.substring(0, 30),
    ariaLabel: i.getAttribute('aria-label')
  }));
});
console.log('GitHub inputs:', JSON.stringify(githubNeedsConfig, null, 2));

// Check final status
const finalStatus = await authPage.evaluate(() => {
  return document.body.innerText.substring(0, 3000);
});
console.log('\n=== FINAL STATUS ===');
console.log(finalStatus);

await browser.disconnect();
process.exit(0);
