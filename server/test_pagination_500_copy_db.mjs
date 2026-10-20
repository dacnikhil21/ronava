import assert from 'node:assert/strict';
import pg from 'pg';

const { Pool } = pg;
const PG_USER = process.env.PGUSER || 'postgres';
const PG_PASSWORD = process.env.PGPASSWORD || 'postgres';
const PG_HOST = process.env.PGHOST || 'localhost';
const PG_PORT = parseInt(process.env.PGPORT || '5432', 10);
const COPY_DB = 'ronav_test_db_pagination_copy';
const COPY_DB_URL = `postgres://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${COPY_DB}`;

async function run() {
  console.log('=== TEST: Pagination with 500 generated rows on isolated database COPY ===');

  const adminPool = new Pool({
    user: PG_USER,
    password: PG_PASSWORD,
    host: PG_HOST,
    port: PG_PORT,
    database: 'postgres'
  });

  // 1. Create fresh isolated test copy DB
  console.log(`1. Creating clean database ${COPY_DB}...`);
  await adminPool.query(`DROP DATABASE IF EXISTS "${COPY_DB}" WITH (FORCE)`);
  await adminPool.query(`CREATE DATABASE "${COPY_DB}"`);

  const copyPool = new Pool({ connectionString: COPY_DB_URL });

  try {
    console.log('2. Creating tables in copy database...');
    await copyPool.query(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mobile TEXT NOT NULL,
        role TEXT NOT NULL
      );

      CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        amount_paise BIGINT NOT NULL,
        customer_charge_paise BIGINT NOT NULL,
        net_amount_paise BIGINT NOT NULL,
        type TEXT NOT NULL,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE withdrawals (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        amount_paise BIGINT NOT NULL,
        fee_paise BIGINT NOT NULL,
        net_amount_paise BIGINT NOT NULL,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Seed test merchant
    await copyPool.query(`
      INSERT INTO users (id, name, mobile, role)
      VALUES ('MID1001', 'Test Merchant', '9999999999', 'MERCHANT')
    `);

    // 4. Insert 500 generated rows in transactions & withdrawals
    console.log('3. Inserting 500 test transactions and 500 test withdrawals...');
    const now = Date.now();
    for (let i = 0; i < 500; i++) {
      const txnId = `PAG-TXN-${now}-${i}`;
      await copyPool.query(`
        INSERT INTO transactions (id, merchant_id, amount_paise, customer_charge_paise, net_amount_paise, type, channel, status, created_at)
        VALUES ($1, 'MID1001', 100000, 1600, 98400, 'POS_SWIPE', 'pinelabs', 'SUCCESS', NOW() - INTERVAL '${i} minutes')
      `, [txnId]);

      const wthId = `PAG-WTH-${now}-${i}`;
      await copyPool.query(`
        INSERT INTO withdrawals (id, merchant_id, amount_paise, fee_paise, net_amount_paise, channel, status, created_at)
        VALUES ($1, 'MID1001', 50000, 0, 50000, 'pinelabs', 'COMPLETED', NOW() - INTERVAL '${i} minutes')
      `, [wthId]);
    }

    console.log('4. Verifying pagination contracts on the 500 rows...');
    // Page 1: limit 50, offset 0
    const p1Txn = (await copyPool.query(`
      SELECT id FROM transactions WHERE UPPER(merchant_id) = 'MID1001' ORDER BY created_at DESC LIMIT 50 OFFSET 0
    `)).rows;
    assert.equal(p1Txn.length, 50, 'Page 1 must return 50 rows');

    // Page 2: limit 50, offset 50
    const p2Txn = (await copyPool.query(`
      SELECT id FROM transactions WHERE UPPER(merchant_id) = 'MID1001' ORDER BY created_at DESC LIMIT 50 OFFSET 50
    `)).rows;
    assert.equal(p2Txn.length, 50, 'Page 2 must return 50 rows');

    // Verify non-overlapping IDs
    const p1Ids = new Set(p1Txn.map(r => r.id));
    for (const r of p2Txn) {
      assert.ok(!p1Ids.has(r.id), `Page 2 row ${r.id} must not overlap with Page 1`);
    }

    // Page 10: limit 50, offset 450
    const p10Txn = (await copyPool.query(`
      SELECT id FROM transactions WHERE UPPER(merchant_id) = 'MID1001' ORDER BY created_at DESC LIMIT 50 OFFSET 450
    `)).rows;
    assert.equal(p10Txn.length, 50, 'Page 10 must return 50 rows');

    const totalCount = (await copyPool.query(`
      SELECT COUNT(*)::int as c FROM transactions WHERE UPPER(merchant_id) = 'MID1001'
    `)).rows[0].c;
    assert.equal(totalCount, 500, `Total must be exactly 500: got ${totalCount}`);

    console.log(`✓ Total rows: ${totalCount}. Verified non-overlapping page slicing (limit 50, offset 0, 50, 450).`);
    console.log('✓ PASS: Pagination with 500 generated rows completely verified on isolated database copy.');
  } finally {
    await copyPool.end();
    console.log(`5. Cleaning up database copy ${COPY_DB}...`);
    await adminPool.query(`DROP DATABASE IF EXISTS "${COPY_DB}" WITH (FORCE)`);
    await adminPool.end();
  }
}

run().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
