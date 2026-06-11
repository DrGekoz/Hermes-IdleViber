import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserURL: 'http://127.0.0.1:9222',
});

const pages = await browser.pages();

// ====== VERIFY AUTH STATUS ======
let authPage = null;
for (const p of pages) {
  if (p.url().includes('authentication') && (await p.title()).includes('Sign-in method')) {
    authPage = p;
    break;
  }
}

if (authPage) {
  const status = await authPage.evaluate(() => {
    const tiles = document.querySelectorAll('.provider-tile');
    return Array.from(tiles).map(t => ({
      label: t.getAttribute('aria-label'),
      classes: t.className,
      text: t.textContent.trim().substring(0, 40),
      hasCheck: t.textContent.includes('check_circle')
    }));
  });
  console.log('Provider status:');
  status.forEach(s => console.log(`  ${s.label}: ${s.hasCheck ? '✅ Enabled' : '❌ Not enabled'} (${s.classes})`));
}

// ====== CREATE FIRESTORE DATABASE ======
console.log('\n🔥 Creating Firestore Database...');

let firePage = null;
for (const p of pages) {
  if (p.url().includes('firestore')) {
    firePage = p;
    break;
  }
}

if (!firePage) {
  firePage = await browser.newPage();
  await firePage.goto('https://console.firebase.google.com/u/0/project/hermes-idleviber/firestore');
  await new Promise(r => setTimeout(r, 4000));
}

console.log('Firestore page title:', await firePage?.title());

// Click "Create database" button
await firePage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    if (b.textContent.trim() === 'Create database') {
      b.click();
      return;
    }
  }
});
console.log('Clicked Create database');
await new Promise(r => setTimeout(r, 3000));

// Check what the dialog shows
const dialogText = await firePage.evaluate(() => {
  // Look for the dialog content
  const dialogs = document.querySelectorAll('[role="dialog"], .mat-mdc-dialog, .cdk-dialog, .mdc-dialog');
  for (const d of dialogs) {
    return d.textContent.substring(0, 2000);
  }
  return document.body.innerText.substring(0, 2000);
});
console.log('Dialog content:', dialogText.substring(0, 800));

// Look for "Next" or "Start in test mode" buttons
const buttons = await firePage.evaluate(() => {
  return Array.from(document.querySelectorAll('button')).map(b => ({
    text: b.textContent.replace(/\s+/g, ' ').trim().substring(0, 40),
    disabled: b.disabled
  })).filter(b => b.text);
});
console.log('Dialog buttons:', JSON.stringify(buttons, null, 2));

// Check for radio buttons or options
const radios = await firePage.evaluate(() => {
  return Array.from(document.querySelectorAll('[role="radio"], input[type="radio"], mat-radio-button')).map(r => ({
    tag: r.tagName,
    type: r.getAttribute('type'),
    checked: r.checked || r.getAttribute('aria-checked'),
    text: r.textContent?.trim().substring(0, 60),
    class: r.className?.substring(0, 40)
  }));
});
console.log('Radio options:', JSON.stringify(radios, null, 2));

// Select "Start in test mode" radio if available
await firePage.evaluate(() => {
  const radios = document.querySelectorAll('[role="radio"]');
  for (const r of radios) {
    if (r.textContent.includes('test mode') || r.getAttribute('aria-label')?.includes('test')) {
      r.click();
      console.log('Selected test mode');
      return;
    }
  }
  // Try mat-radio-button
  const matRadios = document.querySelectorAll('mat-radio-button');
  for (const r of matRadios) {
    if (r.textContent.includes('test')) {
      r.click();
      return;
    }
  }
  // Try input radio
  const inputRadios = document.querySelectorAll('input[type="radio"]');
  for (const r of inputRadios) {
    if (r.parentElement?.textContent?.includes('test') || r.getAttribute('aria-label')?.includes('test')) {
      r.checked = true;
      r.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
  }
});
await new Promise(r => setTimeout(r, 1500));

// Click Next or Create
await firePage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    const t = b.textContent.replace(/\s+/g, ' ').trim();
    if ((t === 'Next' || t === 'Create' || t.startsWith('Enable') || t === 'Done') && !b.disabled) {
      b.click();
      console.log('Clicked:', t);
      return;
    }
  }
  console.log('No actionable button found');
});
await new Promise(r => setTimeout(r, 2000));

// Check what happened
const afterClick = await firePage.evaluate(() => {
  return document.body.innerText.substring(0, 1500);
});
console.log('\nAfter create:', afterClick.substring(0, 600));

// If there's a location selection step
const locationRadios = await firePage.evaluate(() => {
  return Array.from(document.querySelectorAll('[role="radio"], mat-radio-button, input[type="radio"]')).map(r => ({
    text: r.textContent?.trim().substring(0, 60),
    checked: r.checked || r.getAttribute('aria-checked')
  }));
});
console.log('\nLocation radios:', JSON.stringify(locationRadios, null, 2));

await browser.disconnect();
process.exit(0);
