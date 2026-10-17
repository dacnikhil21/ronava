import assert from 'assert/strict';
import { chromium } from 'playwright';
import { cleanAndReseed } from './clean_and_reseed.mjs';
import { processSwipeTransaction } from './transaction_engine.js';
import { getDbPool } from './pg_db.js';
import { performConfirmedLogin } from './test_config.js';

async function runPlaywrightTest() {
  console.log('=== PLAYWRIGHT BROWSER VERIFICATION: REJECT AS ADM001 ===');

  // 1. Clean & reseed database with 6 reference users
  await cleanAndReseed();

  // 2. Insert test swipe of Rs 10,000 as MID4001
  const pool = getDbPool();
  const client = await pool.connect();
  let txnId;
  try {
    const swipe = await processSwipeTransaction(client, {
      merchantId: 'MID4001',
      amountPaise: 1000000n, // Rs 10,000
      channel: 'pinelabs',
      settlementMode: 'T1',
      notes: 'Pine Labs POS Swipe for Playwright Test',
      refNumber: 'REF-PW-10K',
      terminalId: 'POS-MID4001-01',
      createdBy: 'MID4001'
    });
    txnId = swipe.id;
    console.log('1. Created transaction for browser test:', txnId);
  } finally {
    client.release();
  }

  // 3. Launch Playwright Chromium
  console.log('2. Launching headless Chromium browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Automatically accept window.confirm dialogs
    page.on('dialog', async (dialog) => {
      console.log(`   [Browser Dialog] Type: ${dialog.type()}, Message: ${dialog.message().slice(0, 60)}...`);
      await dialog.accept();
      console.log('   [Browser Dialog] Confirmed and accepted.');
    });

    // 4. Navigate to admin login
    // 4. Log in as ADM001 using canonical confirmed login
    await performConfirmedLogin(page, 'ADM001');

    // 5. Navigate to Payouts tab
    console.log('5. Navigating to Payouts tab...');
    const payoutsTab = page.locator('button:has-text("Payouts"), [data-tab="payouts"]');
    if (await payoutsTab.count() > 0) {
      await payoutsTab.first().click();
    } else {
      // Direct click on tab header
      await page.click('text=Payouts');
    }
    await page.waitForTimeout(1500);

    // 6. Locate and click Reject button
    console.log('6. Locating Reject button for transaction...');
    const rejectBtn = page.locator('button[title="Reject this payment"], button:has-text("✕ Reject")').first();
    await rejectBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('   Clicking ✕ Reject button...');
    await rejectBtn.click();

    // Wait for API response and reversal to settle
    console.log('7. Waiting for transaction rejection to process...');
    await page.waitForTimeout(2500);

    // 7. Verify in database financial_ledger that created_by is strictly ADM001
    console.log('8. Inspecting database financial_ledger for reversing entries...');
    const ledgerRows = await pool.query(
      `SELECT type, amount_paise, created_by FROM financial_ledger WHERE reference_id = $1 ORDER BY id DESC`,
      [txnId]
    );

    console.log(`   Found ${ledgerRows.rows.length} total ledger rows for ${txnId}.`);
    const reversalRows = ledgerRows.rows.filter(r => r.type.includes('reversal') || r.created_by === 'ADM001');
    assert.ok(reversalRows.length > 0, 'Must have recorded reversing ledger entries');

    for (const r of reversalRows) {
      assert.equal(r.created_by, 'ADM001', `Actor must be ADM001, got ${r.created_by}`);
    }
    console.log('   ✓ Verified all reversal entries were created with created_by = ADM001');

    // Verify transaction status in transactions table
    const txnCheck = await pool.query(`SELECT status FROM transactions WHERE id = $1`, [txnId]);
    assert.equal(txnCheck.rows[0]?.status, 'REVERSED', `Transaction status must be REVERSED, got ${txnCheck.rows[0]?.status}`);
    console.log('   ✓ Verified transaction status in transactions table is REVERSED');

    console.log('\n🎉 PLAYWRIGHT BROWSER TEST PASSED SUCCESSFULLY!');
  } finally {
    await browser.close();
    await pool.end();
  }
}

runPlaywrightTest().catch(err => {
  console.error('PLAYWRIGHT TEST FAILED:', err);
  process.exit(1);
});
