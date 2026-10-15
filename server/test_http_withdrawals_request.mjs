import http from 'node:http';
import assert from 'node:assert/strict';
process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
import { testPool, resetTestDatabase } from './test_db_helper.js';
import { handleApiRequest } from './api.js';
import { getDbPool } from './pg_db.js';
import { postLedgerEntry, getWalletBalances, verifyWalletReconciliation } from './ledger_engine.js';

const PORT = 5992;

async function runTest() {
  console.log('--- RUNNING TEST: HTTP POST /api/withdrawals/request (Rewired to Phase B Engine) ---');
  await resetTestDatabase();

  const client = await testPool.connect();
  try {
    // Setup merchant and approved beneficiary
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id) VALUES
        ('ADM001', 'RONAV Admin', '9966203053', 'ADMIN', NULL),
        ('MID5001', 'Withdrawal Merchant', '9876543211', 'MERCHANT', 'ADM001');

      INSERT INTO wallets (user_id, balance_paise, held_paise) VALUES
        ('MID5001', 0, 0);

      INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified) VALUES
        ('BEN-APPROVED-1', 'MID5001', 'State Bank of India', '1234567890', 'SBIN0001234', 'Withdrawal Merchant', true),
        ('BEN-UNVERIFIED-2', 'MID5001', 'HDFC Bank', '9876543210', 'HDFC0001234', 'Withdrawal Merchant', false);
    `);

    // Fund merchant wallet via ledger credit: Rs 1,000 (100,000 paise)
    await postLedgerEntry(client, {
      userId: 'MID5001',
      type: 'swipe_credit',
      amountPaise: 100000n, // Rs 1,000
      referenceId: 'TXN-INITIAL-FUND',
      referenceType: 'SWIPE',
      channel: 'pinelabs',
      createdBy: 'SYSTEM'
    });
  } finally {
    client.release();
  }

  const server = http.createServer((req, res) => {
    handleApiRequest(req, res).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
  });

  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`HTTP Test Server listening on http://127.0.0.1:${PORT}`);

  try {
    // 1. REJECT RAW ACCOUNT DETAILS WITHOUT BENEFICIARY ID
    console.log('1. Testing rejection of raw account numbers / missing approved beneficiary ID...');
    const rawRes = await fetch(`http://127.0.0.1:${PORT}/api/withdrawals/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'MID5001',
        amount: 200, // Rs 200
        bank_name: 'Fake Bank',
        account_number: '999999999',
        ifsc: 'FAKE0001234'
      })
    });
    const rawJson = await rawRes.json();
    assert.equal(rawRes.status, 400, `Expected HTTP 400 for raw account number, got ${rawRes.status}`);
    assert.match(rawJson.message, /BENEFICIARY_REQUIRED/);

    // 2. REJECT UNVERIFIED BENEFICIARY
    console.log('2. Testing rejection of unverified beneficiary...');
    const unverRes = await fetch(`http://127.0.0.1:${PORT}/api/withdrawals/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'MID5001',
        amount: 200,
        beneficiary_id: 'BEN-UNVERIFIED-2'
      })
    });
    const unverJson = await unverRes.json();
    assert.equal(unverRes.status, 400, `Expected HTTP 400 for unverified beneficiary, got ${unverRes.status}`);
    assert.match(unverJson.message, /UNVERIFIED_BENEFICIARY/);

    // 3. REJECT BREACH OF RS 500 RESERVE
    // Available = Rs 1,000. Requesting Rs 600 -> leaves Rs 400 < Rs 500 reserve. Must fail.
    console.log('3. Testing rejection when withdrawal breaches Rs 500 mandatory reserve...');
    const reserveRes = await fetch(`http://127.0.0.1:${PORT}/api/withdrawals/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'MID5001',
        amount: 600, // Rs 600
        beneficiary_id: 'BEN-APPROVED-1'
      })
    });
    const reserveJson = await reserveRes.json();
    assert.equal(reserveRes.status, 403, `Expected HTTP 403 for reserve violation, got ${reserveRes.status}`);
    assert.match(reserveJson.message, /RESERVE_VIOLATION/);

    // 4. VALID WITHDRAWAL REQUEST WITH APPROVED BENEFICIARY
    // Requesting Rs 300 -> leaves Rs 700 >= Rs 500 reserve. Must succeed!
    console.log('4. Testing valid withdrawal request with approved beneficiary...');
    const validRes = await fetch(`http://127.0.0.1:${PORT}/api/withdrawals/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idempotency-key': 'WTH-HTTP-IDEMP-1'
      },
      body: JSON.stringify({
        merchant_id: 'MID5001',
        amount: 300, // Rs 300
        beneficiary_id: 'BEN-APPROVED-1'
      })
    });
    const validJson = await validRes.json();
    assert.equal(validRes.status, 200, `Expected HTTP 200, got ${validRes.status}: ${JSON.stringify(validJson)}`);
    assert.equal(validJson.success, true);
    assert.equal(validJson.withdrawal.amount_paise, '30000');
    assert.equal(validJson.withdrawal.status, 'PENDING');

    // Verify DB ledger entry and wallet
    const verifyClient = await testPool.connect();
    try {
      const ledgerRows = await verifyClient.query(
        `SELECT type, amount_paise FROM financial_ledger WHERE reference_id = $1`,
        [validJson.withdrawal.id]
      );
      assert.equal(ledgerRows.rows.length, 1);
      assert.equal(ledgerRows.rows[0].type, 'withdrawal_hold');
      assert.equal(ledgerRows.rows[0].amount_paise, '-30000');

      const rec = await verifyWalletReconciliation(verifyClient, 'MID5001');
      assert.equal(rec.reconciled, true);
    } finally {
      verifyClient.release();
    }

    // 5. IDEMPOTENT RETRY
    console.log('5. Testing idempotent replay...');
    const idempRes = await fetch(`http://127.0.0.1:${PORT}/api/withdrawals/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idempotency-key': 'WTH-HTTP-IDEMP-1'
      },
      body: JSON.stringify({
        merchant_id: 'MID5001',
        amount: 300,
        beneficiary_id: 'BEN-APPROVED-1'
      })
    });
    const idempJson = await idempRes.json();
    assert.equal(idempRes.status, 200);
    assert.equal(idempJson.withdrawal.id, validJson.withdrawal.id);

    console.log('✅ TEST PASSED: HTTP /api/withdrawals/request is completely rewired to Phase B engine.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    try {
      const pool = getDbPool();
      await pool.end();
    } catch (_) {}
    try {
      await testPool.end();
    } catch (_) {}
  }
}

runTest().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
