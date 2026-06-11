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

// Click Google tile
await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('[aria-label="Google"], .provider-tile');
  for (const t of tiles) {
    if (t.textContent.trim() === 'Google') t.click();
  }
});
console.log('Clicked Google tile');
await new Promise(r => setTimeout(r, 2000));

// Take a screenshot to see the page
await authPage.screenshot({ path: 'F:\\aaaaaVIBECODING\\Hermes-IdleViber\\scripts\\google_panel.png' });
console.log('Screenshot saved');

// Check what's in the Google config panel
const panelHtml = await authPage.evaluate(() => {
  // Find the config panel
  const configPanel = document.querySelector('.provider-config-card') || 
                      document.querySelector('[aria-label*="Google"]') ||
                      document.querySelector('.config-panel');
  if (configPanel) {
    return configPanel.innerHTML.substring(0, 3000);
  }
  // Find the section with "Configure provider"
  const allDivs = document.querySelectorAll('div');
  for (const d of allDivs) {
    if (d.textContent.includes('Configure provider') && d.textContent.includes('Google')) {
      return d.innerHTML.substring(0, 3000);
    }
  }
  // Get any button text near the word "Enable" 
  return 'no panel found';
});
console.log('\nPanel HTML:', panelHtml.substring(0, 1000));

// Find ALL buttons with their full text and states
const allButtons = await authPage.evaluate(() => {
  return Array.from(document.querySelectorAll('button')).map(b => ({
    text: b.textContent.replace(/\\s+/g, ' ').trim().substring(0, 50),
    disabled: b.disabled,
    role: b.getAttribute('role'),
    type: b.type,
    ariaLabel: b.getAttribute('aria-label')?.substring(0, 30),
    visible: b.offsetParent !== null,
    rect: b.getBoundingClientRect().width > 0 ? 'visible' : 'hidden'
  })).filter(b => b.text || b.ariaLabel);
});
console.log('\nALL BUTTONS:');
allButtons.forEach((b, i) => console.log(`  [${i}] text="${b.text}" disabled=${b.disabled} role=${b.role} visible=${b.visible}`));

// Now let's try clicking the plain "Enable" button (not the switch)
// Look for a button that has just "Enable" as its text
const clickedBtn = await authPage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    const trimmed = b.textContent.replace(/\\s+/g, ' ').trim();
    if (trimmed === 'Enable' && !b.disabled && b.getAttribute('role') !== 'switch') {
      b.click();
      return 'clicked Enable button';
    }
  }
  return 'no Enable text button found';
});
console.log('\nButton click result:', clickedBtn);
await new Promise(r => setTimeout(r, 2000));

// Check if Save is now available
const saveState = await authPage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    if (b.textContent.replace(/\\s+/g, ' ').trim() === 'Save') {
      return { disabled: b.disabled, text: b.textContent.trim() };
    }
  }
  return 'no save found';
});
console.log('Save state:', JSON.stringify(saveState));

if (saveState && saveState.disabled === false) {
  // Click Save!
  await authPage.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      if (b.textContent.replace(/\\s+/g, ' ').trim() === 'Save') {
        b.click();
        return;
      }
    }
  });
  console.log('✅ Save clicked!');
  await new Promise(r => setTimeout(r, 3000));
}

// Check final state
const finalStatus = await authPage.evaluate(() => {
  const lines = document.body.innerText.split('\n');
  return lines.filter(l => l.includes('check_circle') || l.includes('Enabled') || l.includes('Google') || l.includes('Email'));
});
console.log('\nFinal status:', finalStatus);

await browser.disconnect();
process.exit(0);
