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

// Now we see the dialog. Let me find the "Start in test mode" radio input
// and click its actual <input type="radio"> element
console.log('\nLooking for test mode radio...');

const radioInput = await firePage.evaluate(() => {
  // Find all radio inputs
  const inputs = document.querySelectorAll('input[type="radio"]');
  const results = [];
  inputs.forEach((input, i) => {
    // Find the associated label text
    const parent = input.closest('mat-radio-button') || input.closest('label') || input.parentElement;
    const text = parent?.textContent?.trim() || '';
    results.push({
      index: i,
      checked: input.checked,
      id: input.id,
      text: text.substring(0, 60),
      rect: input.getBoundingClientRect()
    });
  });
  return results;
});
console.log('Radio inputs:', JSON.stringify(radioInput, null, 2));

// Find the "Start in test mode" radio and click it
const testModeRadio = radioInput.find(r => r.text.includes('test mode'));
const prodModeRadio = radioInput.find(r => r.text.includes('production mode'));

if (testModeRadio && testModeRadio.rect.width > 0) {
  // Click using coordinates for reliability
  await firePage.mouse.click(
    testModeRadio.rect.x + testModeRadio.rect.width / 2,
    testModeRadio.rect.y + testModeRadio.rect.height / 2
  );
  console.log('Clicked test mode radio at', testModeRadio.rect.x, testModeRadio.rect.y);
  await new Promise(r => setTimeout(r, 1500));
}

// Verify test mode is selected
const verifyRadio = await firePage.evaluate(() => {
  const inputs = document.querySelectorAll('input[type="radio"]');
  return Array.from(inputs).map(i => ({
    checked: i.checked,
    text: i.closest('mat-radio-button')?.textContent?.trim().substring(0, 40) || ''
  })).filter(r => r.text);
});
console.log('Radio verification:', JSON.stringify(verifyRadio));

// Now click "Create" 
console.log('\nClicking Create...');
await firePage.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    const t = b.textContent.replace(/\s+/g, ' ').trim();
    if (t === 'Next') {
      // If Next exists, click it first (might need to advance)
      // But we want Create, let's try both
    }
  }
  
  // Try Create first
  for (const b of buttons) {
    const t = b.textContent.replace(/\s+/g, ' ').trim();
    if (t === 'Create' && !b.disabled) {
      b.click();
      return 'create';
    }
  }
  
  // Try Next
  for (const b of buttons) {
    if (b.textContent.trim() === 'Next' && !b.disabled) {
      b.click();
      return 'next';
    }
  }
  
  return 'no button';
});
console.log('Create/Next clicked');
await new Promise(r => setTimeout(r, 3000));

// Check the result
const result = await firePage.evaluate(() => {
  return document.body.innerText.substring(0, 800);
});
console.log('\nResult:', result.substring(0, 400));

// Check for database created
const dbCreated = await firePage.evaluate(() => {
  return {
    hasCreateBtn: document.body.innerText.includes('Create database'),
    hasStartCollection: document.body.innerText.includes('Start collection'),
    snippet: document.body.innerText.substring(0, 500)
  };
});
console.log('DB status:', JSON.stringify(dbCreated));

if (!dbCreated.hasCreateBtn) {
  console.log('✅ FIRESTORE DATABASE CREATED!');
} else if (dbCreated.hasCreateBtn) {
  console.log('❌ Database not created yet');
}

await browser.disconnect();
process.exit(0);
