// server/clean_and_reseed.mjs
// Clean all transactions, withdrawals, ledger rows, and extra test users.
// Re-seeds only the 6 reference users with clean wallets (0 balance).

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_scratch_db';

import pg from 'pg';
import { resetTestDatabase } from './test_db_helper.js';
import { setUserRate } from './rate_engine.js';
import { TEST_PASSWORD } from './test_config.js';
import { hashPassword } from './security.js';
const { Pool } = pg;

export async function cleanAndReseed(targetUrl) {
  const dbUrl = targetUrl || process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_scratch_db';
  if (dbUrl.includes('ronav_test_db')) {
    throw new Error('SAFETY_VIOLATION: cleanAndReseed() cannot be executed on ronav_test_db with hand-made accounts! Must use ronav_scratch_db.');
  }
  process.env.TEST_DATABASE_URL = dbUrl;
  console.log(`[Clean & Reseed] Initializing clean database schema in ${dbUrl}...`);
  await resetTestDatabase(dbUrl);

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: false
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('[Clean & Reseed] Seeding 6 reference users with clean wallets (0 paise)...');
    const defaultPassword = hashPassword(TEST_PASSWORD);
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

      // Clean wallet: 0 balance
      await client.query(`
        INSERT INTO wallets (user_id, balance_paise, held_paise, total_sales_paise, withdrawn_paise)
        VALUES ($1, 0, 0, 0, 0)
        ON CONFLICT (user_id) DO UPDATE SET 
          balance_paise = 0, 
          held_paise = 0,
          total_sales_paise = 0,
          withdrawn_paise = 0;
      `, [u.id]);
    }

    // Set Reference Rates on Pine Labs, Payswiff, and QR:
    // Merchant charged 1.50% (150 bps), Area 1.20% (120 bps), District 1.00% (100 bps), SD 0.80% (80 bps), Master 0.60% (60 bps)
    const rates = [
      // Pine Labs
      { userId: 'MST1001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 60 },
      { userId: 'MST1001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 90 },
      { userId: 'SD1001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 80 },
      { userId: 'SD1001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 110 },
      { userId: 'DIST2001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 100 },
      { userId: 'DIST2001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 130 },
      { userId: 'AREA3001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 120 },
      { userId: 'AREA3001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 160 },
      { userId: 'MID4001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 },
      { userId: 'MID4001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 180 },

      // Payswiff
      { userId: 'MST1001', channel: 'payswiff', settlementMode: 'T1', rateBps: 80 },
      { userId: 'MST1001', channel: 'payswiff', settlementMode: 'INSTANT', rateBps: 110 },
      { userId: 'SD1001', channel: 'payswiff', settlementMode: 'T1', rateBps: 100 },
      { userId: 'SD1001', channel: 'payswiff', settlementMode: 'INSTANT', rateBps: 130 },
      { userId: 'DIST2001', channel: 'payswiff', settlementMode: 'T1', rateBps: 120 },
      { userId: 'DIST2001', channel: 'payswiff', settlementMode: 'INSTANT', rateBps: 150 },
      { userId: 'AREA3001', channel: 'payswiff', settlementMode: 'T1', rateBps: 140 },
      { userId: 'AREA3001', channel: 'payswiff', settlementMode: 'INSTANT', rateBps: 170 },
      { userId: 'MID4001', channel: 'payswiff', settlementMode: 'T1', rateBps: 180 },
      { userId: 'MID4001', channel: 'payswiff', settlementMode: 'INSTANT', rateBps: 210 },

      // Company QR
      { userId: 'MST1001', channel: 'qr', settlementMode: 'NONE', rateBps: 60 },
      { userId: 'SD1001', channel: 'qr', settlementMode: 'NONE', rateBps: 80 },
      { userId: 'DIST2001', channel: 'qr', settlementMode: 'NONE', rateBps: 100 },
      { userId: 'AREA3001', channel: 'qr', settlementMode: 'NONE', rateBps: 120 },
      { userId: 'MID4001', channel: 'qr', settlementMode: 'NONE', rateBps: 150 },
    ];

    for (const r of rates) {
      await setUserRate(client, r);
    }

    // POS Machine for MID4001
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

    // Verified Beneficiary for MID4001
    await client.query(`
      INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified, is_primary)
      VALUES ('BEN-MID4001-01', 'MID4001', 'HDFC Bank', '50100234567890', 'HDFC0001234', 'Test Merchant Store', TRUE, TRUE)
      ON CONFLICT (id) DO UPDATE SET
        bank_name = 'HDFC Bank',
        account_number = '50100234567890',
        ifsc = 'HDFC0001234',
        holder_name = 'Test Merchant Store',
        is_verified = TRUE,
        is_primary = TRUE;
    `);

    // System Settings
    await client.query(`
      INSERT INTO system_settings (key, value_numeric, value_text, description)
      VALUES ('monthly_rental_paise', 49900, '49900', 'Monthly POS machine terminal hardware rental fee')
      ON CONFLICT (key) DO UPDATE SET value_numeric = 49900, value_text = '49900';
    `);

    await client.query('COMMIT');
    console.log('[Clean & Reseed] Successfully re-seeded 6 reference users with clean 0-balance wallets.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Clean & Reseed] Failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith('clean_and_reseed.mjs')) {
  cleanAndReseed().then(() => pool.end()).catch((e) => { console.error(e); pool.end(); process.exit(1); });
}
