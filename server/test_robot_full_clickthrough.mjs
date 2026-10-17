import { chromium } from 'playwright';
import { cleanAndReseed } from './clean_and_reseed.mjs';
import { getDbPool, withTransaction } from './pg_db.js';
import { processSwipeTransaction } from './transaction_engine.js';
import { ORDERED_TEST_USERS, performConfirmedLogin } from './test_config.js';

const APP_URL = 'http://localhost:3000';
const USERS = ORDERED_TEST_USERS;

async function seedInitialTransaction() {
  console.log('Seeding initial Rs 10,000 transaction for MID4001 with upline distributions...');
  await withTransaction(async (client) => {
    // Insert beneficiary for MID4001 so payouts/withdrawals don't error
    await client.query(`
      INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified, is_primary)
      VALUES ('BEN_MID4001_01', 'MID4001', 'HDFC Bank', '50100492817291', 'HDFC0001234', 'Test Merchant Store', true, true)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Process Rs 10,000 Pine Labs swipe
    await processSwipeTransaction(client, {
      merchantId: 'MID4001',
      amountPaise: 1000000n, // 10,000 INR
      channel: 'pinelabs',
      settlementMode: 'T1',
      refNumber: 'REF-ROBOT-001',
      slipNumber: 'SLIP-001',
      notes: 'Playwright Robot Test Swipe',
      createdBy: 'MID4001'
    });
  });
  console.log('✓ Initial transaction seeded.');
}

async function runRobotAudit() {
  console.log('=== STARTING PLAYWRIGHT FULL ROBOT CLICK-THROUGH FOR ALL 6 USERS ===');

  await cleanAndReseed();
  await seedInitialTransaction();

  const browser = await chromium.launch({ headless: true });
  const report = [];

  for (const user of USERS) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`▶ Testing User: ${user.id} (${user.role})`);
    console.log(`------------------------------------------------------------`);

    const context = await browser.newContext();
    const page = await context.newPage();

    // Bypass splash screen
    await page.addInitScript(() => {
      sessionStorage.setItem('ronav_splash_seen', 'true');
    });

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('Failed to load resource')) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('pageerror', err => {
      consoleErrors.push(`Uncaught: ${err.message}`);
    });

    try {
      const loginConfirmation = await performConfirmedLogin(page, user.id, { baseUrl: APP_URL });
      console.log(`  ✓ Confirmed login for ${user.id} (${loginConfirmation.heading})`);

      // Discover navigation tabs/buttons
      let tabElements = [];
      if (user.role === 'ADMIN') {
        tabElements = await page.$$eval('button', els => {
          return els
            .map(e => e.innerText.trim().replace(/\n+/g, ' '))
            .filter(t => [
              'Overview', 'Master Distributors', 'Super Distributors', 
              'District Distributors', 'Distributors', 'Merchants', 
              'Payouts', 'Loans', 'Franchises', 'Profits'
            ].some(valid => t.toLowerCase().includes(valid.toLowerCase())));
        });
      } else {
        tabElements = await page.$$eval('button', els => {
          return els
            .map(e => e.innerText.trim().replace(/\n+/g, ' '))
            .filter(t => [
              'Home', 'Wallet', 'Payout', 'History', 'Passbook', 'Network', 'Downline', 'Profile', 'BBPS'
            ].some(valid => t.toLowerCase().includes(valid.toLowerCase())));
        });
      }

      // Default tabs fallback
      const defaultTabs = user.role === 'ADMIN'
        ? ['Overview', 'Master Distributors', 'Super Distributors', 'District Distributors', 'Distributors', 'Merchants', 'Payouts', 'Profits']
        : ['Home', 'Wallet', 'Passbook', 'Profile'];

      const uniqueTabs = Array.from(new Set([...tabElements, ...defaultTabs])).filter(t => t && t.length < 35);
      console.log(`  Found ${uniqueTabs.length} tabs to verify: ${uniqueTabs.join(', ')}`);

      for (const tabName of uniqueTabs) {
        // Attempt clicking tab
        try {
          const tabBtn = page.locator(`button:has-text("${tabName}")`).first();
          if (await tabBtn.isVisible()) {
            await tabBtn.click({ timeout: 3000 });
            await page.waitForTimeout(800);
          }
        } catch (_) {}

        // Scan current view for:
        // 1. Red error alerts
        const redErrors = await page.$$eval('.error-banner, [role="alert"], .alert-danger, .error-message, .banner-error', els => {
          return els.filter(e => e.offsetParent !== null).map(e => e.innerText.trim().replace(/\n+/g, ' '));
        });

        // 2. Metric items displaying 0.00
        const zeroValues = await page.$$eval('*', els => {
          const zeros = [];
          for (const e of els) {
            if (e.children.length === 0 && e.offsetParent !== null) {
              const text = e.innerText?.trim();
              if (text === '₹0.00' || text === 'Rs 0.00' || text === '0.00' || text === '₹0') {
                const parent = e.parentElement ? e.parentElement.innerText.trim().replace(/\n+/g, ' ') : '';
                if (parent.length > 3 && parent.length < 70 && !zeros.includes(parent)) {
                  zeros.push(parent);
                }
              }
            }
          }
          return zeros.slice(0, 4);
        });

        report.push({
          user: user.id,
          role: user.role,
          tab: tabName,
          redErrors: redErrors.length > 0 ? redErrors.join('; ') : 'None',
          zeroAmounts: zeroValues.length > 0 ? zeroValues.join(' | ') : 'None',
          consoleErrorsCount: consoleErrors.length
        });
      }

    } catch (err) {
      console.error(`  Error during test for user ${user.id}:`, err.message);
      report.push({
        user: user.id,
        role: user.role,
        tab: 'LOGIN_OR_DASHBOARD_ERROR',
        redErrors: err.message.slice(0, 80),
        zeroAmounts: 'N/A',
        consoleErrorsCount: consoleErrors.length
      });
    } finally {
      await context.close();
    }
  }

  await browser.close();

  console.log('\n==============================================================================');
  console.log('                    PLAYWRIGHT ROBOT AUDIT RESULTS TABLE                      ');
  console.log('==============================================================================');
  console.table(report.map(r => ({
    User: `${r.user} (${r.role})`,
    Tab: r.tab,
    'Red Error': r.redErrors === 'None' ? '✅ None' : `❌ ${r.redErrors.slice(0, 30)}...`,
    'Showing Rs 0.00': r.zeroAmounts === 'None' ? '✅ Active Balance' : `⚠️ ${r.zeroAmounts.slice(0, 40)}...`
  })));

  console.log('\n--- DETAILED JSON REPORT ---');
  console.log(JSON.stringify(report, null, 2));
}

runRobotAudit().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Robot audit failed:', err);
  process.exit(1);
});
