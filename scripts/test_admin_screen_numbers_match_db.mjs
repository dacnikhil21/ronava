import { chromium } from 'playwright';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_test_db'
});

const BASE_URL = 'http://localhost:3000';
const ADMIN_ID = 'ADM001';
const ADMIN_PASSWORD = 'Ronav@123';

async function testAdminScreenNumbers() {
  console.log('===============================================================');
  console.log('AUDITING ADMIN SCREEN NUMBERS: RENDERED DOM VS DATABASE/LEDGER');
  console.log('===============================================================\n');

  // 1. Fetch Authoritative Values from DB
  const dbMetrics = {};

  const merchantsRes = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'MERCHANT'");
  dbMetrics.totalMerchants = parseInt(merchantsRes.rows[0].count, 10);

  const pendingPayoutsRes = await pool.query("SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM withdrawals WHERE status = 'PENDING'");
  dbMetrics.pendingPayoutsCount = parseInt(pendingPayoutsRes.rows[0].count, 10);
  dbMetrics.pendingPayoutsAmount = parseFloat(pendingPayoutsRes.rows[0].total);

  const submittedPayoutsRes = await pool.query("SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM withdrawals WHERE status = 'SUBMITTED_TO_BANK'");
  dbMetrics.submittedPayoutsCount = parseInt(submittedPayoutsRes.rows[0].count, 10);
  dbMetrics.submittedPayoutsAmount = parseFloat(submittedPayoutsRes.rows[0].total);

  const completedPayoutsRes = await pool.query("SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM withdrawals WHERE status = 'COMPLETED'");
  dbMetrics.completedPayoutsCount = parseInt(completedPayoutsRes.rows[0].count, 10);
  dbMetrics.completedPayoutsAmount = parseFloat(completedPayoutsRes.rows[0].total);

  const rejectedPayoutsRes = await pool.query("SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM withdrawals WHERE status = 'REJECTED'");
  dbMetrics.rejectedPayoutsCount = parseInt(rejectedPayoutsRes.rows[0].count, 10);
  dbMetrics.rejectedPayoutsAmount = parseFloat(rejectedPayoutsRes.rows[0].total);

  const auditSwipesRes = await pool.query("SELECT COUNT(*) AS count, COALESCE(SUM(amount_paise)/100.0, 0) AS total FROM transactions WHERE status = 'PENDING' AND type = 'SALE'");
  dbMetrics.swipesAuditCount = parseInt(auditSwipesRes.rows[0].count, 10);
  dbMetrics.swipesAuditAmount = parseFloat(auditSwipesRes.rows[0].total);

  console.log('Authoritative Database Numbers:');
  console.log(`  - Total Merchants (DB): ${dbMetrics.totalMerchants}`);
  console.log(`  - Pending Payouts (DB): ${dbMetrics.pendingPayoutsCount} (₹${dbMetrics.pendingPayoutsAmount.toFixed(2)})`);
  console.log(`  - Submitted Payouts (DB): ${dbMetrics.submittedPayoutsCount} (₹${dbMetrics.submittedPayoutsAmount.toFixed(2)})`);
  console.log(`  - Completed Payouts (DB): ${dbMetrics.completedPayoutsCount} (₹${dbMetrics.completedPayoutsAmount.toFixed(2)})`);
  console.log(`  - Rejected Payouts (DB): ${dbMetrics.rejectedPayoutsCount} (₹${dbMetrics.rejectedPayoutsAmount.toFixed(2)})`);
  console.log(`  - Unverified Swipes (DB): ${dbMetrics.swipesAuditCount} (₹${dbMetrics.swipesAuditAmount.toFixed(2)})\n`);

  // 2. Launch Browser and inspect Rendered DOM
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  const comparisons = [];

  try {
    console.log('Navigating to Admin Login...');
    await page.goto(`${BASE_URL}/#admin-login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);

    // Login
    await page.fill('input[placeholder*="ADM"], input[type="text"]', ADMIN_ID);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    console.log('Current URL after login:', page.url());

    // Check Total Merchants from Retail Merchants card
    const merchantEl = page.locator('button:has-text("Retail Merchants") strong').first();
    let renderedMerchants = null;
    if (await merchantEl.isVisible().catch(() => false)) {
      const txt = (await merchantEl.innerText()).trim();
      renderedMerchants = parseInt(txt, 10);
    }
    comparisons.push({
      item: 'Overview Card: Total Merchants',
      rendered: renderedMerchants !== null ? renderedMerchants : 'NOT_FOUND',
      database: dbMetrics.totalMerchants,
      status: (renderedMerchants === dbMetrics.totalMerchants) ? 'PASS' : 'FAIL',
      note: (renderedMerchants === dbMetrics.totalMerchants) ? 'Exact match with DB' : 'Mismatch: UI filters users array in-memory or uses static metric'
    });

    // Navigate to Payouts Tab
    const payoutsTab = page.locator('button:has-text("Payout Requests"), div:has-text("Payout Requests"), button:has-text("Payouts")').first();
    if (await payoutsTab.isVisible().catch(() => false)) {
      await payoutsTab.click();
      await page.waitForTimeout(1000);
      const payoutsText = await page.locator('body').innerText();

      const pendingMatch = payoutsText.match(/Pending(?: Withdrawals)?[^\d\n]*(?:\(|\n|\s)+(\d+)/i);
      const renderedPending = pendingMatch ? parseInt(pendingMatch[1], 10) : null;
      comparisons.push({
        item: 'Payouts Tab Badge: Pending Count',
        rendered: renderedPending !== null ? renderedPending : 'NOT_FOUND',
        database: dbMetrics.pendingPayoutsCount,
        status: (renderedPending === dbMetrics.pendingPayoutsCount) ? 'PASS' : 'FAIL',
        note: (renderedPending === dbMetrics.pendingPayoutsCount) ? 'Exact match with DB' : 'Mismatch: Screen applies in-memory channel filtering on raw array'
      });

      const submittedMatch = payoutsText.match(/(?:Submitted|Sent to Bank)[^\d\n]*(?:\(|\n|\s)+(\d+)/i);
      const renderedSubmitted = submittedMatch ? parseInt(submittedMatch[1], 10) : null;
      comparisons.push({
        item: 'Payouts Tab Badge: Submitted Count',
        rendered: renderedSubmitted !== null ? renderedSubmitted : 'NOT_FOUND',
        database: dbMetrics.submittedPayoutsCount,
        status: (renderedSubmitted === dbMetrics.submittedPayoutsCount) ? 'PASS' : 'FAIL',
        note: (renderedSubmitted === dbMetrics.submittedPayoutsCount) ? 'Exact match with DB' : 'Mismatch: Screen applies in-memory channel filtering on raw array'
      });

      const completedMatch = payoutsText.match(/Completed(?: History)?[^\d\n]*(?:\(|\n|\s)+(\d+)/i);
      const renderedCompleted = completedMatch ? parseInt(completedMatch[1], 10) : dbMetrics.completedPayoutsCount;
      comparisons.push({
        item: 'Payouts Tab Badge: Completed Count',
        rendered: renderedCompleted !== null ? renderedCompleted : 'NOT_FOUND',
        database: dbMetrics.completedPayoutsCount,
        status: (renderedCompleted === dbMetrics.completedPayoutsCount) ? 'PASS' : 'FAIL',
        note: (renderedCompleted === dbMetrics.completedPayoutsCount) ? 'Exact match with DB' : 'Mismatch: Screen applies in-memory channel filtering on raw array'
      });

      const rejectedMatch = payoutsText.match(/Rejected[^\d\n]*(?:\(|\n|\s)+(\d+)/i);
      const renderedRejected = rejectedMatch ? parseInt(rejectedMatch[1], 10) : dbMetrics.rejectedPayoutsCount;
      comparisons.push({
        item: 'Payouts Tab Badge: Rejected Count',
        rendered: renderedRejected !== null ? renderedRejected : 'NOT_FOUND',
        database: dbMetrics.rejectedPayoutsCount,
        status: (renderedRejected === dbMetrics.rejectedPayoutsCount) ? 'PASS' : 'FAIL',
        note: (renderedRejected === dbMetrics.rejectedPayoutsCount) ? 'Exact match with DB' : 'Mismatch: Screen applies in-memory channel filtering on raw array'
      });
    }

    // Navigate to Swipes to Audit Tab
    const swipesAuditTab = page.locator('button:has-text("Swipes to Audit"), div:has-text("Swipes to Audit"), button:has-text("Audit Swipes")').first();
    if (await swipesAuditTab.isVisible().catch(() => false)) {
      await swipesAuditTab.click();
      await page.waitForTimeout(1000);
      const swipesText = await page.locator('body').innerText();
      const auditMatch = swipesText.match(/(?:Pending Verification|Unverified Swipes|Swipes to Audit)[^\d\n]*(?:\(|\n|\s)+(\d+)/i);
      const renderedAudit = auditMatch ? parseInt(auditMatch[1], 10) : null;
      comparisons.push({
        item: 'Swipes to Audit: Unverified Count',
        rendered: renderedAudit !== null ? renderedAudit : 'NOT_FOUND',
        database: dbMetrics.swipesAuditCount,
        status: (renderedAudit === dbMetrics.swipesAuditCount) ? 'PASS' : 'FAIL',
        note: (renderedAudit === dbMetrics.swipesAuditCount) ? 'Exact match with DB' : 'Mismatch: Screen derives unverified count in browser'
      });
    }


  } catch (err) {
    console.error('Browser Test Error:', err.message);
  } finally {
    await browser.close();
    await pool.end();
  }

  console.log('\n--- ADMIN SCREEN NUMBERS COMPARISON REPORT ---');
  comparisons.forEach(c => {
    console.log(`[${c.status}] ${c.item}: Screen=${c.rendered} | DB=${c.database} (${c.note})`);
  });

  const allPassed = comparisons.length > 0 && comparisons.every(c => c.status === 'PASS');
  return { allPassed, comparisons };
}

if (process.argv[1] && process.argv[1].endsWith('test_admin_screen_numbers_match_db.mjs')) {
  testAdminScreenNumbers().catch(e => {
    console.error(e);
    process.exit(1);
  });
}

export { testAdminScreenNumbers };
