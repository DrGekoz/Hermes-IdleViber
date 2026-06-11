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

// Get current state of ALL provider tiles
const tileState = await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('.provider-tile');
  return Array.from(tiles).map(t => ({
    ariaLabel: t.getAttribute('aria-label'),
    text: t.textContent.trim().substring(0, 30),
    className: t.className,
    enabledClass: t.classList.contains('enabled'),
    disabledClass: t.classList.contains('disabled'),
    hasCheck: t.textContent.includes('check_circle') || t.textContent.includes('Enabled')
  }));
});
console.log('ALL TILES:', JSON.stringify(tileState, null, 2));

// Get text of the whole providers section
const providerSection = await authPage.evaluate(() => {
  // Try to find the providers table/section
  const section = document.querySelector('.sign-in-providers') || 
                   document.querySelector('[aria-label="Sign-in providers"]') ||
                   document.querySelector('.providers-list');
  if (section) return section.textContent.substring(0, 2000);
  return 'No provider section found';
});
console.log('\nProvider section:', providerSection.substring(0, 1000));

// Check if Google is actually enabled by looking at the text more carefully
const fullText = await authPage.evaluate(() => document.body.innerText);
// Find the line that has Google
const lines = fullText.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Google')) {
    console.log(`\nLine ${i}:`, lines[i]);
    // Show surrounding context
    for (let j = Math.max(0, i-3); j < Math.min(lines.length, i+4); j++) {
      console.log(`  ${j}: "${lines[j].trim()}"`);
    }
    console.log('---');
  }
}

await browser.disconnect();
process.exit(0);
