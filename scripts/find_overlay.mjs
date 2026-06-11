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

// Step 1: Click the mat-select trigger to open dropdown
console.log('Clicking mat-select...');
await authPage.evaluate(() => {
  const trigger = document.querySelector('.mat-mdc-select-trigger');
  if (trigger) {
    trigger.click();
    return;
  }
  const select = document.querySelector('mat-select');
  if (select) select.click();
});
await new Promise(r => setTimeout(r, 2000));

// Check body for overlay panels
const overlayPanels = await authPage.evaluate(() => {
  const overlays = document.querySelectorAll('.cdk-overlay-pane, .mat-mdc-select-panel, .mdc-menu-surface');
  return Array.from(overlays).map(o => ({
    class: o.className?.substring(0, 60),
    innerText: o.textContent?.trim().substring(0, 200),
    children: o.children.length,
    visible: o.getBoundingClientRect().width > 0
  }));
});
console.log('Overlay panels:', JSON.stringify(overlayPanels, null, 2));

// Also check for cdk-overlay-container
const overlayContainer = await authPage.evaluate(() => {
  const container = document.querySelector('.cdk-overlay-container');
  if (!container) return 'no overlay container';
  const panels = container.querySelectorAll('*');
  return Array.from(panels).slice(0, 10).map(p => ({
    class: p.className?.substring(0, 60),
    text: p.textContent?.trim().substring(0, 100),
    tag: p.tagName
  }));
});
console.log('\nOverlay container:', JSON.stringify(overlayContainer, null, 2));

// Try clicking on the mat-select value text directly
// And then use keyboard to navigate
await authPage.evaluate(() => {
  // Focus the select
  const select = document.querySelector('mat-select');
  if (select) {
    select.focus();
    // Dispatch keyboard events
    select.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    select.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', bubbles: true }));
  }
});
await new Promise(r => setTimeout(r, 1000));

// Check again for overlay content
const overlayItems = await authPage.evaluate(() => {
  // Look for mat-option in the entire document
  const options = document.querySelectorAll('mat-option');
  return Array.from(options).map(o => ({
    text: o.textContent?.trim().substring(0, 60),
    selected: o.getAttribute('aria-selected'),
    disabled: o.getAttribute('aria-disabled'),
    class: o.className?.substring(0, 40)
  }));
});
console.log('\nAll mat-options in doc:', JSON.stringify(overlayItems, null, 2));

// Try to find any option by looking deeper in the overlay
const allText = await authPage.evaluate(() => {
  // Search body for any dropdown-like elements
  const bodyChildren = document.body.children;
  for (let i = 0; i < bodyChildren.length; i++) {
    const child = bodyChildren[i];
    if (child.tagName.includes('OVERLAY') || child.className.includes('overlay') || child.className.includes('cdk')) {
      return {
        tag: child.tagName,
        class: child.className.substring(0, 80),
        html: child.innerHTML.substring(0, 500)
      };
    }
  }
  return 'no overlay found in body children';
});
console.log('\nBody overlay child:', JSON.stringify(allText, null, 2));

await browser.disconnect();
process.exit(0);
