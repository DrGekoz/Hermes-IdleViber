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

// Step 1: Set support email
const selectBox = await authPage.evaluate(() => {
  const select = document.querySelector('mat-select');
  if (!select) return null;
  const rect = select.getBoundingClientRect();
  return { x: rect.x + rect.width/2, y: rect.y + rect.height/2 };
});

if (selectBox) {
  await authPage.mouse.click(selectBox.x, selectBox.y);
  await new Promise(r => setTimeout(r, 2000));
}

await authPage.evaluate(() => {
  const options = document.querySelectorAll('mat-option, .mat-mdc-option');
  for (const o of options) {
    if (o.textContent.trim() && !o.textContent.includes('Not configured')) {
      o.click();
      return;
    }
  }
});
await new Promise(r => setTimeout(r, 1500));

// Step 2: Toggle the switch using multiple methods
console.log('Toggling switch...');

// Method A: Direct click on the switch role button using puppeteer coordinates
const switchBox = await authPage.evaluate(() => {
  const sw = document.querySelector('[role="switch"]');
  if (!sw) return null;
  const rect = sw.getBoundingClientRect();
  return { x: rect.x + rect.width - 2, y: rect.y + rect.height/2 };
});

if (switchBox) {
  // Click multiple times to be sure
  await authPage.mouse.click(switchBox.x, switchBox.y);
  await new Promise(r => setTimeout(r, 500));
  await authPage.mouse.click(switchBox.x, switchBox.y);
  console.log('Double-clicked switch at:', switchBox.x, switchBox.y);
  await new Promise(r => setTimeout(r, 1500));
}

// Method B: Direct DOM manipulation to force the toggle ON
await authPage.evaluate(() => {
  const sw = document.querySelector('[role="switch"]');
  if (sw) {
    // Force the aria state
    sw.setAttribute('aria-checked', 'true');
    sw.classList.remove('mdc-switch--unselected');
    sw.classList.add('mdc-switch--selected');
    
    // Find and check the native input
    const nc = document.querySelector('.mdc-switch__native-control');
    if (nc) {
      nc.checked = true;
      nc.dispatchEvent(new Event('change', { bubbles: true }));
      nc.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Also try clicking the mdc-switch element
    const mdcSwitch = document.querySelector('.mdc-switch');
    if (mdcSwitch) {
      mdcSwitch.click();
    }
    
    // Dispatch click directly on the switch
    sw.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
});
await new Promise(r => setTimeout(r, 1500));

// Step 3: Check and click Save
const result = await authPage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    if (b.textContent.replace(/\s+/g, ' ').trim() === 'Save') {
      return { disabled: b.disabled, text: b.textContent.trim() };
    }
  }
  return { notFound: true };
});
console.log('Save status:', JSON.stringify(result));

// Try clicking Save anyway
if (result && result.disabled === false) {
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
} else if (result && result.disabled === true) {
  // If save is still disabled, try using the Angular component directly
  console.log('Save still disabled. Trying Angular component approach...');
  await authPage.evaluate(() => {
    // Try to find and click the Angular material slide-toggle button
    const toggleBtn = document.querySelector('#mat-mdc-slide-toggle-6-button');
    if (toggleBtn) {
      toggleBtn.click();
      return 'clicked toggle button';
    }
    
    // Try dispatching on the native input
    const input = document.querySelector('.mdc-switch__native-control');
    if (input) {
      // Simulate the full event chain that Angular expects
      input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      setTimeout(() => {
        input.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
        input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }, 100);
    }
    
    return 'dispatched events';
  });
  await new Promise(r => setTimeout(r, 2000));
  
  // Check save again
  const result2 = await authPage.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      if (b.textContent.replace(/\s+/g, ' ').trim() === 'Save' && !b.disabled) {
        b.click();
        return 'save clicked on 2nd try';
      }
    }
    return 'save still disabled';
  });
  console.log('2nd try:', result2);
}

await new Promise(r => setTimeout(r, 2000));

// Final status
const status = await authPage.evaluate(() => {
  const lines = document.body.innerText.split('\n');
  return lines.filter(l => l.includes('check_circle') || l.includes('Enabled') || l.includes('Google') || l.includes('Email'));
});
console.log('\nStatus:', status);

// Also check if Google has "Enabled" in the tile
const googleTile = await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('.provider-tile');
  for (const t of tiles) {
    if (t.textContent.includes('Google')) {
      return {
        text: t.textContent.trim().substring(0, 60),
        classes: t.className,
        hasEnabledIcon: t.textContent.includes('check_circle')
      };
    }
  }
  return 'not found';
});
console.log('Google tile:', JSON.stringify(googleTile));

await browser.disconnect();
process.exit(0);
