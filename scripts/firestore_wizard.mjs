import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserURL: 'http://127.0.0.1:9222',
});

const pages = await browser.pages();

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

console.log('PAGE:', await firePage?.title());

// Click "Create database"
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

// Step 1: Click "Next" (Select edition - Standard should be default)
console.log('\n=== Step 1: Clicking Next ===');
await firePage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  let clicked = false;
  for (const b of buttons) {
    if (b.textContent.trim() === 'Next' && !b.disabled) {
      b.click();
      clicked = true;
      return;
    }
  }
  if (!clicked) console.log('No Next button found');
});
await new Promise(r => setTimeout(r, 3000));

// Check what step we're on
const step2 = await firePage.evaluate(() => {
  return document.querySelector('[role="dialog"]')?.textContent?.substring(0, 1000) || 
         document.querySelector('.mdc-dialog')?.textContent?.substring(0, 1000) ||
         'no dialog';
});
console.log('Step 2:', step2.substring(0, 500));

// Step 2: Click "Next" again (Database ID & location - defaults are fine)
console.log('\n=== Step 2: Clicking Next ===');
await firePage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    if (b.textContent.trim() === 'Next' && !b.disabled) {
      b.click();
      return;
    }
  }
  console.log('No Next button');
});
await new Promise(r => setTimeout(r, 3000));

// Step 3: Select "Start in test mode" and click Create
console.log('\n=== Step 3: Selecting test mode ===');

// Check current selection
const radioState = await firePage.evaluate(() => {
  const radios = document.querySelectorAll('mat-radio-button');
  return Array.from(radios).map(r => ({
    text: r.textContent.trim().substring(0, 40),
    selected: r.classList.contains('mat-mdc-radio-checked') || r.getAttribute('aria-checked') === 'true'
  }));
});
console.log('Radio states:', JSON.stringify(radioState));

// Select "Start in test mode" by clicking the mat-radio-button
await firePage.evaluate(() => {
  const radios = document.querySelectorAll('mat-radio-button');
  for (const r of radios) {
    if (r.textContent.includes('test mode')) {
      r.click();
      console.log('Clicked test mode');
      return;
    }
  }
  // Try finding by input
  const inputs = document.querySelectorAll('input.mdc-radio__native-control');
  for (const input of inputs) {
    const parentText = input.closest('mat-radio-button')?.textContent || '';
    if (parentText.includes('test')) {
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
  }
});
await new Promise(r => setTimeout(r, 1500));

// Check if test mode is now selected
const radioState2 = await firePage.evaluate(() => {
  const radios = document.querySelectorAll('mat-radio-button');
  return Array.from(radios).map(r => ({
    text: r.textContent.trim().substring(0, 40),
    selected: r.classList.contains('mat-mdc-radio-checked') || r.getAttribute('aria-checked') === 'true'
  }));
});
console.log('Radio states after click:', JSON.stringify(radioState2));

// Click "Create" or "Enable"
console.log('\n=== Creating database ===');
await firePage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    const t = b.textContent.replace(/\s+/g, ' ').trim();
    if ((t === 'Create' || t === 'Enable' || t === 'Done') && !b.disabled) {
      b.click();
      console.log('Clicked:', t);
      return;
    }
  }
  console.log('No create button');
});
await new Promise(r => setTimeout(r, 3000));

// Check result
const result = await firePage.evaluate(() => {
  return document.body.innerText.substring(0, 1000);
});
console.log('\nResult:', result.substring(0, 400));

// Check if database was created
const hasDatabase = await firePage.evaluate(() => {
  const body = document.body.innerText;
  // After creation, we should see collections or database info
  return {
    hasStartCollection: body.includes('Start collection'),
    hasDatabase: body.includes('Database') || body.includes('data'),
    noCreateBtn: !body.includes('Create database'),
    bodySnippet: body.substring(0, 600)
  };
});
console.log('\nDatabase created?', JSON.stringify(hasDatabase));

await browser.disconnect();
process.exit(0);
