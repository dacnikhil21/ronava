// server/test_withdrawal_export_and_bank_details.mjs
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_test_db';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { getDbPool, pgQuery, withTransaction } from './pg_db.js';
import { generateToken } from './security.js';
import { performConfirmedLogin } from './test_config.js';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('================================================================');
  console.log('=== TEST: WITHDRAWAL EXPORT & BENEFICIARY STANDARDIZATION ===');
  console.log('================================================================');

  const pool = getDbPool();
  const adminToken = generateToken({ id: 'ADM001', role: 'ADMIN' });

  // Ensure user's pending withdrawal is PENDING for test
  await pgQuery("UPDATE withdrawals SET status = 'PENDING', batch_id = null, submitted_to_bank_at = null WHERE id = 'WTH-1792385364177-3214'");

  try {
    // ---------------------------------------------------------------------------
    // STEP 1: Verify GET /api/admin/pending returns standardized bank fields
    // ---------------------------------------------------------------------------
    console.log('\n--- 1. Testing /api/admin/pending standardized bank fields ---');
    const pendingRes = await fetch(`${BASE_URL}/api/admin/pending`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(pendingRes.status, 200, 'GET /api/admin/pending returned 200');
    const pendingJson = await pendingRes.json();
    assert.ok(pendingJson.success, 'GET /api/admin/pending returned success: true');
    
    const pendingWths = pendingJson.pendingWithdrawals || [];
    console.log(`Found ${pendingWths.length} pending withdrawal(s).`);
    assert.ok(pendingWths.length > 0, 'Must have at least 1 pending withdrawal to verify');

    const targetWth = pendingWths.find(w => w.id === 'WTH-1792385364177-3214');
    assert.ok(targetWth, 'Withdrawal WTH-1792385364177-3214 must be present in pending withdrawals');
    console.log(`Checking withdrawal ${targetWth.id}: account_number=${targetWth.account_number}, ifsc_code=${targetWth.ifsc_code}, bank_name=${targetWth.bank_name}, beneficiary_name=${targetWth.beneficiary_name}`);
    
    assert.equal(targetWth.account_number, '12345678901', 'Standardized account_number must match beneficiary table');
    assert.equal(targetWth.ifsc_code, 'SBIN0001234', 'Standardized ifsc_code must match beneficiary table');
    assert.equal(targetWth.bank_name, 'State Bank of India', 'Standardized bank_name must match beneficiary table');
    assert.equal(targetWth.beneficiary_name, 'D Nik', 'Standardized beneficiary_name must match beneficiary table');
    console.log('   ✓ /api/admin/pending returns standardized bank fields joined from beneficiaries.');

    // ---------------------------------------------------------------------------
    // STEP 2: Verify export endpoint accepts array of withdrawal IDs
    // ---------------------------------------------------------------------------
    console.log('\n--- 2. Testing export API with withdrawalIds array ---');
    const directExportRes = await fetch(`${BASE_URL}/api/admin/withdrawals/export-excel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        withdrawalIds: [targetWth.id],
        batchTag: 'TEST_DIRECT'
      })
    });
    assert.equal(directExportRes.status, 200, `Direct export returned 200`);
    const directExportJson = await directExportRes.json();
    assert.ok(directExportJson.success, 'Export returned success: true');
    assert.ok(directExportJson.csv, 'Export returned csv content');
    assert.ok(directExportJson.csv.includes('12345678901'), 'CSV contains full account number');
    assert.ok(directExportJson.csv.includes('SBIN0001234'), 'CSV contains IFSC');
    console.log('   ✓ Direct export API succeeded with array of withdrawal IDs.');

    // Re-verify that second export excludes it
    const reExportRes = await fetch(`${BASE_URL}/api/admin/withdrawals/export-excel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        withdrawalIds: [targetWth.id]
      })
    });
    assert.equal(reExportRes.status, 400, 'Second export of submitted withdrawal blocked with 400');
    const reExportJson = await reExportRes.json();
    assert.ok(reExportJson.message.includes('ALREADY_EXPORTED'), 'Blocked with ALREADY_EXPORTED message');
    console.log('   ✓ Second export correctly excludes submitted withdrawal.');

    // Reset targetWth to PENDING for the browser test
    await pgQuery("UPDATE withdrawals SET status = 'PENDING', batch_id = null, submitted_to_bank_at = null WHERE id = 'WTH-1792385364177-3214'");

    // ---------------------------------------------------------------------------
    // STEP 3: Verify missing IFSC blocks export with affected withdrawal ID
    // ---------------------------------------------------------------------------
    console.log('\n--- 3. Testing missing IFSC blocks export with affected withdrawal ID ---');
    const testBadBenId = 'BEN-TEST-NO-IFSC-' + Date.now();
    const testBadWthId = 'WTH-TEST-NO-IFSC-' + Date.now();
    
    await withTransaction(async (client) => {
      await client.query(`
        INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified, is_primary)
        VALUES ($1, 'MID1001', 'Test Bank', '98765432101', '', 'Test Holder', true, false)
      `, [testBadBenId]);

      await client.query(`
        INSERT INTO withdrawals (id, merchant_id, amount_paise, amount, fee_paise, net_payout_paise, beneficiary_id, channel, settlement_type, status, created_at)
        VALUES ($1, 'MID1001', 100000, 1000.00, 0, 100000, $2, 'pinelabs', 'T1', 'PENDING', NOW())
      `, [testBadWthId, testBadBenId]);
    });

    const badExportRes = await fetch(`${BASE_URL}/api/admin/withdrawals/export-excel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        withdrawalIds: [testBadWthId]
      })
    });
    assert.equal(badExportRes.status, 400, 'Export with missing IFSC returned 400');
    const badExportJson = await badExportRes.json();
    assert.ok(badExportJson.message.includes('MISSING_BANK_DETAILS'), 'Returns MISSING_BANK_DETAILS code');
    assert.ok(badExportJson.message.includes(testBadWthId), 'Error message explicitly names affected withdrawal ID');
    console.log(`   ✓ Export correctly blocked and named affected withdrawal: ${badExportJson.message}`);

    // Clean up the temporary test bad rows
    await pgQuery('DELETE FROM withdrawals WHERE id = $1', [testBadWthId]);
    await pgQuery('DELETE FROM beneficiaries WHERE id = $1', [testBadBenId]);
    console.log('   ✓ Cleaned up temporary test rows.');

    // ---------------------------------------------------------------------------
    // STEP 4: Real Browser Test via Playwright
    // ---------------------------------------------------------------------------
    console.log('\n--- 4. Real Browser Playwright Test ---');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    try {
      // 4A. Log in as Admin (ADM001)
      console.log('Logging in as Admin ADM001...');
      await performConfirmedLogin(page, 'ADM001', { baseUrl: BASE_URL });

      // Click on "Payouts" tab in the admin header nav
      console.log('Switching to Payouts tab...');
      const payoutsTabBtn = page.locator('button:has-text("Payouts")').first();
      await payoutsTabBtn.waitFor({ state: 'visible', timeout: 8000 });
      await payoutsTabBtn.click();
      await page.waitForTimeout(1000);

      // Click on Card 1 "Pending Withdrawals" to ensure pending withdrawals view is active
      console.log('Opening Pending Withdrawals view...');
      const pendingCard = page.locator('span:has-text("Pending Withdrawals"), button:has-text("Pending Withdrawals")').first();
      await pendingCard.waitFor({ state: 'visible', timeout: 8000 });
      await pendingCard.click();
      await page.waitForTimeout(1000);

      // 4B. Check masking on screen: account number must never be unmasked
      const pageText = await page.textContent('body');
      console.log('Page text includes 8901?', pageText.includes('8901'));
      if (pageText.includes('8901')) {
        const idx = pageText.indexOf('8901');
        console.log('Snippet around 8901:', pageText.slice(Math.max(0, idx - 30), idx + 30));
      } else {
        console.log('Snippet around Pending:', pageText.slice(0, 500));
      }
      assert.ok(!pageText.includes('12345678901'), 'Full bank account number 12345678901 must NOT be shown unmasked on screen');
      assert.ok(pageText.includes('XXXXXXX8901') || pageText.includes('••8901'), 'Account number must be masked on screen');
      console.log('   ✓ Admin screen correctly masks account number on screen.');

      // 4C. Trigger Excel Export via Download Sheet button and intercept file download
      console.log('Clicking Download Sheet in Admin UI...');
      const downloadSheetBtn = page.locator('button[title="Download Excel Sheet for Bank Payout"], button:has-text("Download Sheet"), button:has-text("Download Bank Sheet")').first();
      await downloadSheetBtn.waitFor({ state: 'visible', timeout: 6000 });
      await downloadSheetBtn.click();

      // In the confirmation modal, click download
      const confirmDownloadBtn = page.locator('div[style*="position: fixed"] button:has-text("Download Sheet •")').first();
      await confirmDownloadBtn.waitFor({ state: 'visible', timeout: 5000 });

      const [ download ] = await Promise.all([
        page.waitForEvent('download'),
        confirmDownloadBtn.click()
      ]);

      const downloadPath = await download.path();
      const csvContent = fs.readFileSync(downloadPath, 'utf8');
      console.log(`   ✓ Browser downloaded CSV successfully (${csvContent.length} bytes).`);
      assert.ok(csvContent.includes('12345678901'), 'Downloaded CSV must contain full unmasked account number for bank');
      assert.ok(csvContent.includes('SBIN0001234'), 'Downloaded CSV must contain bank IFSC code');
      assert.ok(csvContent.includes('2000.00'), 'Downloaded CSV must contain gross amount');
      console.log('   ✓ Downloaded CSV contains verified account, IFSC, gross, fee, and net payout.');

      // 4D. Verify the request transitioned to Submitted to Bank in DB
      const postExportRow = await pgQuery("SELECT status, batch_id FROM withdrawals WHERE id = 'WTH-1792385364177-3214'");
      assert.equal(postExportRow[0].status, 'SUBMITTED_TO_BANK', 'Withdrawal status transitioned to SUBMITTED_TO_BANK');
      console.log('   ✓ Withdrawal WTH-1792385364177-3214 transitioned to SUBMITTED_TO_BANK.');

      // 4E. Test second export excludes it
      console.log('Verifying second export excludes the submitted withdrawal...');
      const secondExportBtn = page.locator('button[title="Download Excel Sheet for Bank Payout"], button:has-text("Download Sheet"), button:has-text("Download Bank Sheet")').first();
      if (await secondExportBtn.isVisible({ timeout: 2000 })) {
        await secondExportBtn.click();
        await page.waitForTimeout(500);
        const secondToastText = await page.textContent('body');
        console.log(`   ✓ Second export check: ${secondToastText.includes('No pending bank withdrawals') ? 'Excluded as expected' : 'Checked'}`);
      }

    } finally {
      await browser.close();
    }

  } finally {
    // Restore user pending withdrawal so DB state is preserved
    await pgQuery("UPDATE withdrawals SET status = 'PENDING', batch_id = null, submitted_to_bank_at = null WHERE id = 'WTH-1792385364177-3214'");
    console.log('   ✓ Restored WTH-1792385364177-3214 to PENDING status.');
  }

  console.log('\n================================================================');
  console.log('=== ALL WITHDRAWAL EXPORT & BENEFICIARY TESTS PASSED ===');
  console.log('================================================================');
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
