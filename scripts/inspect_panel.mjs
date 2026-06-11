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

// Get the FULL HTML of the page to understand the Google config panel structure
const fullHtml = await authPage.evaluate(() => {
  return document.documentElement.outerHTML;
});
console.log('HTML length:', fullHtml.length);

// Find all input elements
const inputs = await authPage.evaluate(() => {
  return Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
    tag: el.tagName,
    type: el.getAttribute('type'),
    id: el.id,
    name: el.getAttribute('name'),
    placeholder: el.placeholder,
    'aria-label': el.getAttribute('aria-label'),
    value: el.value?.substring(0, 50),
    required: el.required,
    disabled: el.disabled,
    className: el.className?.substring(0, 60)
  }));
});
console.log('\nAll inputs:', JSON.stringify(inputs, null, 2));

// Find all labels
const labels = await authPage.evaluate(() => {
  return Array.from(document.querySelectorAll('label, .label, [class*="label"]')).map(l => ({
    text: l.textContent.trim().substring(0, 60),
    htmlFor: l.getAttribute('for'),
    class: l.className?.substring(0, 60)
  }));
});
console.log('\nAll labels:', JSON.stringify(labels, null, 2));

// Find any form or form-like element
const forms = await authPage.evaluate(() => {
  return Array.from(document.querySelectorAll('form, [role="form"], .config-form, .provider-config')).map(f => ({
    tag: f.tagName,
    id: f.id,
    class: f.className?.substring(0, 60),
    innerText: f.textContent.substring(0, 400)
  }));
});
console.log('\nForms:', JSON.stringify(forms, null, 2));

// Check for the "project-level setting" mentioned in the text
const projectSetting = await authPage.evaluate(() => {
  // Find the section that mentions "Update the project-level setting"
  const allElements = document.querySelectorAll('*');
  for (const el of allElements) {
    if (el.textContent && el.textContent.includes('project-level setting')) {
      return {
        tag: el.tagName,
        class: el.className?.substring(0, 80),
        text: el.textContent.substring(0, 500)
      };
    }
  }
  return null;
});
console.log('\nProject setting section:', JSON.stringify(projectSetting, null, 2));

// Check for tabs or sections within the Google config
const tabs = await authPage.evaluate(() => {
  return Array.from(document.querySelectorAll('[role="tab"], .mat-mdc-tab, .tab-header')).map(t => ({
    text: t.textContent.trim().substring(0, 80),
    selected: t.getAttribute('aria-selected'),
    class: t.className?.substring(0, 60)
  }));
});
console.log('\nTabs:', JSON.stringify(tabs, null, 2));

await browser.disconnect();
process.exit(0);
