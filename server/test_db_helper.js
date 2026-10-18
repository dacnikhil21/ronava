import pg from 'pg';

const { Pool } = pg;

export function getTestPool(targetUrl) {
  const connectionString = targetUrl || process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_scenario_db';
  return new Pool({ connectionString, ssl: false });
}

export const testPool = getTestPool();

export async function resetTestDatabase(targetUrl) {
  const pool = getTestPool(targetUrl);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Drop existing tables in test database to establish clean, pure schema
    await client.query(`
      DROP TABLE IF EXISTS inquiries CASCADE;
      DROP TABLE IF EXISTS financial_ledger CASCADE;
      DROP TABLE IF EXISTS user_channel_rates CASCADE;
      DROP TABLE IF EXISTS payout_batches CASCADE;
      DROP TABLE IF EXISTS system_settings CASCADE;
      DROP TABLE IF EXISTS idempotency_keys CASCADE;
      DROP TABLE IF EXISTS withdrawals CASCADE;
      DROP TABLE IF EXISTS transactions CASCADE;
      DROP TABLE IF EXISTS beneficiaries CASCADE;
      DROP TABLE IF EXISTS merchant_pos CASCADE;
      DROP TABLE IF EXISTS wallets CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // 1. Users
    await client.query(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mobile TEXT NOT NULL UNIQUE,
        email TEXT,
        aadhaar TEXT,
        pan TEXT,
        address TEXT,
        role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MASTER', 'MASTER_DISTRIBUTOR', 'SUPER_DISTRIBUTOR', 'DISTRICT_DISTRIBUTOR', 'DIST_FRANCHISE', 'DISTRIBUTOR', 'MERCHANT', 'RETAILER')),
        creator_id TEXT REFERENCES users(id),
        password TEXT,
        margin_rate NUMERIC DEFAULT 0,
        commission_rate_t1 NUMERIC DEFAULT 0,
        commission_rate_instant NUMERIC DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE merchant_pos (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        merchant_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(50),
        terminal_id TEXT,
        commission_rate NUMERIC DEFAULT 1.5,
        assigned_by TEXT,
        vendor_entity TEXT,
        device_plan TEXT DEFAULT 'RENTAL',
        monthly_rent NUMERIC DEFAULT 0,
        settlement_type VARCHAR(50) DEFAULT 'T1',
        instant_surcharge NUMERIC DEFAULT 0,
        commission_rate_t1 NUMERIC DEFAULT 0,
        commission_rate_instant NUMERIC DEFAULT 0,
        admin_cut_rate NUMERIC DEFAULT 0,
        upline_override_rate NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Wallets (Cached balances stored in BIGINT paise, strictly verified against financial_ledger)
    await client.query(`
      CREATE TABLE wallets (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        balance_paise BIGINT NOT NULL DEFAULT 0,
        held_paise BIGINT NOT NULL DEFAULT 0,
        total_sales_paise BIGINT NOT NULL DEFAULT 0,
        withdrawn_paise BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. System Settings (Editable by Admin, NO hardcoded values)
    await client.query(`
      CREATE TABLE system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value_numeric NUMERIC,
        value_text TEXT,
        value_json JSONB,
        description TEXT,
        updated_by TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed default settings
    await client.query(`
      INSERT INTO system_settings (key, value_numeric, value_text, description) VALUES
        ('reserve_amount_paise', 50000, '50000', 'Minimum wallet security reserve in paise (Rs 500)'),
        ('monthly_rental_paise', 49900, '49900', 'Monthly POS machine rental in paise (Rs 499)'),
        ('instant_settlement_fee_bps', 150, '150', 'Instant settlement fee in basis points (1.50%)'),
        ('t1_settlement_fee_bps', 0, '0', 'T+1 settlement fee in basis points (0.00%)'),
        ('bank_cost_enabled', 0, 'OFF', 'Whether bank cost is deducted from upline (0 = OFF, Admin absorbs)'),
        ('bank_cost_bps', 0, '0', 'Bank processing cost in basis points'),
        ('default_admin_cut_bps', 60, '60', 'Default base admin cut in basis points (0.60%)'),
        ('default_pinelabs_rate_bps', 150, '150', 'Default Pine Labs merchant rate in basis points (1.50%)'),
        ('default_pinelabs_t1_rate_bps', 150, '150', 'Default Pine Labs T+1 rate in basis points (1.50%)'),
        ('default_pinelabs_instant_rate_bps', 180, '180', 'Default Pine Labs Instant rate in basis points (1.80%)'),
        ('default_payswiff_rate_bps', 180, '180', 'Default Payswiff merchant rate in basis points (1.80%)'),
        ('default_payswiff_t1_rate_bps', 180, '180', 'Default Payswiff T+1 rate in basis points (1.80%)'),
        ('default_payswiff_instant_rate_bps', 200, '200', 'Default Payswiff Instant rate in basis points (2.00%)'),
        ('default_qr_rate_bps', 0, '0', 'Default QR merchant rate in basis points (0.00%)');
    `);

    // 4. Rate Versioning (user_channel_rates)
    await client.query(`
      CREATE TABLE user_channel_rates (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        channel VARCHAR(50) NOT NULL,
        settlement_mode VARCHAR(20) NOT NULL DEFAULT 'T1' CHECK (settlement_mode IN ('T1', 'INSTANT', 'NONE')),
        rate_bps INTEGER NOT NULL CHECK (rate_bps >= 0 AND rate_bps <= 10000),
        needs_review BOOLEAN NOT NULL DEFAULT FALSE,
        effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        effective_to TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX idx_user_channel_rates_lookup ON user_channel_rates (user_id, channel, settlement_mode, effective_from DESC);
    `);

    // 5. Beneficiaries
    await client.query(`
      CREATE TABLE beneficiaries (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bank_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        ifsc TEXT NOT NULL,
        holder_name TEXT NOT NULL,
        is_verified BOOLEAN NOT NULL DEFAULT TRUE,
        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 6. Transactions
    await client.query(`
      CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
        customer_charge_paise BIGINT NOT NULL DEFAULT 0,
        net_amount_paise BIGINT NOT NULL CHECK (net_amount_paise >= 0),
        type VARCHAR(50) NOT NULL,
        provider VARCHAR(50),
        channel VARCHAR(50) NOT NULL,
        settlement_mode VARCHAR(20) NOT NULL DEFAULT 'T1',
        ref_number TEXT,
        slip_number TEXT,
        transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
        notes TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      -- Uniqueness constraint for manually entered swipes: merchant + slip/ref + amount + date
      CREATE UNIQUE INDEX uq_manual_swipe ON transactions (merchant_id, ref_number, amount_paise, transaction_date)
      WHERE ref_number IS NOT NULL AND status != 'REVERSED';
    `);

    // 7. Append-Only Financial Ledger
    await client.query(`
      CREATE TABLE financial_ledger (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL CHECK (type IN (
          'swipe_credit', 
          'commission', 
          'withdrawal_hold', 
          'withdrawal_paid', 
          'withdrawal_reversal', 
          'reserve', 
          'fee', 
          'adjustment', 
          'refund'
        )),
        amount_paise BIGINT NOT NULL,
        reference_id TEXT,
        reference_type VARCHAR(50),
        channel VARCHAR(50),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX idx_ledger_user ON financial_ledger (user_id);
      CREATE INDEX idx_ledger_ref ON financial_ledger (reference_id);
    `);

    // Immutability Trigger: Never allow UPDATE or DELETE on financial_ledger
    await client.query(`
      CREATE OR REPLACE FUNCTION fn_prevent_ledger_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'IMMUTABLE_RECORD: UPDATE and DELETE operations are strictly prohibited on financial_ledger. All corrections must be signed reversing entries.';
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_financial_ledger_immutable
      BEFORE UPDATE OR DELETE ON financial_ledger
      FOR EACH ROW EXECUTE FUNCTION fn_prevent_ledger_modification();
    `);

    // 8. Withdrawals Table
    await client.query(`
      CREATE TABLE withdrawals (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
        amount NUMERIC,
        fee_paise BIGINT NOT NULL DEFAULT 0,
        net_payout_paise BIGINT NOT NULL CHECK (net_payout_paise > 0),
        beneficiary_id TEXT NOT NULL REFERENCES beneficiaries(id),
        channel VARCHAR(50) NOT NULL,
        settlement_type VARCHAR(50) NOT NULL DEFAULT 'T1',
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUBMITTED_TO_BANK', 'COMPLETED', 'APPROVED', 'REJECTED')),
        utr TEXT,
        batch_id TEXT,
        submitted_to_bank_at TIMESTAMPTZ,
        admin_remark TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        verified_at TIMESTAMPTZ
      );
      CREATE UNIQUE INDEX uq_withdrawals_utr_completed ON withdrawals (utr) WHERE status IN ('COMPLETED', 'APPROVED') AND utr IS NOT NULL;
    `);

    // 8.1 Payout Batches
    await client.query(`
      CREATE TABLE payout_batches (
        id TEXT PRIMARY KEY,
        batch_tag TEXT,
        bank_name TEXT,
        total_payouts INTEGER NOT NULL,
        total_amount_paise BIGINT NOT NULL,
        csv_content TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 9. Idempotency Keys Table
    await client.query(`
      CREATE TABLE idempotency_keys (
        key VARCHAR(255) PRIMARY KEY,
        endpoint VARCHAR(100) NOT NULL,
        response_code INTEGER NOT NULL,
        response_body JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 10. Inquiries Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        merchant_id TEXT,
        amount TEXT,
        category TEXT,
        location TEXT,
        status TEXT DEFAULT 'New',
        remarks TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('[Test DB] Clean schema initialized successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
