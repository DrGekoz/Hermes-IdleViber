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

// Step 1: Click the mat-select to open dropdown
console.log('Clicking support email dropdown...');
await authPage.evaluate(() => {
  const select = document.querySelector('mat-select');
  if (select) select.click();
});
await new Promise(r => setTimeout(r, 2000));

// Check for dropdown options
const options = await authPage.evaluate(() => {
  // Mat-select options appear in a CDK overlay
  const optionsList = document.querySelectorAll('mat-option, .mat-mdc-option');
  return Array.from(optionsList).map(o => ({
    text: o.textContent.trim().substring(0, 60),
    value: o.getAttribute('value'),
    selected: o.getAttribute('aria-selected'),
    class: o.className?.substring(0, 40)
  }));
});
console.log('Dropdown options:', JSON.stringify(options, null, 2));

// If we found options, select the first non-empty one
if (options.length > 0) {
  // Click the first option
  const firstOption = options.find(o => o.text && !o.text.includes('Not configured'));
  if (firstOption) {
    await authPage.evaluate(() => {
      const options = document.querySelectorAll('mat-option, .mat-mdc-option');
      for (const o of options) {
        if (o.textContent.trim() && !o.textContent.includes('Not configured')) {
          o.click();
          return;
        }
      }
    });
    console.log('Selected first email option');
    await new Promise(r => setTimeout(r, 1500));
  }
}

// Check if dropdown is still open and if the value was set
const selectedValue = await authPage.evaluate(() => {
  const select = document.querySelector('mat-select');
  const trigger = document.querySelector('.mat-mdc-select-value');
  return {
    selectClass: select?.className,
    displayedValue: trigger?.textContent?.trim().substring(0, 60),
    selectId: select?.id
  };
});
console.log('After selection:', JSON.stringify(selectedValue));

// Check Save button state now
const saveState = await authPage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    if (b.textContent.replace(/\s+/g, ' ').trim() === 'Save') {
      return { disabled: b.disabled };
    }
  }
  return { notFound: true };
});
console.log('Save state:', JSON.stringify(saveState));

// If email was set, now toggle the switch
if (saveState.disabled !== undefined) {
  // Click the mat-slide-toggle
  await authPage.evaluate(() => {
    const toggle = document.querySelector('.mat-mdc-slide-toggle.enable-toggle-label');
    if (toggle) {
      toggle.click();
      console.log('Clicked slide toggle');
    } else {
      // Try clicking the switch directly
      const sw = document.querySelector('[role="switch"]');
      if (sw) sw.click();
    }
  });
  await new Promise(r => setTimeout(r, 1500));
}

// Check Save state again
const saveState2 = await authPage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    if (b.textContent.replace(/\s+/g, ' ').trim() === 'Save') {
      return { disabled: b.disabled };
    }
  }
  return { notFound: true };
});
console.log('Save state after toggle:', JSON.stringify(saveState2));

// Try clicking Save
if (saveState2 && !saveState2.disabled) {
  await authPage.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      if (b.textContent.replace(/\s+/g, ' ').trim() === 'Save') {
        b.click();
        return;
      }
    }
  });
  console.log('✅ Save clicked!');
  await new Promise(r => setTimeout(r, 3000));
}

// Final status
const status = await authPage.evaluate(() => {
  const lines = document.body.innerText.split('\n');
  return lines.filter(l => l.includes('check_circle') || l.includes('Enabled') || l.includes('Google') || l.includes('Email'));
});
console.log('\nFinal status:', status);

await browser.disconnect();
process.exit(0);
