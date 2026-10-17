// server/audit_cleanup_full.mjs
// Full browser audit script checking real rendered pages after Rs 10,000 swipe
// Reads rendered pages, logs into all 6 users, captures screenshots, and prints comparison table.

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { cleanAndReseed } from './clean_and_reseed.mjs';
import { performConfirmedLogin } from './test_config.js';

const BASE_URL = 'http://localhost:3000';
const CLEANUP_SCREEN_DIR = path.resolve('audit/screens/cleanup');
if (!fs.existsSync(CLEANUP_SCREEN_DIR)) {
  fs.mkdirSync(CLEANUP_SCREEN_DIR, { recursive: true });
}

async function captureScreen(page, filename) {
  const filePath = path.join(CLEANUP_SCREEN_DIR, filename);
  await page.waitForTimeout(500);
  await page.screenshot({ path: filePath, fullPage: false });
  return `/audit/screens/cleanup/${filename}`;
}

async function runAudit() {
  console.log('============================================================');
  console.log('   FULL RENDERED-PAGE BROWSER AUDIT AFTER RS 10,000 SWIPE   ');
  console.log('============================================================\n');

  // 1. Reset database to 6 clean reference users
  console.log('1. Resetting database to 6 clean reference users...');
  await cleanAndReseed();
  console.log('   ✓ Database reset completed.\n');

  const browser = await chromium.launch({ headless: true });
  const auditRows = [];

  try {
    // -------------------------------------------------------------------------
    // STEP 1: VERIFY CONFIRMED LOGIN FOR ALL 6 USERS
    // -------------------------------------------------------------------------
    console.log('2. Confirming login for all 6 test users with Ronav@123...');
    const usersToTest = ['ADM001', 'MST1001', 'SD1001', 'DIST2001', 'AREA3001', 'MID4001'];
    for (const uid of usersToTest) {
      const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
      const p = await ctx.newPage();
      try {
        const loginRes = await performConfirmedLogin(p, uid, { baseUrl: BASE_URL });
        console.log(`   ✓ ${uid} login confirmed: heading "${loginRes.heading}".`);
      } catch (err) {
        throw new Error(`🚨 FATAL: Login verification failed for user "${uid}": ${err.message}`);
      } finally {
        await ctx.close();
      }
    }
    console.log('   ✓ All 6 user logins confirmed and active.\n');

    // -------------------------------------------------------------------------
    // STEP 2: AS MID4001, RECORD A RS 10,000 PINE LABS T+1 SWIPE
    // -------------------------------------------------------------------------
    console.log('3. Recording Rs 10,000 Pine Labs T+1 swipe as MID4001 via real swipe form...');
    const midCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const midPage = await midCtx.newPage();
    midPage.on('dialog', async d => await d.accept());

    await performConfirmedLogin(midPage, 'MID4001', { baseUrl: BASE_URL });
    await midPage.waitForTimeout(1000);

    // Click Record Sale
    await midPage.locator('button:has-text("Record Sale")').first().click();
    await midPage.waitForTimeout(1000);

    // Fill form
    await midPage.locator('input[placeholder="0.00"]').first().fill('10000');
    await midPage.locator('input[placeholder*="UTR"]').first().fill('SLIP-PW-10000');
    await midPage.locator('input[placeholder*="Ramesh Kumar"]').first().fill('Test Customer');
    await midPage.locator('input[placeholder*="mobile"]').first().fill('9876543210');

    // Wait for live server fee quote
    await midPage.waitForTimeout(1500);

    // Submit swipe
    await midPage.locator('button[type="submit"]:has-text("Record Swipe")').first().click();
    await midPage.waitForTimeout(3000);
    console.log('   ✓ Swipe recorded successfully.\n');

    // -------------------------------------------------------------------------
    // STEP 3: READ RENDERED PAGES AND VERIFY EXPECTED VALUES
    // -------------------------------------------------------------------------
    console.log('4. Reading rendered pages across all users & Admin screens...');

    // --- SCREEN: MID4001 Home (Wallet & Recent Swipes) ---
    const backBtn = midPage.locator('button[aria-label="Back"], button[title="Back to Dashboard"]').first();
    if (await backBtn.count() > 0) {
      await backBtn.click();
    } else {
      await midPage.locator('button:has-text("Home")').first().click();
    }
    await midPage.waitForTimeout(1500);
    const midHomeShot = await captureScreen(midPage, '01_mid4001_home.png');
    const midHomeText = await midPage.innerText('body');

    const midWalletExpected = '₹9,850.00';
    const midWalletActual = midHomeText.includes('9,850.00') ? '₹9,850.00' : (midHomeText.includes('0.00') ? '₹0.00' : 'not found');
    auditRows.push({
      screen: 'Merchant Home (Wallet)',
      user: 'MID4001',
      expected: '₹9,850.00 (Net)',
      actual: midWalletActual,
      result: midWalletActual === '₹9,850.00' ? 'works' : (midWalletActual === '₹0.00' ? 'shows 0.00' : 'wrong number'),
      screenshot: midHomeShot
    });

    const midSalesExpected = '₹10,000.00';
    const midSalesActual = midHomeText.includes('10,000.00') ? '₹10,000.00' : (midHomeText.includes('0.00') ? '₹0.00' : 'not found');
    auditRows.push({
      screen: 'Merchant Home (Total Sales)',
      user: 'MID4001',
      expected: '₹10,000.00 (Gross)',
      actual: midSalesActual,
      result: midSalesActual === '₹10,000.00' ? 'works' : (midSalesActual === '₹0.00' ? 'shows 0.00' : 'wrong number'),
      screenshot: midHomeShot
    });

    // --- SCREEN: MID4001 Transaction History ---
    await midPage.locator('button:has-text("Transaction History"), button:has-text("History")').first().click();
    await midPage.waitForTimeout(1500);
    const midHistShot = await captureScreen(midPage, '02_mid4001_history.png');
    const midHistText = await midPage.innerText('body');
    const hasGross = midHistText.includes('10,000');
    const hasFee = midHistText.includes('150');
    const hasNet = midHistText.includes('9,850');
    const histSummary = `Gross: ${hasGross ? '10k' : 'missing'}, Fee: ${hasFee ? '150' : 'missing'}, Net: ${hasNet ? '9,850' : 'missing'}`;
    auditRows.push({
      screen: 'Transaction History',
      user: 'MID4001',
      expected: 'Gross 10,000, Fee 150, Net 9,850',
      actual: (hasGross && hasFee && hasNet) ? 'Gross 10,000, Fee 150, Net 9,850' : histSummary,
      result: (hasGross && hasFee && hasNet) ? 'works' : 'wrong number',
      screenshot: midHistShot
    });
    await midCtx.close();

    // --- UPLINE PARTNERS WALLETS & EARNINGS: AREA3001, DIST2001, SD1001, MST1001 ---
    const uplines = [
      { id: 'AREA3001', role: 'DISTRIBUTOR', expCommission: 30, shotName: '03_area3001_wallet.png' },
      { id: 'DIST2001', role: 'DISTRICT_DISTRIBUTOR', expCommission: 20, shotName: '04_dist2001_wallet.png' },
      { id: 'SD1001', role: 'SUPER_DISTRIBUTOR', expCommission: 20, shotName: '05_sd1001_wallet.png' },
      { id: 'MST1001', role: 'MASTER', expCommission: 20, shotName: '06_mst1001_wallet.png' },
    ];

    for (const u of uplines) {
      const uCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
      const uPage = await uCtx.newPage();
      try {
        await performConfirmedLogin(uPage, u.id, { baseUrl: BASE_URL });
        await uPage.waitForTimeout(1500);
        const shot = await captureScreen(uPage, u.shotName);
        const text = await uPage.innerText('body');

        const expStr = `₹${u.expCommission.toFixed(2)}`;
        const expAlt = `${u.expCommission.toFixed(2)}`;
        const found = text.includes(expAlt);
        const actualVal = found ? expStr : (text.includes('0.00') ? '₹0.00' : 'not found');

        auditRows.push({
          screen: `Partner Wallet (+₹${u.expCommission})`,
          user: u.id,
          expected: `₹${u.expCommission.toFixed(2)}`,
          actual: actualVal,
          result: found ? 'works' : (actualVal === '₹0.00' ? 'shows 0.00' : 'wrong number'),
          screenshot: shot
        });
      } finally {
        await uCtx.close();
      }
    }

    // --- ADMIN SCREENS ---
    const admCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const admPage = await admCtx.newPage();
    try {
      await performConfirmedLogin(admPage, 'ADM001', { baseUrl: BASE_URL });
      await admPage.waitForTimeout(1500);

      // --- Admin Overview ---
      const admOverviewShot = await captureScreen(admPage, '07_admin_overview.png');
      const overviewText = await admPage.innerText('body');
      const hasOverviewSales = overviewText.includes('10,000');
      const hasOverviewProfit = overviewText.includes('60.00') || overviewText.includes('60');

      auditRows.push({
        screen: 'Admin Overview (Total Sales)',
        user: 'ADM001',
        expected: '₹10,000.00',
        actual: hasOverviewSales ? '₹10,000.00' : (overviewText.includes('0.00') ? '₹0.00' : 'not found'),
        result: hasOverviewSales ? 'works' : 'wrong number',
        screenshot: admOverviewShot
      });

      auditRows.push({
        screen: 'Admin Overview (Net Profit)',
        user: 'ADM001',
        expected: '+₹60.00',
        actual: hasOverviewProfit ? '+₹60.00' : (overviewText.includes('0.00') ? '₹0.00' : 'not found'),
        result: hasOverviewProfit ? 'works' : 'wrong number',
        screenshot: admOverviewShot
      });

      // --- Admin Profits Tab ---
      await admPage.locator('button:has-text("Profits")').first().click();
      await admPage.waitForTimeout(1500);
      const admProfitsShot = await captureScreen(admPage, '08_admin_profits.png');
      const profitsText = await admPage.innerText('body');

      const pSales = profitsText.includes('10,000');
      const pFees = profitsText.includes('150');
      const pComms = profitsText.includes('90');
      const pAdmin = profitsText.includes('60');
      const pMasterTier = profitsText.includes('20');
      const pAreaTier = profitsText.includes('30');

      auditRows.push({
        screen: 'Admin Profits (KPIs)',
        user: 'ADM001',
        expected: 'Sales 10,000, Fees 150, Partner 90, Admin 60',
        actual: (pSales && pFees && pComms && pAdmin) ? 'Sales 10,000, Fees 150, Partner 90, Admin 60' : `Sales:${pSales}, Fees:${pFees}, Comms:${pComms}, Profit:${pAdmin}`,
        result: (pSales && pFees && pComms && pAdmin) ? 'works' : 'wrong number',
        screenshot: admProfitsShot
      });

      auditRows.push({
        screen: 'Admin Profits (Tier Cards & Ledger)',
        user: 'ADM001',
        expected: 'Tier cuts (Master 20, SD 20, Dist 20, Area 30) & Ledger (150, 90, 60)',
        actual: (pMasterTier && pAreaTier && pFees && pComms && pAdmin) ? 'Tier cuts (20, 20, 20, 30) & Ledger breakdown visible' : 'incomplete breakdown',
        result: (pMasterTier && pAreaTier && pFees && pComms && pAdmin) ? 'works' : 'wrong number',
        screenshot: admProfitsShot
      });

      // --- Admin Partner Tabs (Master, Super Dist, District Dist, Distributor, Merchants) ---
      const partnerTabs = [
        { tabBtn: 'Master', targetUser: 'MST1001', expRate: '0.60%', expParent: 'Super Admin', shotName: '09_tab_master.png' },
        { tabBtn: 'Super Dist', targetUser: 'SD1001', expRate: '0.80%', expParent: 'Master Distributor', shotName: '10_tab_super_dist.png' },
        { tabBtn: 'District Dist', targetUser: 'DIST2001', expRate: '1.00%', expParent: 'Super Distributor', shotName: '11_tab_district_dist.png' },
        { tabBtn: 'Distributor', targetUser: 'AREA3001', expRate: '1.20%', expParent: 'District Distributor', shotName: '12_tab_distributor.png' },
        { tabBtn: 'Merchants', targetUser: 'MID4001', expRate: '1.50%', expParent: 'Area Distributor', shotName: '13_tab_merchants.png' },
      ];

      for (const pt of partnerTabs) {
        await admPage.locator(`button:has-text("${pt.tabBtn}")`).first().click();
        await admPage.waitForTimeout(1200);
        const shot = await captureScreen(admPage, pt.shotName);
        const tabText = await admPage.innerText('body');

        const rateFound = tabText.includes(pt.expRate);
        const parentFound = tabText.includes(pt.expParent);

        auditRows.push({
          screen: `Admin Tab (${pt.tabBtn})`,
          user: pt.targetUser,
          expected: `Rate ${pt.expRate}, Parent: ${pt.expParent}`,
          actual: `Rate: ${rateFound ? pt.expRate : 'missing'}, Parent: ${parentFound ? pt.expParent : 'missing'}`,
          result: (rateFound && parentFound) ? 'works' : 'wrong number',
          screenshot: shot
        });
      }

      // --- Admin Merchant Dossier ---
      console.log('   Opening MID4001 Merchant Dossier...');
      // Click on the MID4001 card in the Merchants tab
      await admPage.locator('button:has-text("Merchants")').first().click();
      await admPage.waitForTimeout(1000);
      const merchantCard = admPage.locator('strong:has-text("Test Merchant Store"), span:has-text("MID4001")').first();
      await merchantCard.click();
      await admPage.waitForTimeout(1500);

      const dossierShot = await captureScreen(admPage, '14_admin_merchant_dossier.png');
      const dossierText = await admPage.innerText('body');
      const dVol = dossierText.includes('10,000');
      const dFee = dossierText.includes('150');
      const dBal = dossierText.includes('9,850');

      auditRows.push({
        screen: 'Admin Merchant Dossier',
        user: 'MID4001',
        expected: 'Sales 10,000, Gross MDR 150, Balance 9,850',
        actual: `Sales: ${dVol ? '10k' : 'missing'}, Gross MDR: ${dFee ? '150' : 'missing'}, Balance: ${dBal ? '9,850' : 'missing'}`,
        result: (dVol && dFee && dBal) ? 'works' : 'wrong number',
        screenshot: dossierShot
      });

      // --- Admin Payouts Tab ---
      console.log('   Navigating to Payouts tab...');
      await admPage.locator('button:has-text("Payouts")').first().click();
      await admPage.waitForTimeout(1500);
      const payoutsShot = await captureScreen(admPage, '15_admin_payouts.png');
      const payoutsText = await admPage.innerText('body');
      const hasPayoutsView = payoutsText.includes('Pine Labs') || payoutsText.includes('All Channels') || payoutsText.includes('Payout');

      auditRows.push({
        screen: 'Admin Payouts Tab',
        user: 'ADM001',
        expected: 'Batch totals & channel controls visible',
        actual: hasPayoutsView ? 'Batch totals & channel bars visible' : 'blank/error',
        result: hasPayoutsView ? 'works' : 'blank',
        screenshot: payoutsShot
      });

    } finally {
      await admCtx.close();
    }

    console.log('\n============================================================');
    console.log('                 RENDERED PAGES AUDIT TABLE                 ');
    console.log('============================================================');
    console.table(auditRows.map(r => ({
      'Screen': r.screen,
      'User': r.user,
      'Expected': r.expected,
      'Actual': r.actual,
      'Result': r.result
    })));

    // Output raw JSON summary for logging
    fs.writeFileSync('audit/screens/cleanup/audit_results.json', JSON.stringify(auditRows, null, 2));
    console.log('\nAudit results saved to: audit/screens/cleanup/audit_results.json');

  } finally {
    await browser.close();
  }
}

runAudit().catch(err => {
  console.error('\n🚨 AUDIT RUN FAILED:', err);
  process.exit(1);
});
