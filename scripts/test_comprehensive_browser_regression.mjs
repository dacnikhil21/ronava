import assert from 'assert';
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';
const PASSWORD = 'Ronav@123';

const TEST_ROLES = [
  { role: 'ADMIN', id: 'ADM001', loginUrl: '#admin-login' },
  { role: 'MERCHANT', id: 'MID1001', loginUrl: '#merchant-login' },
  { role: 'DISTRIBUTOR', id: 'DIST1001', loginUrl: '#merchant-login' },
  { role: 'DISTRICT_DISTRIBUTOR', id: 'DD1001', loginUrl: '#merchant-login' },
  { role: 'MASTER', id: 'MST1002', loginUrl: '#merchant-login' }
];

const PUBLIC_ROUTES = [
  '#',
  '#about',
  '#services',
  '#loans',
  '#atm-franchise',
  '#bbps',
  '#pos',
  '#contact',
  '#merchant-login',
  '#admin-login'
];

async function runRegressionSuite() {
  console.log('=== STEP 4: REGRESSION TEST ACROSS ALL ROLES & ALL SCREENS ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await context.newPage();

  const unexpectedHttpErrors = [];
  const unexpectedConsoleErrors = [];

  page.on('response', async res => {
    const status = res.status();
    const url = res.url();
    if (status >= 400 && !url.includes('favicon.ico')) {
      let body = '';
      try { body = await res.text(); } catch (_) {}
      unexpectedHttpErrors.push({ url, status, body: body.slice(0, 150) });
      console.error(`  ❌ Unexpected [HTTP ${status}]: ${url.replace(BASE_URL, '')}`);
    }
  });

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      if (!text.includes('React DevTools') && !text.includes('favicon') && !text.includes('ERR_CONNECTION_REFUSED')) {
        unexpectedConsoleErrors.push({ type, text: text.slice(0, 200) });
        console.error(`  ❌ Console Error: ${text.slice(0, 120)}`);
      }
    }
  });

  // 1. Visit All Public Routes
  console.log('1. Auditing all Public Marketing Website routes...');
  for (const route of PUBLIC_ROUTES) {
    console.log(`   Navigating to ${route || 'home'}...`);
    await page.goto(`${BASE_URL}/${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
  }

  // 2. Audit Every Role's Screens & Tabs
  for (const target of TEST_ROLES) {
    console.log(`\n2. Auditing Authenticated Screens for ${target.role} (${target.id})...`);
    
    // Clear previous sessions
    await context.clearCookies();
    await page.goto(`${BASE_URL}/${target.loginUrl}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
    await page.waitForTimeout(500);

    // Perform Login
    if (target.role === 'ADMIN') {
      await page.fill('input[placeholder*="ADM"], input[type="text"]', target.id);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      const adminTabNames = ['Dashboard', 'Payout Requests', 'Applications', 'Distributor Network', 'Settings'];
      for (const tab of adminTabNames) {
        console.log(`   [Admin] Navigating to tab: ${tab}...`);
        const tabEl = page.locator(`button:has-text("${tab}"), span:has-text("${tab}")`).first();
        if (await tabEl.isVisible()) {
          await tabEl.click();
          await page.waitForTimeout(1000);
        }
      }
    } else {
      await page.fill('input[type="text"]', target.id);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      const merchantTabs = ['Record Sale', 'Withdraw', 'Bill Payments', 'Transactions', 'Home'];
      for (const tab of merchantTabs) {
        console.log(`   [${target.id}] Navigating to: ${tab}...`);
        const btn = page.locator(`button:has-text("${tab}"):visible, div:has-text("${tab}"):visible`).first();
        if (await btn.isVisible()) {
          await btn.click();
          await page.waitForTimeout(1000);
        }
      }

      // Check Terminal Card on Record Sale
      const recordBtn = page.locator('button:has-text("Record Sale"):visible').first();
      if (await recordBtn.isVisible()) {
        await recordBtn.click();
        await page.waitForTimeout(1000);
        const cardText = await page.innerText('body');
        assert.equal(cardText.includes('[PORTFOLIO]'), false, `Role ${target.id} must never see raw [PORTFOLIO] JSON on Record Sale screen`);
      }
    }
  }

  await browser.close();

  console.log('\n==================================================');
  console.log('REGRESSION AUDIT SUMMARY');
  console.log('==================================================');
  console.log(`Total Unexpected HTTP 4xx/5xx: ${unexpectedHttpErrors.length}`);
  console.log(`Total Unexpected Console Errors: ${unexpectedConsoleErrors.length}`);

  assert.equal(unexpectedHttpErrors.length, 0, `Regression suite failed: found ${unexpectedHttpErrors.length} unexpected HTTP errors.`);
  assert.equal(unexpectedConsoleErrors.length, 0, `Regression suite failed: found ${unexpectedConsoleErrors.length} unexpected console errors.`);

  console.log('✅ ALL SCREENS ACROSS ALL ROLES PASSED WITH 0 HTTP ERRORS AND 0 CONSOLE ERRORS.');
}

runRegressionSuite().catch(err => {
  console.error('\n❌ REGRESSION SUITE FAILED:', err.message);
  process.exit(1);
});
