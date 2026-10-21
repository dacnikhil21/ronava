import { chromium } from 'playwright';

async function testSwipeInBrowser() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 }
  });
  const page = await context.newPage();
  
  const networkLogs = [];
  const consoleLogs = [];

  page.on('response', async res => {
    if (res.status() >= 400) {
      let body = '';
      try { body = await res.text(); } catch (_) {}
      networkLogs.push({ status: res.status(), url: res.url(), body: body.slice(0, 150) });
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleLogs.push({ type: msg.type(), text: msg.text().slice(0, 150) });
    }
  });

  console.log('1. Logging in as MID1001...');
  await page.goto('http://localhost:3000/#merchant-login', { waitUntil: 'networkidle' });
  await page.fill('input[type="text"]', 'MID1001');
  await page.fill('input[type="password"]', 'Ronav@123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  console.log('2. Clicking visible "Record Sale" button...');
  const visibleBtn = page.locator('button:has-text("Record Sale"):visible, div[role="button"]:has-text("Record Sale"):visible').first();
  await visibleBtn.click();
  await page.waitForTimeout(1500);

  console.log('3. Checking Terminal Card text for raw JSON leak...');
  const cardLocator = page.locator('text=AVAILABLE BALANCE').locator('..');
  if (await cardLocator.isVisible()) {
    const cardText = await cardLocator.innerText();
    console.log('   Terminal Card text:\n', cardText);
  }

  console.log('4. Filling swipe amount & UTR...');
  const amountInput = page.locator('input[placeholder="0.00"]:visible');
  await amountInput.waitFor({ state: 'visible', timeout: 5000 });
  await amountInput.fill('500');

  const utrInput = page.locator('input[placeholder*="12-digit UTR"]:visible');
  const testUtr = `3344${Date.now().toString().slice(-8)}`;
  await utrInput.fill(testUtr);

  console.log('5. Clicking submit swipe...');
  const submitBtn = page.locator('button:has-text("Record Swipe"):visible');
  await submitBtn.click();

  console.log('6. Observing toasts for 4 seconds...');
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(500);
    const toasts = await page.locator('div[style*="position: fixed"]').allInnerTexts();
    const cleanToasts = toasts.map(t => t.trim()).filter(Boolean);
    if (cleanToasts.length > 0) {
      console.log(`   Toast at +${(i+1)*500}ms:`, cleanToasts);
    }
  }

  console.log('\n7. Network Errors Recorded:');
  console.table(networkLogs);

  console.log('\n8. Console Warnings/Errors Recorded:');
  console.table(consoleLogs.slice(0, 15));

  await browser.close();
}

testSwipeInBrowser().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
