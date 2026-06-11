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

// Find and inspect the support email selector
const emailSelectInfo = await authPage.evaluate(() => {
  // Find all select elements
  const selects = document.querySelectorAll('select, [role="combobox"], .mat-mdc-select');
  return Array.from(selects).map(s => ({
    tag: s.tagName,
    id: s.id,
    class: s.className?.substring(0, 80),
    value: s.value,
    type: s.getAttribute('role'),
    ariaLabel: s.getAttribute('aria-label'),
    options: s.tagName === 'SELECT' ? Array.from(s.options).map(o => ({ text: o.text, value: o.value, selected: o.selected })) : null
  }));
});
console.log('Select elements:', JSON.stringify(emailSelectInfo, null, 2));

// Also check for any mat-select trigger
const triggers = await authPage.evaluate(() => {
  const triggers = document.querySelectorAll('.mat-mdc-select-trigger, .mat-mdc-select-value, [role="combobox"]');
  return Array.from(triggers).map(t => ({
    tag: t.tagName,
    text: t.textContent.trim().substring(0, 50),
    class: t.className?.substring(0, 60),
    ariaLabel: t.getAttribute('aria-label')
  }));
});
console.log('\nSelect triggers:', JSON.stringify(triggers, null, 2));

// Find the support email section specifically
const supportEmail = await authPage.evaluate(() => {
  // Find all elements with text about support email
  const allElements = document.querySelectorAll('*');
  const results = [];
  for (const el of allElements) {
    if (el.children?.length === 0 && el.textContent?.includes('Support email')) {
      results.push({
        tag: el.tagName,
        text: el.textContent.trim().substring(0, 100),
        parent: el.parentElement?.className?.substring(0, 60),
        nextSibling: el.nextElementSibling?.textContent?.trim().substring(0, 60)
      });
    }
  }
  return results;
});
console.log('\nSupport email elements:', JSON.stringify(supportEmail, null, 2));

await browser.disconnect();
process.exit(0);
