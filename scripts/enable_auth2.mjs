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
    if (p.url().includes('authentication')) {
      authPage = p;
      break;
    }
  }
}

if (!authPage) {
  console.log('NO AUTH PAGE, navigating...');
  for (const p of pages) {
    const url = p.url();
    if (url.includes('firebase.google.com') || url.includes('accounts.google.com')) {
      await p.goto('https://console.firebase.google.com/u/0/project/hermes-idleviber/authentication/providers');
      authPage = p;
      await new Promise(r => setTimeout(r, 4000));
      break;
    }
  }
}

if (!authPage) {
  console.log('STILL FAILED');
  await browser.disconnect();
  process.exit(0);
}

console.log('PAGE:', await authPage.title());
await new Promise(r => setTimeout(r, 1000));

// ========== HANDLE GOOGLE ==========
console.log('\n🔵 Setting up Google...');

// Click Google tile
await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('[aria-label="Google"], .provider-tile');
  for (const t of tiles) {
    if (t.textContent.includes('Google')) {
      t.click();
      return;
    }
  }
});
await new Promise(r => setTimeout(r, 2000));

// Check what Google panel looks like
const googleContent = await authPage.evaluate(() => {
  return document.body.innerText.substring(0, 2000);
});
console.log('Google panel:', googleContent.substring(0, 400));

// Check if there's an Enable button or toggle
const googleBtns = await authPage.evaluate(() => {
  const switches = document.querySelectorAll('[role="switch"]');
  const buttons = document.querySelectorAll('button');
  const all = [...switches, ...buttons].map(el => ({
    tag: el.tagName,
    role: el.getAttribute('role'),
    text: el.textContent?.trim().substring(0, 40),
    'aria-checked': el.getAttribute('aria-checked'),
    disabled: el.disabled,
    class: el.className?.substring(0, 50)
  }));
  return all;
});
console.log('Google buttons:', JSON.stringify(googleBtns, null, 2));

// If we see an "Enable" button with no toggle, click it then Save
let googleOk = false;
if (googleContent.includes('Enable') && !googleContent.includes('project name')) {
  // Click Enable button
  await authPage.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      if (b.textContent.trim() === 'Enable' && !b.disabled) {
        b.click();
        console.log('CLICKED ENABLE');
        return;
      }
    }
  });
  await new Promise(r => setTimeout(r, 2000));
  
  // Check if there's a Save button now
  const afterEnable = await authPage.evaluate(() => {
    return document.body.innerText.substring(0, 1000);
  });
  console.log('After Enable:', afterEnable.substring(0, 400));
  
  // Try Save
  await authPage.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      if (b.textContent.trim() === 'Save' && !b.disabled) {
        b.click();
        return 'saved';
      }
    }
    return 'no save';
  });
  await new Promise(r => setTimeout(r, 2000));
  googleOk = true;
}

// Check final Google status
const final = await authPage.evaluate(() => {
  const body = document.body.innerText;
  // Look for Google in the provider list
  const lines = body.split('\n').filter(l => l.includes('Google') || l.includes('Enabled') || l.includes('check_circle'));
  return lines;
});
console.log('Google final status:', final);

// ========== SET UP FIRESTORE ==========
console.log('\n🔥 Setting up Firestore Database...');

// Open a new tab for Firestore
const firestorePage = await browser.newPage();
await firestorePage.goto('https://console.firebase.google.com/u/0/project/hermes-idleviber/firestore');
await new Promise(r => setTimeout(r, 3000));

// Check the page
const firestoreContent = await firestorePage.evaluate(() => {
  return document.body.innerText.substring(0, 2000);
});
console.log('Firestore page:', firestoreContent.substring(0, 600));

await browser.disconnect();
process.exit(0);
