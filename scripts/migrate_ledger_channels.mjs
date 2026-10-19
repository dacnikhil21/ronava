// scripts/migrate_ledger_channels.mjs
// One-time migration to set each untagged financial_ledger row's channel from its linked transaction or withdrawal.
// Never guesses. If any row cannot be matched, lists it and stops.

process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_test_db';

import pg from 'pg';

async function migrate() {
  const pool = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL
  });

  const client = await pool.connect();
  try {
    console.log('--- EXECUTING ONE-TIME LEDGER CHANNEL MIGRATION ---');

    // 1. Find all untagged ledger rows
    const untaggedRes = await client.query(`
      SELECT l.id, l.user_id, l.type, l.amount_paise, l.reference_id, l.reference_type, l.channel,
             t.channel as txn_channel,
             w.channel as wth_channel
      FROM financial_ledger l
      LEFT JOIN transactions t ON l.reference_id = t.id
      LEFT JOIN withdrawals w ON l.reference_id = w.id
      WHERE l.channel IS NULL OR TRIM(l.channel) = ''
      ORDER BY l.id ASC
    `);

    const untaggedRows = untaggedRes.rows;
    console.log(`Found ${untaggedRows.length} untagged financial_ledger row(s).`);

    if (untaggedRows.length === 0) {
      console.log('✓ No untagged financial_ledger rows found. All rows already have authoritative channel tags.');
      return;
    }

    // 2. Check for unmatched rows
    const unmatched = [];
    const matched = [];

    for (const row of untaggedRows) {
      const targetChannel = (row.txn_channel || row.wth_channel || '').trim().toLowerCase();
      if (!targetChannel) {
        unmatched.push(row);
      } else {
        matched.push({ id: row.id, channel: targetChannel, ref: row.reference_id });
      }
    }

    if (unmatched.length > 0) {
      console.error('\n🚨 STOPPING: Found unmatched financial_ledger rows with no linked transaction/withdrawal:');
      console.error(JSON.stringify(unmatched, null, 2));
      throw new Error(`CANNOT_GUESS_CHANNELS: ${unmatched.length} ledger row(s) could not be matched to an authoritative transaction or withdrawal. Stopping for user decision.`);
    }

    // 3. Apply updates inside a transaction with trigger temporarily disabled
    await client.query('BEGIN');
    console.log('Disabling immutability trigger for migration...');
    await client.query('ALTER TABLE financial_ledger DISABLE TRIGGER trg_financial_ledger_immutable');

    for (const m of matched) {
      await client.query('UPDATE financial_ledger SET channel = $1 WHERE id = $2', [m.channel, m.id]);
      console.log(`Updated ledger row ${m.id} -> channel '${m.channel}' (from ref ${m.ref})`);
    }

    console.log('Re-enabling immutability trigger...');
    await client.query('ALTER TABLE financial_ledger ENABLE TRIGGER trg_financial_ledger_immutable');
    await client.query('COMMIT');

    console.log(`✓ Successfully migrated ${matched.length} ledger row(s) to authoritative channels.`);
  } catch (err) {
    try {
      await client.query('ALTER TABLE financial_ledger ENABLE TRIGGER trg_financial_ledger_immutable').catch(() => {});
      await client.query('ROLLBACK').catch(() => {});
    } catch (_) {}
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('\n❌ Migration Failed:', err);
  process.exit(1);
});
