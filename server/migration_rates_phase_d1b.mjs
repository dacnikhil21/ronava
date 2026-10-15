/**
 * Migration Script: Phase D1b Rate Model & Settlement Modes
 * - Adds settlement_mode (T1, INSTANT, NONE) and needs_review to user_channel_rates
 * - Copies existing channel rates to BOTH modes (T1 and INSTANT) for Pine Labs and Payswiff
 * - Marks migrated rows needs_review = TRUE
 * - Sets QR rows to settlement_mode = 'NONE', needs_review = FALSE
 * - Preserves historical versioning
 * - Returns list of affected users
 */

export async function runRateModelMigration(client) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('DATABASE_CLIENT_REQUIRED: runRateModelMigration requires an active client.');
  }

  // 1. Ensure columns exist on user_channel_rates
  await client.query(`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_channel_rates' AND column_name = 'settlement_mode'
      ) THEN 
        ALTER TABLE user_channel_rates ADD COLUMN settlement_mode VARCHAR(20) DEFAULT 'T1';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_channel_rates' AND column_name = 'needs_review'
      ) THEN 
        ALTER TABLE user_channel_rates ADD COLUMN needs_review BOOLEAN DEFAULT FALSE;
      END IF;
    END $$;
  `);

  // 2. Fetch all current rates
  const rowsRes = await client.query(`
    SELECT id, user_id, channel, rate_bps, settlement_mode, needs_review, effective_from, effective_to
    FROM user_channel_rates
    ORDER BY id ASC
  `);

  const affectedUsersSet = new Set();
  let migratedCount = 0;
  let createdInstantCount = 0;

  for (const row of rowsRes.rows) {
    const ch = (row.channel || '').toLowerCase().replace(/[^a-z]/g, '');

    if (ch === 'qr' || ch === 'companyqr') {
      // QR stays a single rate with NONE mode
      await client.query(`
        UPDATE user_channel_rates
        SET settlement_mode = 'NONE', needs_review = FALSE
        WHERE id = $1
      `, [row.id]);
    } else if (ch === 'pinelabs' || ch === 'payswiff') {
      affectedUsersSet.add(row.user_id);

      // Set existing row to T1 and needs_review = TRUE
      await client.query(`
        UPDATE user_channel_rates
        SET settlement_mode = 'T1', needs_review = TRUE
        WHERE id = $1
      `, [row.id]);
      migratedCount++;

      // Check if an INSTANT mode row already exists for this user, channel, and effective_from
      const checkInst = await client.query(`
        SELECT id FROM user_channel_rates 
        WHERE user_id = $1 AND channel = $2 AND settlement_mode = 'INSTANT'
          AND (effective_to IS NULL OR effective_to = $3)
      `, [row.user_id, row.channel, row.effective_to]);

      if (checkInst.rows.length === 0) {
        await client.query(`
          INSERT INTO user_channel_rates (
            user_id, channel, settlement_mode, rate_bps, needs_review, effective_from, effective_to
          ) VALUES ($1, $2, 'INSTANT', $3, TRUE, $4, $5)
        `, [
          row.user_id,
          row.channel,
          row.rate_bps,
          row.effective_from,
          row.effective_to
        ]);
        createdInstantCount++;
      }
    }
  }

  const affectedUsers = Array.from(affectedUsersSet);

  return {
    success: true,
    affectedUsersCount: affectedUsers.length,
    affectedUsers,
    migratedT1RowsCount: migratedCount,
    createdInstantRowsCount: createdInstantCount
  };
}
