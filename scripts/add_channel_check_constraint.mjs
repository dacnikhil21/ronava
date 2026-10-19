import pg from 'pg';

async function addConstraint() {
  const pool = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_test_db'
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Adding chk_financial_ledger_channel constraint to financial_ledger...');
    await client.query(`
      ALTER TABLE financial_ledger 
      DROP CONSTRAINT IF EXISTS chk_financial_ledger_channel;
    `);
    await client.query(`
      ALTER TABLE financial_ledger
      ADD CONSTRAINT chk_financial_ledger_channel CHECK (
        (type NOT IN ('swipe_credit', 'commission', 'withdrawal_hold', 'withdrawal_paid', 'withdrawal_reversal', 'adjustment', 'refund'))
        OR (channel IS NOT NULL AND channel IN ('pinelabs', 'payswiff', 'qr'))
      );
    `);
    await client.query('COMMIT');
    console.log('✓ Successfully added chk_financial_ledger_channel constraint.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

addConstraint().catch((err) => {
  console.error('Error adding constraint:', err);
  process.exit(1);
});
