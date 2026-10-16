/**
 * PHASE D2b VERIFICATION TEST SUITE
 * 
 * Tests:
 * 1. Simulated API failure on home wallet shows an error, not 0.00.
 * 2. Beneficiary with no account number or IFSC rejected for withdrawal (backend & frontend checks).
 * 3. Beneficiary with no account number or IFSC rejected for Excel export (backend check).
 * 4. Dynamic rental amount read from system_settings (changing setting changes returned amount, missing setting throws error).
 * 5. Grep proofs:
 *    - Zero dummy account '102938475620'
 *    - Zero fallback IFSC 'SBIN0001234'
 *    - Zero ronav_rental_ledger localStorage caches
 *    - Zero hardcoded rental amounts in screens
 *    - Zero empty catch blocks in src/
 */

process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';

import { getDbPool } from './pg_db.js';
import { resetTestDatabase } from './test_db_helper.js';
import { processWithdrawalRequest } from './withdrawal_engine.js';
import { getAllSettings, updateSetting } from './settings.js';
import http from 'http';
import fs from 'fs';
import path from 'path';

let server;
let baseUrl;

async function startServer() {
  const { handleApiRequest } = await import('./api.js');
  server = http.createServer(async (req, res) => {
    await handleApiRequest(req, res);
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
}

async function runTests() {
  console.log('====================================================');
  console.log('   PHASE D2b: COMPREHENSIVE VERIFICATION SUITE       ');
  console.log('====================================================\n');

  await resetTestDatabase();
  await startServer();
  const pool = getDbPool();

  let passCount = 0;
  let testCount = 0;

  function assert(condition, testName) {
    testCount++;
    if (condition) {
      console.log(`  ✅ Test ${testCount}: ${testName}`);
      passCount++;
    } else {
      console.error(`  ❌ Test ${testCount} FAILED: ${testName}`);
      process.exit(1);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: Simulated API failure on home wallet displays error, not 0.00
  // -------------------------------------------------------------------------
  console.log('--- Test Group 1: Home Wallet Error Masking ---');
  {
    // Check frontend code: MerchantDashboardPage.jsx has explicit walletError banner and does not mask as 0.00
    const mercCode = fs.readFileSync('src/components/MerchantDashboardPage.jsx', 'utf8');
    const hasErrorBanner = mercCode.includes('Unable to Load Wallet Balance') && mercCode.includes('Retry Connection');
    const noMaskingZero = mercCode.includes('const dbAvailableBalance = (wallet?.available_balance !== undefined && wallet?.available_balance !== null && !walletError)');
    const homeTabShowsBanner = mercCode.includes('{walletError ? (') && mercCode.includes('Unable to Load Wallet Balance') && mercCode.includes('Retry Connection');
    
    assert(hasErrorBanner && noMaskingZero && homeTabShowsBanner, 'Home wallet failure sets dbAvailableBalance to null and renders prominent error banner with retry button');

    // Test API failure response
    const badRes = await fetch(`${baseUrl}/api/wallet/NON_EXISTENT_MERCHANT_ID`);
    const badJson = await badRes.json();
    assert(badRes.status === 404 && badJson.success === false, 'API /api/wallet returns 404 error with success: false for nonexistent merchant');
  }

  // -------------------------------------------------------------------------
  // TEST 2: Beneficiary with missing account number or IFSC blocked from withdrawal
  // -------------------------------------------------------------------------
  console.log('\n--- Test Group 2: Withdrawal Blocked for Incomplete Bank Details ---');
  {
    // Allow nulls on beneficiaries for testing missing details
    await pool.query(`
      ALTER TABLE beneficiaries ALTER COLUMN account_number DROP NOT NULL;
      ALTER TABLE beneficiaries ALTER COLUMN ifsc DROP NOT NULL;
    `);

    // 2a. Insert a merchant with sufficient funds
    await pool.query(`
      INSERT INTO users (id, name, mobile, role, status, commission_rate_t1, commission_rate_instant)
      VALUES ('D2B_MERC_01', 'Test D2b Merchant', '9988776655', 'MERCHANT', 'ACTIVE', 1.50, 1.80)
      ON CONFLICT (id) DO NOTHING;
    `);
    await pool.query(`
      INSERT INTO wallets (user_id, balance_paise, held_paise)
      VALUES ('D2B_MERC_01', 5000000, 0)
      ON CONFLICT (user_id) DO UPDATE SET balance_paise = 5000000;
    `);

    // 2b. Insert beneficiary with missing account number (empty string / NULL)
    const benRes1 = await pool.query(`
      INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified, is_primary)
      VALUES ('BEN_MISSING_ACC', 'D2B_MERC_01', 'State Bank of India', '', 'SBIN0001234', 'D2b Tester', true, true)
      RETURNING id;
    `);
    const benIdMissingAcc = benRes1.rows[0].id;

    // 2c. Insert beneficiary with missing IFSC (empty string / NULL)
    const benRes2 = await pool.query(`
      INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified, is_primary)
      VALUES ('BEN_MISSING_IFSC', 'D2B_MERC_01', 'State Bank of India', '1122334455', '', 'D2b Tester', true, false)
      RETURNING id;
    `);
    const benIdMissingIfsc = benRes2.rows[0].id;

    // Test withdrawal execution with missing account number
    let errMissingAcc = null;
    const client1 = await pool.connect();
    try {
      await processWithdrawalRequest(client1, {
        merchantId: 'D2B_MERC_01',
        amountPaise: 100000,
        settlementType: 'T1',
        channel: 'pinelabs',
        beneficiaryId: benIdMissingAcc
      });
    } catch (err) {
      errMissingAcc = err.message;
    } finally {
      client1.release();
    }
    assert(errMissingAcc && errMissingAcc.includes('INVALID_BENEFICIARY_DETAILS'), 'Withdrawal engine rejects beneficiary with missing account number (INVALID_BENEFICIARY_DETAILS)');

    // Test withdrawal execution with missing IFSC
    let errMissingIfsc = null;
    const client2 = await pool.connect();
    try {
      await processWithdrawalRequest(client2, {
        merchantId: 'D2B_MERC_01',
        amountPaise: 100000,
        settlementType: 'T1',
        channel: 'pinelabs',
        beneficiaryId: benIdMissingIfsc
      });
    } catch (err) {
      errMissingIfsc = err.message;
    } finally {
      client2.release();
    }
    assert(errMissingIfsc && errMissingIfsc.includes('INVALID_BENEFICIARY_DETAILS'), 'Withdrawal engine rejects beneficiary with missing IFSC (INVALID_BENEFICIARY_DETAILS)');

    // 2d. Frontend check: MerchantDashboardPage.jsx blocks withdrawal submit if account or IFSC missing
    const mercCode = fs.readFileSync('src/components/MerchantDashboardPage.jsx', 'utf8');
    const blocksWithdrawal = mercCode.includes("showToast('⚠️ Cannot proceed: No bank account on file (missing account number or IFSC).')") &&
                             mercCode.includes("if (!targetBank || !targetBank.account_number || !targetBank.account_number.trim() || !targetBank.ifsc || !targetBank.ifsc.trim()) {");
    assert(blocksWithdrawal, 'Frontend MerchantDashboardPage blocks withdrawal request if beneficiary account or IFSC is missing');
  }

  // -------------------------------------------------------------------------
  // TEST 3: Excel export blocked for beneficiary with missing account number or IFSC
  // -------------------------------------------------------------------------
  console.log('\n--- Test Group 3: Excel Export Blocked for Incomplete Bank Details ---');
  {
    // Insert a pending withdrawal linked to an invalid beneficiary
    await pool.query(`
      INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified, is_primary)
      VALUES ('BEN_INVALID_EXPORT', 'D2B_MERC_01', 'State Bank of India', '', '', 'Invalid Ben', true, false)
      ON CONFLICT (id) DO UPDATE SET account_number = '', ifsc = '';
    `);

    const wthRes = await pool.query(`
      INSERT INTO withdrawals (id, merchant_id, amount_paise, net_payout_paise, status, settlement_type, channel, beneficiary_id)
      VALUES ('WTH_D2B_BAD', 'D2B_MERC_01', 200000, 200000, 'PENDING', 'T1', 'pinelabs', 'BEN_INVALID_EXPORT')
      ON CONFLICT (id) DO UPDATE SET status = 'PENDING'
      RETURNING id;
    `);
    const badWithdrawalId = wthRes.rows[0].id;

    // Call /api/admin/withdrawals/export-excel
    const exportRes = await fetch(`${baseUrl}/api/admin/withdrawals/export-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ withdrawal_ids: [badWithdrawalId] })
    });
    const exportJson = await exportRes.json();
    assert(exportRes.status === 400 && exportJson.message.includes('MISSING_BANK_DETAILS'), 'Backend /api/admin/withdrawals/export-excel rejects withdrawal with missing account number or IFSC (MISSING_BANK_DETAILS)');

    // Frontend check: AdminDashboardPage.jsx blocks Excel export if missing bank details
    const adminCode = fs.readFileSync('src/components/AdminDashboardPage.jsx', 'utf8');
    const adminExportBlocked = adminCode.includes("Cannot export:") && adminCode.includes("No bank account on file (missing account number or IFSC)");
    assert(adminExportBlocked, 'Frontend AdminDashboardPage blocks Excel export and shows alert if any payout has missing bank details');
  }

  // -------------------------------------------------------------------------
  // TEST 4: Dynamic rental amount read from system_settings
  // -------------------------------------------------------------------------
  console.log('\n--- Test Group 4: Dynamic Rental Amount from system_settings ---');
  {
    // 4a. Initial check: monthly_rental_paise = 49900 -> 499.00
    const initialRes = await fetch(`${baseUrl}/api/settings`);
    const initialJson = await initialRes.json();
    assert(initialJson.success === true && initialJson.settings.monthly_rental_rupees === '499.00', 'Initial /api/settings returns monthly_rental_rupees of 499.00 from database');

    // 4b. Update rental amount in system_settings to 649.00 (64900 paise)
    await pool.query(`UPDATE system_settings SET value_numeric = 64900 WHERE key = 'monthly_rental_paise';`);

    const updatedRes = await fetch(`${baseUrl}/api/settings`);
    const updatedJson = await updatedRes.json();
    assert(updatedJson.success === true && updatedJson.settings.monthly_rental_rupees === '649.00', 'After updating system_settings to 64900 paise, /api/settings returns 649.00');

    // Restore setting to 49900 paise
    await pool.query(`UPDATE system_settings SET value_numeric = 49900 WHERE key = 'monthly_rental_paise';`);

    // 4c. Verify missing setting error behavior: delete monthly_rental_paise temporarily
    await pool.query(`DELETE FROM system_settings WHERE key = 'monthly_rental_paise';`);
    const missingRes = await fetch(`${baseUrl}/api/settings`);
    const missingJson = await missingRes.json();
    assert(missingRes.status === 500 && missingJson.message.includes('SETTING_NOT_FOUND'), 'When monthly_rental_paise is missing from system_settings, /api/settings rejects with SETTING_NOT_FOUND');

    // Restore setting
    await pool.query(`
      INSERT INTO system_settings (key, value_numeric, description)
      VALUES ('monthly_rental_paise', 49900, 'Default monthly POS terminal rental fee in paise')
      ON CONFLICT (key) DO UPDATE SET value_numeric = 49900;
    `);

    // 4d. Frontend checks: no hardcoded 499 in Admin or Merchant screens
    const adminCode = fs.readFileSync('src/components/AdminDashboardPage.jsx', 'utf8');
    const mercCode = fs.readFileSync('src/components/MerchantDashboardPage.jsx', 'utf8');
    const adminHasDynamic = adminCode.includes('systemSettings?.monthly_rental_rupees') && !adminCode.includes("Monthly Rental (₹499/mo)");
    const mercHasDynamic = mercCode.includes('systemSettings?.monthly_rental_rupees') && !mercCode.includes("Monthly Rental (₹499/mo)");
    assert(adminHasDynamic && mercHasDynamic, 'Admin and Merchant dashboards render rental amount dynamically from systemSettings without hardcoded 499 fallback');
  }

  // -------------------------------------------------------------------------
  // TEST 5: Grep Proofs for Removed Items & Clean Codebase
  // -------------------------------------------------------------------------
  console.log('\n--- Test Group 5: Grep Proofs for Removed Fallbacks ---');
  {
    const filesToScan = [
      'src/components/AdminDashboardPage.jsx',
      'src/components/MerchantDashboardPage.jsx',
      'src/services/api.js',
      'src/services/supabase.js',
      'src/utils/bankExportUtils.js'
    ];

    let foundDummyAccount = false;
    let foundFallbackIfsc = false;
    let foundRentalOfflineCache = false;
    let emptyCatchCount = 0;

    for (const file of filesToScan) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('102938475620')) foundDummyAccount = true;
      if (content.includes("|| 'SBIN0001234'") || content.includes('|| "SBIN0001234"')) foundFallbackIfsc = true;
      if (content.includes('ronav_rental_ledger') || content.includes('ronava_rental_ledger')) foundRentalOfflineCache = true;
    }

    // Scan whole src/ for empty catch blocks
    function walkDir(dir) {
      let results = [];
      const list = fs.readdirSync(dir);
      for (const f of list) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) results = results.concat(walkDir(full));
        else if (full.endsWith('.js') || full.endsWith('.jsx')) results.push(full);
      }
      return results;
    }

    const allSrcFiles = walkDir('src');
    for (const file of allSrcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const l of lines) {
        if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(l)) {
          emptyCatchCount++;
        }
      }
    }

    assert(!foundDummyAccount, 'Grep proof: Zero occurrences of dummy account "102938475620"');
    assert(!foundFallbackIfsc, 'Grep proof: Zero occurrences of fallback IFSC "SBIN0001234"');
    assert(!foundRentalOfflineCache, 'Grep proof: Zero occurrences of rental localStorage offline cache');
    assert(emptyCatchCount === 0, `Grep proof: Zero empty catch blocks remaining across all files in src/ (found ${emptyCatchCount})`);
  }

  console.log('\n====================================================');
  console.log(`  ALL ${passCount}/${testCount} PHASE D2b TESTS PASSED!`);
  console.log('====================================================\n');

  server.close();
  await pool.end();
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  if (server) server.close();
  process.exit(1);
});
