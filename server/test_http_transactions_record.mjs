import http from 'node:http';
import assert from 'node:assert/strict';
process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
import { testPool, resetTestDatabase } from './test_db_helper.js';
import { setUserRate } from './rate_engine.js';
import { handleApiRequest } from './api.js';
import { getDbPool } from './pg_db.js';
import { getWalletBalances, verifyWalletReconciliation } from './ledger_engine.js';

const PORT = 5991;

async function runTest() {
  console.log('--- RUNNING TEST: HTTP POST /api/transactions/record (Rewired to Phase B Ledger) ---');
  await resetTestDatabase();

  const client = await testPool.connect();
  try {
    // Setup reference chain in database
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id) VALUES
        ('ADM001', 'RONAV Admin', '9966203053', 'ADMIN', NULL),
        ('MST1001', 'Master Dist', '9966203000', 'MASTER', 'ADM001'),
        ('SD1001', 'Super Dist', '9848011223', 'SUPER_DISTRIBUTOR', 'MST1001'),
        ('DIST2001', 'District Dist', '9848099887', 'DISTRICT_DISTRIBUTOR', 'SD1001'),
        ('AREA3001', 'Area Dist', '9848055443', 'DISTRIBUTOR', 'DIST2001'),
        ('MID4001', 'Test Merchant', '9876543210', 'MERCHANT', 'AREA3001');

      INSERT INTO wallets (user_id, balance_paise) VALUES
        ('ADM001', 0), ('MST1001', 0), ('SD1001', 0), ('DIST2001', 0), ('AREA3001', 0), ('MID4001', 0);
    `);

    await setUserRate(client, { userId: 'ADM001', channel: 'pinelabs', rateBps: 60 });
    await setUserRate(client, { userId: 'MST1001', channel: 'pinelabs', rateBps: 80 });
    await setUserRate(client, { userId: 'SD1001', channel: 'pinelabs', rateBps: 100 });
    await setUserRate(client, { userId: 'DIST2001', channel: 'pinelabs', rateBps: 120 });
    await setUserRate(client, { userId: 'AREA3001', channel: 'pinelabs', rateBps: 150 });
    await setUserRate(client, { userId: 'MID4001', channel: 'pinelabs', rateBps: 150 });
  } finally {
    client.release();
  }

  // Start real HTTP server running handleApiRequest
  const server = http.createServer((req, res) => {
    handleApiRequest(req, res).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
  });

  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`HTTP Test Server listening on http://127.0.0.1:${PORT}`);

  try {
    // 1. POST /api/transactions/record with fake customer_charge: 0
    console.log('1. Sending HTTP POST /api/transactions/record with fake customer_charge: 0...');
    const postRes = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idempotency-key': 'HTTP-IDEMP-1'
      },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount: 10000, // Rs 10,000
        customer_charge: 0, // Fake zero fee sent by client - SERVER MUST IGNORE
        commission: 0,
        net_amount: 10000,
        provider: 'pinelabs',
        ref_number: 'REF-HTTP-10001',
        slip_number: 'SLIP-HTTP-1'
      })
    });

    const json = await postRes.json();
    assert.equal(postRes.status, 200, `Expected HTTP 200, got ${postRes.status}: ${JSON.stringify(json)}`);
    assert.equal(json.success, true);

    // Verify server ignored fake 0 fee and computed 15000 paise (Rs 150)
    assert.equal(json.transaction.customer_charge_paise, '15000', 'Server must ignore client fee and charge 15,000 paise');
    assert.equal(json.transaction.net_amount_paise, '985000', 'Merchant gets 985,000 paise (Rs 9,850)');

    // Verify DB ledger entries
    const verifyClient = await testPool.connect();
    try {
      const ledgerRows = await verifyClient.query(
        `SELECT user_id, type, amount_paise FROM financial_ledger WHERE reference_id = $1 ORDER BY id ASC`,
        [json.transaction.id]
      );
      assert.equal(ledgerRows.rows.length, 6, 'Must create 6 ledger rows (1 merchant + 5 uplines)');

      // Verify wallet balances strictly equal ledger sum
      for (const uid of ['MID4001', 'AREA3001', 'DIST2001', 'SD1001', 'MST1001', 'ADM001']) {
        const rec = await verifyWalletReconciliation(verifyClient, uid);
        assert.equal(rec.reconciled, true, `Wallet ${uid} must reconcile`);
      }
    } finally {
      verifyClient.release();
    }

    // 2. Duplicate Idempotency Key
    console.log('2. Sending request with same idempotency key...');
    const idempRes = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idempotency-key': 'HTTP-IDEMP-1' // SAME KEY
      },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount: 10000,
        ref_number: 'REF-HTTP-10001',
        slip_number: 'SLIP-HTTP-1'
      })
    });
    const idempJson = await idempRes.json();
    assert.equal(idempRes.status, 200);
    assert.equal(idempJson.transaction.id, json.transaction.id, 'Idempotent request returns exact same transaction ID');

    // 3. Duplicate Slip/Ref with different key
    console.log('3. Sending duplicate slip/ref with different idempotency key...');
    const dupRes = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idempotency-key': 'HTTP-IDEMP-NEW-KEY'
      },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount: 10000,
        ref_number: 'REF-HTTP-10001', // DUPLICATE REF
        slip_number: 'SLIP-HTTP-1'
      })
    });
    const dupJson = await dupRes.json();
    assert.equal(dupRes.status, 409, `Expected HTTP 409 Conflict, got ${dupRes.status}`);
    assert.match(dupJson.message, /DUPLICATE_SWIPE/);

    console.log('✅ TEST PASSED: HTTP /api/transactions/record is completely rewired to Phase B ledger engine.');
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
