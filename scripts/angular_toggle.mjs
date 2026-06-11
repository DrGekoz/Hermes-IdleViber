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

await authPage.evaluate(() => {
  const tiles = document.querySelectorAll('[aria-label="Google"], .provider-tile');
  for (const t of tiles) {
    if (t.textContent.trim() === 'Google') t.click();
  }
});
await new Promise(r => setTimeout(r, 2000));

// Set support email
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

// === APPROACH: Angular component direct manipulation ===
console.log('Attempting Angular component manipulation...');

const toggleResult = await authPage.evaluate(() => {
  const results = {};
  
  // Method 1: Find the Angular MatSlideToggle component using __ngContext__
  const toggleEl = document.querySelector('.mat-mdc-slide-toggle');
  if (toggleEl) {
    // Angular v17+ stores component data in __ngContext__
    const ngContext = toggleEl.__ngContext__;
    results.hasNgContext = !!ngContext;
    
    // Get all properties
    const props = Object.getOwnPropertyNames(toggleEl);
    results.properties = props.filter(p => p.startsWith('__ng') || p.startsWith('_'));
    
    // Try to find the component instance via debug properties
    for (const key of Object.keys(toggleEl)) {
      if (key.startsWith('__ngContext__')) {
        const ctx = toggleEl[key];
        results.ngContextType = typeof ctx;
        if (Array.isArray(ctx) || ctx instanceof Array) {
          results.ngContextLength = ctx.length;
          // Search for MatSlideToggle in the context
          for (let i = 0; i < Math.min(ctx.length, 20); i++) {
            if (ctx[i] && typeof ctx[i] === 'object') {
              const keys = Object.keys(ctx[i]);
              if (keys.includes('checked')) {
                results.foundSlideToggle = { index: i, checked: ctx[i].checked };
                // Toggle it!
                ctx[i].checked = true;
                if (ctx[i]._markForCheck) ctx[i]._markForCheck();
                if (ctx[i].change) ctx[i].change.emit();
                results.toggled = true;
                break;
              }
            }
          }
        }
      }
    }
    
    // Method 2: Try to find the component via Angular-specific properties
    // In Angular, components are stored in __ngContext__ arrays
    // Let's dig deeper
    if (!results.toggled) {
      const allKeys = Object.getOwnPropertyNames(toggleEl);
      for (const key of allKeys) {
        if (key.startsWith('__ngContext__')) {
          const ctx = toggleEl[key];
          if (Array.isArray(ctx)) {
            for (let i = 0; i < Math.min(ctx.length, 50); i++) {
              const item = ctx[i];
              if (item && typeof item === 'object') {
                const itemKeys = Object.keys(item);
                for (const ik of itemKeys) {
                  if (ik === 'checked' && typeof item[ik] === 'boolean') {
                    results.foundCheckedAt = { l1: i, key: ik, value: item[ik] };
                    item[ik] = true;
                    if (typeof item._markForCheck === 'function') item._markForCheck();
                    results.toggled = true;
                    break;
                  }
                }
              }
              if (results.toggled) break;
            }
          }
        }
      }
    }
    
    // Method 3: Dispatch native click on the hidden input
    const nc = toggleEl.querySelector('.mdc-switch__native-control');
    if (nc) {
      // Simulate the complete event chain for Angular
      nc.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      nc.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      nc.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
      nc.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      nc.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      nc.checked = true;
      nc.dispatchEvent(new Event('change', { bubbles: true }));
      nc.dispatchEvent(new Event('input', { bubbles: true }));

      // Also try dispatching from the label
      const label = toggleEl.querySelector('label');
      if (label) {
        label.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
      
      results.nativeControlDispatched = true;
    }
  }
  
  return results;
});

console.log('Toggle result:', JSON.stringify(toggleResult, null, 2));

// Wait for Angular change detection
await new Promise(r => setTimeout(r, 2000));

// Check Save button
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

// Try clicking Save regardless
if (saveState && !saveState.disabled) {
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

// If Save is still disabled, try the ultimate approach
// Find the Angular component's FormGroup and set dirty
if (saveState && saveState.disabled) {
  console.log('Save still disabled. Applying final approach...');
  
  await authPage.evaluate(() => {
    // Trigger Angular change detection by clicking other elements
    // Or force the form to be dirty
    const toggleEl = document.querySelector('.mat-mdc-slide-toggle');
    if (toggleEl) {
      // Try to find the input and click it using mouse events with exact coordinates
      const nc = toggleEl.querySelector('.mdc-switch__native-control');
      if (nc) {
        const rect = nc.getBoundingClientRect();
        if (rect.width > 0) {
          // Click at multiple positions
          const points = [
            { x: rect.left + 25, y: rect.top + 7 },
            { x: rect.left + 30, y: rect.top + 7 },
            { x: rect.left + 35, y: rect.top + 7 },
          ];
          points.forEach(p => {
            // Create and dispatch proper events
            ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(eventType => {
              const event = new MouseEvent(eventType, {
                bubbles: true,
                cancelable: true,
                clientX: p.x,
                clientY: p.y,
                screenX: p.x,
                screenY: p.y,
                button: 0
              });
              nc.dispatchEvent(event);
            });
          });
        }
      }
    }
  });
  await new Promise(r => setTimeout(r, 2000));
  
  const saveState2 = await authPage.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      if (b.textContent.replace(/\s+/g, ' ').trim() === 'Save' && !b.disabled) {
        b.click();
        return 'save clicked!';
      }
    }
    return 'still disabled';
  });
  console.log('Final save attempt:', saveState2);
}

// Status
const status = await authPage.evaluate(() => {
  const lines = document.body.innerText.split('\n');
  return lines.filter(l => l.includes('check_circle') || l.includes('Enabled') || l.includes('Google'));
});
console.log('\nStatus:', status);

await browser.disconnect();
process.exit(0);
