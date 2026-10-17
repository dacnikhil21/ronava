// server/test_rate_parent_swipe_verification.mjs
import { chromium } from 'playwright';
import pg from 'pg';
import assert from 'node:assert';
import { cleanAndReseed } from './clean_and_reseed.mjs';
import { assertSystemConsistency } from './consistency_checker.js';
import { TEST_USERS, performConfirmedLogin } from './test_config.js';

const { Pool } = pg;
const BASE_URL = 'http://localhost:3000';
const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_test_db',
  ssl: false
});

async function testUserSwipe(browser, userId, userRole, amount, utr, custName, custMobile, expectedFeePct, expectedFeeRupees, expectedNetRupees) {
  console.log(`\nTesting ${userId} swipe (Rs ${amount.toLocaleString('en-IN')} Pine Labs T+1)...`);
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  page.on('dialog', async dialog => {
    console.log(`   [Dialog Auto-Confirm] ${dialog.message()}`);
    await dialog.accept();
  });

  try {
    await performConfirmedLogin(page, userId, { baseUrl: BASE_URL });

    // Click Record Sale tab
    await page.locator('button:has-text("Record Sale")').first().click();
    await page.waitForTimeout(1000);

    // Type amount
    await page.locator('input[placeholder="0.00"]').first().fill(String(amount));
    // Type Slip UTR
    await page.locator('input[placeholder*="UTR"]').first().fill(utr);
    // Fill customer name and mobile
    await page.locator('input[placeholder*="Ramesh Kumar"]').first().fill(custName);
    await page.locator('input[placeholder*="mobile"]').first().fill(custMobile);

    // Wait for server live quote to populate
    await page.waitForTimeout(1500);
    const formText = await page.innerText('body');
    console.log(`   ${userId} Swipe Form Preview check...`);
    assert(formText.includes(`Company Fee (${expectedFeePct}%): -₹${expectedFeeRupees}`), `Expected Company Fee (${expectedFeePct}%): -₹${expectedFeeRupees}, got: ${formText}`);
    assert(formText.includes(`₹${expectedNetRupees}`), `Expected Net Credit ₹${expectedNetRupees}, got: ${formText}`);
    assert(!formText.includes('Company Fee (0.00%)'), 'Form must never show 0.00% fee!');

    // Submit swipe
    await page.locator('button[type="submit"]:has-text("Record Swipe")').first().click();
    await page.waitForTimeout(3000);

    // Verify wallet
    const pageText = await page.innerText('body');
    assert(pageText.includes(expectedNetRupees), `${userId} wallet balance must show ₹${expectedNetRupees}`);
    console.log(`✅ ${userId} swipe successful: fee ${expectedFeeRupees}, net credit ${expectedNetRupees}.`);
  } finally {
    await context.close();
  }
}

async function runTest() {
  console.log('--- STARTING RATE, PARENT & SWIPE VERIFICATION TEST ---');

  // 1. Clean & reseed ronav_test_db
  console.log('1. Reseeding clean reference hierarchy on ronav_test_db...');
  await cleanAndReseed();

  const browser = await chromium.launch({ headless: true });

  try {
    // 2. Admin Verification: Check cards for Real Rate and Real Parent
    console.log('\n2. Logging into Admin as ADM001 to verify cards...');
    const adminContext = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const adminPage = await adminContext.newPage();
    adminPage.on('dialog', async d => await d.accept());

    await performConfirmedLogin(adminPage, 'ADM001', 'Ronav@123', 'ADMIN');
    await adminPage.waitForTimeout(1000);

    console.log('   Checking Super Dist card...');
    await adminPage.locator('button:has-text("Super Dist")').first().click();
    await adminPage.waitForTimeout(1000);
    const sdPageText = await adminPage.innerText('body');
    assert(sdPageText.includes('Under: Master Distributor'), 'Super Dist card must show "Under: Master Distributor"');
    assert(sdPageText.includes('0.80%'), 'Super Dist card must show buy rate 0.80%');
    assert(!sdPageText.includes('⚡ Buy Rate: T+1: 0.00%'), 'Super Dist card must not show 0.00%');

    console.log('   Checking District Dist card...');
    await adminPage.locator('button:has-text("District Dist")').first().click();
    await adminPage.waitForTimeout(1000);
    const ddPageText = await adminPage.innerText('body');
    assert(ddPageText.includes('Under: Super Distributor'), 'District Dist card must show "Under: Super Distributor"');
    assert(ddPageText.includes('1.00%'), 'District Dist card must show buy rate 1.00%');

    console.log('   Checking Area Dist card...');
    await adminPage.locator('button:has-text("Distributor")').first().click();
    await adminPage.waitForTimeout(1000);
    const dPageText = await adminPage.innerText('body');
    assert(dPageText.includes('Under: District Distributor'), 'Area Dist card must show "Under: District Distributor"');
    assert(dPageText.includes('1.20%'), 'Area Dist card must show buy rate 1.20%');

    console.log('✅ Admin cards show real rates and real parents.');
    await adminContext.close();

    // 3. SD1001 swipes Rs 10,000 Pine Labs T+1
    // Fee: 80 bps (0.80%) = Rs 80.00; Net: Rs 9,920.00
    await testUserSwipe(browser, 'SD1001', 'SUPER_DISTRIBUTOR', 10000, 'SDUTR1001001', 'Ramesh Kumar', '9848011223', '0.80', '80.00', '9,920.00');

    // 4. DIST2001 swipes Rs 10,000 Pine Labs T+1
    // Fee: 100 bps (1.00%) = Rs 100.00; Net: Rs 9,900.00
    await testUserSwipe(browser, 'DIST2001', 'DISTRICT_DISTRIBUTOR', 10000, 'DISTUTR200101', 'Suresh Varma', '9848099887', '1.00', '100.00', '9,900.00');

    // 5. AREA3001 swipes Rs 10,000 Pine Labs T+1
    // Fee: 120 bps (1.20%) = Rs 120.00; Net: Rs 9,880.00
    await testUserSwipe(browser, 'AREA3001', 'DISTRIBUTOR', 10000, 'AREAUTR300101', 'Mahesh Reddy', '9848055443', '1.20', '120.00', '9,880.00');

    // 6. Verify Database Wallets and Commissions
    console.log('\n6. Verifying ledger and wallet balances in database...');
    const balances = await pool.query(`
      SELECT user_id, balance_paise, held_paise, (balance_paise / 100.0) as balance_rupees
      FROM wallets
      ORDER BY user_id
    `);
    const balanceMap = {};
    balances.rows.forEach(r => { balanceMap[r.user_id] = Number(r.balance_paise); });

    console.log('Wallet balances:', balances.rows.map(r => `${r.user_id}: ₹${r.balance_rupees}`).join(', '));

    // SD1001: 9,920 (own swipe) + 20 (DIST swipe) + 20 (AREA swipe) = 9,960
    assert.equal(balanceMap['SD1001'], 996000, `SD1001 expected 996000 paise (Rs 9,960), got ${balanceMap['SD1001']}`);

    // DIST2001: 9,900 (own swipe) + 20 (AREA swipe) = 9,920
    assert.equal(balanceMap['DIST2001'], 992000, `DIST2001 expected 992000 paise (Rs 9,920), got ${balanceMap['DIST2001']}`);

    // AREA3001: 9,880 (own swipe) = 9,880
    assert.equal(balanceMap['AREA3001'], 988000, `AREA3001 expected 988000 paise (Rs 9,880), got ${balanceMap['AREA3001']}`);

    // MST1001: 20 (SD) + 20 (DIST) + 20 (AREA) = 60
    assert.equal(balanceMap['MST1001'], 6000, `MST1001 expected 6000 paise (Rs 60), got ${balanceMap['MST1001']}`);

    // ADM001: 60 (SD) + 60 (DIST) + 60 (AREA) = 180
    assert.equal(balanceMap['ADM001'], 18000, `ADM001 expected 18000 paise (Rs 180), got ${balanceMap['ADM001']}`);

    console.log('✅ All 5 wallet balances exactly match mathematical invariant!');

    // 7. Run Master Consistency Checker
    console.log('\n7. Running assertSystemConsistency...');
    const checkContext = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const checkPage = await checkContext.newPage();
    await performConfirmedLogin(checkPage, 'ADM001', 'Ronav@123', 'ADMIN');

    await assertSystemConsistency({
      pool,
      page: checkPage,
      currentUserId: 'ADM001',
      currentUserRole: 'ADMIN',
      scenarioName: 'Rate Parent & Swipe E2E Verification'
    });
    await checkContext.close();

    console.log('\n🎉 ALL CHECKS PASSED PERFECTLY!');
  } finally {
    await browser.close();
    await pool.end();
  }
}

runTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  pool.end();
  process.exit(1);
});
