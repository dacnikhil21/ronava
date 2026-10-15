import { getSetting } from './settings.js';

/**
 * Validate rate values and hierarchy rule (child >= parent)
 */
export function validateHierarchyRates(childRateBps, parentRateBps = 0) {
  const child = Number(childRateBps);
  const parent = Number(parentRateBps);

  if (isNaN(child) || isNaN(parent)) {
    throw new Error('INVALID_RATE_VALUE: Rate must be a valid number.');
  }

  if (child < 0 || parent < 0) {
    throw new Error('INVALID_RATE_VALUE: Rates cannot be negative.');
  }

  if (child > 10000 || parent > 10000) {
    throw new Error('INVALID_RATE_VALUE: Rates cannot exceed 10000 basis points (100%).');
  }

  if (child < parent) {
    throw new Error(
      `INVALID_RATE_HIERARCHY: Child rate (${child} bps) cannot be lower than parent rate (${parent} bps).`
    );
  }

  return true;
}

/**
 * Set a user's rate for a specific channel with versioning.
 * Closes existing active version with effective_to = effectiveFrom, and opens a new version.
 */
export async function setUserRate(client, {
  userId,
  channel,
  rateBps,
  effectiveFrom = new Date()
}) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('DATABASE_CLIENT_REQUIRED: setUserRate requires an active database client.');
  }
  if (!userId || !channel) {
    throw new Error('INVALID_ARGUMENT: userId and channel are required.');
  }

  const rate = Number(rateBps);
  if (isNaN(rate) || rate < 0 || rate > 10000) {
    throw new Error('INVALID_RATE_VALUE: rateBps must be an integer between 0 and 10000.');
  }

  const effFrom = effectiveFrom instanceof Date ? effectiveFrom : new Date(effectiveFrom);

  // 1. Close current active rate
  await client.query(`
    UPDATE user_channel_rates
    SET effective_to = $3
    WHERE user_id = $1 AND channel = $2 AND effective_to IS NULL
  `, [userId, channel, effFrom.toISOString()]);

  // 2. Insert new active rate
  const res = await client.query(`
    INSERT INTO user_channel_rates (user_id, channel, rate_bps, effective_from, effective_to)
    VALUES ($1, $2, $3, $4, NULL)
    RETURNING id, user_id, channel, rate_bps, effective_from, effective_to
  `, [userId, channel, Math.round(rate), effFrom.toISOString()]);

  return res.rows[0];
}

/**
 * Get active rate for a user and channel at a specific date.
 * If no specific rate is configured for the user, falls back to default setting in system_settings.
 */
export async function getActiveRate(client, {
  userId,
  channel,
  asOfDate = new Date()
}) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('DATABASE_CLIENT_REQUIRED: getActiveRate requires an active database client.');
  }
  if (!userId || !channel) {
    throw new Error('INVALID_ARGUMENT: userId and channel are required.');
  }

  const targetDate = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);

  const res = await client.query(`
    SELECT id, user_id, channel, rate_bps, effective_from, effective_to
    FROM user_channel_rates
    WHERE user_id = $1 
      AND channel = $2 
      AND effective_from <= $3 
      AND (effective_to IS NULL OR effective_to > $3)
    ORDER BY effective_from DESC
    LIMIT 1
  `, [userId, channel, targetDate.toISOString()]);

  if (res.rows && res.rows.length > 0) {
    return {
      rate_bps: Number(res.rows[0].rate_bps),
      is_default: false,
      record: res.rows[0]
    };
  }

  // Fallback to database system_settings table (NOT hardcoded)
  const settingKey = `default_${channel.toLowerCase()}_rate_bps`;
  try {
    const defaultSetting = await getSetting(settingKey, client);
    return {
      rate_bps: Number(defaultSetting.value_numeric || 0),
      is_default: true,
      record: null
    };
  } catch (_) {
    // If no setting, check generic default or throw
    const adminCut = await getSetting('default_admin_cut_bps', client);
    return {
      rate_bps: Number(adminCut.value_numeric || 60),
      is_default: true,
      record: null
    };
  }
}
