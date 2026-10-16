// server/seed_test_users.mjs
// Seeds or updates test users on local ronav_test_db with exact reference hierarchy and rates

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_test_db';

import pg from 'pg';
import { setUserRate } from './rate_engine.js';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  ssl: false
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Seeding reference test users into ronav_test_db...');

    // 1. Ensure system settings exist
    await client.query(`
      INSERT INTO system_settings (key, value_numeric, value_text, description)
      VALUES ('monthly_rental_paise', 49900, '49900', 'Monthly POS machine terminal hardware rental fee')
      ON CONFLICT (key) DO UPDATE SET value_numeric = 49900, value_text = '49900';
    `);

    // 2. Reference Users with standard test password "Ronav@123"
    const defaultPassword = 'Ronav@123';
    const users = [
      { id: 'ADM001', name: 'RONAV Super Admin', mobile: '9966203053', role: 'ADMIN', creator_id: null },
      { id: 'MST1001', name: 'Master Distributor', mobile: '9966203000', role: 'MASTER', creator_id: 'ADM001' },
      { id: 'SD1001', name: 'Super Distributor', mobile: '9848011223', role: 'SUPER_DISTRIBUTOR', creator_id: 'MST1001' },
      { id: 'DIST2001', name: 'District Distributor', mobile: '9848099887', role: 'DISTRICT_DISTRIBUTOR', creator_id: 'SD1001' },
      { id: 'AREA3001', name: 'Area Distributor', mobile: '9848055443', role: 'DISTRIBUTOR', creator_id: 'DIST2001' },
      { id: 'MID4001', name: 'Test Merchant Store', mobile: '9876543210', role: 'MERCHANT', creator_id: 'AREA3001' },
    ];

    for (const u of users) {
      await client.query(`
        INSERT INTO users (id, name, mobile, role, creator_id, password, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          mobile = EXCLUDED.mobile,
          role = EXCLUDED.role,
          creator_id = EXCLUDED.creator_id,
          password = EXCLUDED.password,
          status = 'ACTIVE';
      `, [u.id, u.name, u.mobile, u.role, u.creator_id, defaultPassword]);

      // Initialize wallet with Rs 10,000 for test operations
      await client.query(`
        INSERT INTO wallets (user_id, balance_paise, held_paise)
        VALUES ($1, 1000000, 0)
        ON CONFLICT (user_id) DO UPDATE SET balance_paise = GREATEST(wallets.balance_paise, 1000000);
      `, [u.id]);
    }

    // 3. User channel rates (Pine Labs T+1 Reference Hierarchy)
    // Area 1.50% (150 bps), District 1.20% (120 bps), SD 1.00% (100 bps), Master 0.80% (80 bps), Admin 0.60% (60 bps)
    const rates = [
      { userId: 'ADM001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 60 },
      { userId: 'ADM001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 90 },
      { userId: 'MST1001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 80 },
      { userId: 'MST1001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 110 },
      { userId: 'SD1001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 100 },
      { userId: 'SD1001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 130 },
      { userId: 'DIST2001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 120 },
      { userId: 'DIST2001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 150 },
      { userId: 'AREA3001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 },
      { userId: 'AREA3001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 180 },
      { userId: 'MID4001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 },
      { userId: 'MID4001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 180 },
    ];

    for (const r of rates) {
      await setUserRate(client, r);
    }

    // 4. POS Machine for Merchant MID4001
    await client.query(`
      INSERT INTO merchant_pos (id, merchant_id, provider, terminal_id, commission_rate, commission_rate_t1, commission_rate_instant)
      VALUES ('POS-MID4001-01', 'MID4001', 'Pine Labs', 'PL-4001-01', 1.50, 1.50, 1.80)
      ON CONFLICT (id) DO UPDATE SET
        provider = 'Pine Labs',
        terminal_id = 'PL-4001-01',
        commission_rate = 1.50,
        commission_rate_t1 = 1.50,
        commission_rate_instant = 1.80;
    `);

    // 5. Approved beneficiary for Merchant MID4001 for withdrawal testing
    await client.query(`
      INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified)
      VALUES ('BEN-MID4001-01', 'MID4001', 'HDFC Bank', '50100234567890', 'HDFC0001234', 'Test Merchant Store', TRUE)
      ON CONFLICT (id) DO UPDATE SET
        bank_name = 'HDFC Bank',
        account_number = '50100234567890',
        ifsc = 'HDFC0001234',
        holder_name = 'Test Merchant Store',
        is_verified = TRUE;
    `);

    await client.query('COMMIT');
    console.log('✅ Successfully seeded reference hierarchy on ronav_test_db!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
