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
 * Set a user's rate for a specific channel and settlement mode with versioning.
 * Closes existing active version with effective_to = effectiveFrom, and opens a new version.
 */
export async function setUserRate(client, {
  userId,
  channel,
  settlementMode = null,
  rateBps,
  needsReview = false,
  effectiveFrom = new Date()
}) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('DATABASE_CLIENT_REQUIRED: setUserRate requires an active database client.');
  }
  if (!userId || !channel) {
    throw new Error('INVALID_ARGUMENT: userId and channel are required.');
  }

  const ch = channel.toLowerCase().replace(/[^a-z0-9]/g, '');
  const mode = (settlementMode || (ch === 'qr' || ch === 'companyqr' ? 'NONE' : 'T1')).toUpperCase();

  if (ch === 'qr' || ch === 'companyqr') {
    if (mode !== 'NONE') {
      throw new Error('INVALID_SETTLEMENT_MODE: QR channel must have settlement_mode NONE.');
    }
  } else if (ch === 'pinelabs' || ch === 'payswiff') {
    if (mode !== 'T1' && mode !== 'INSTANT') {
      throw new Error(`INVALID_SETTLEMENT_MODE: Channel "${channel}" requires settlement_mode T1 or INSTANT.`);
    }
  } else {
    if (mode !== 'T1' && mode !== 'INSTANT' && mode !== 'NONE') {
      throw new Error(`INVALID_SETTLEMENT_MODE: Invalid settlement mode "${mode}".`);
    }
  }

  const rate = Number(rateBps);
  if (isNaN(rate) || rate < 0 || rate > 10000) {
    throw new Error('INVALID_RATE_VALUE: rateBps must be an integer between 0 and 10000.');
  }

  const effFrom = effectiveFrom instanceof Date ? effectiveFrom : new Date(effectiveFrom);

  // 1. Close current active rate for this specific channel and mode
  await client.query(`
    UPDATE user_channel_rates
    SET effective_to = $4
    WHERE user_id = $1 AND channel = $2 AND settlement_mode = $3 AND effective_to IS NULL
  `, [userId, ch, mode, effFrom.toISOString()]);

  // 2. Insert new active rate
  const res = await client.query(`
    INSERT INTO user_channel_rates (user_id, channel, settlement_mode, rate_bps, needs_review, effective_from, effective_to)
    VALUES ($1, $2, $3, $4, $5, $6, NULL)
    RETURNING id, user_id, channel, settlement_mode, rate_bps, needs_review, effective_from, effective_to
  `, [userId, ch, mode, Math.round(rate), Boolean(needsReview), effFrom.toISOString()]);

  return res.rows[0];
}

/**
 * Get active rate for a user, channel, and settlement mode at a specific date.
 * If no specific rate is configured for the user, falls back to default setting in system_settings.
 */
export async function getActiveRate(client, {
  userId,
  channel,
  settlementMode = null,
  asOfDate = new Date()
}) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('DATABASE_CLIENT_REQUIRED: getActiveRate requires an active database client.');
  }
  if (!userId || !channel) {
    throw new Error('INVALID_ARGUMENT: userId and channel are required.');
  }

  const ch = channel.toLowerCase().replace(/[^a-z0-9]/g, '');
  const mode = (settlementMode || (ch === 'qr' || ch === 'companyqr' ? 'NONE' : 'T1')).toUpperCase();

  if (ch === 'qr' || ch === 'companyqr') {
    if (mode !== 'NONE') {
      throw new Error('INVALID_SETTLEMENT_MODE: QR channel must have settlement_mode NONE.');
    }
  } else if (ch === 'pinelabs' || ch === 'payswiff') {
    if (mode !== 'T1' && mode !== 'INSTANT') {
      throw new Error(`INVALID_SETTLEMENT_MODE: Channel "${channel}" requires settlement_mode T1 or INSTANT.`);
    }
  }

  const targetDate = asOfDate instanceof Date ? asOfDate : new Date(asOfDate);

  const res = await client.query(`
    SELECT id, user_id, channel, settlement_mode, rate_bps, needs_review, effective_from, effective_to
    FROM user_channel_rates
    WHERE user_id = $1 
      AND channel = $2 
      AND settlement_mode = $3
      AND effective_from <= $4 
      AND (effective_to IS NULL OR effective_to > $4)
    ORDER BY effective_from DESC
    LIMIT 1
  `, [userId, ch, mode, targetDate.toISOString()]);

  if (res.rows && res.rows.length > 0) {
    return {
      rate_bps: Number(res.rows[0].rate_bps),
      settlement_mode: res.rows[0].settlement_mode,
      is_default: false,
      record: res.rows[0]
    };
  }

  // Fallback to database system_settings table (NOT hardcoded)
  const modeSettingKey = ch === 'qr' || ch === 'companyqr'
    ? 'default_qr_rate_bps'
    : `default_${ch}_${mode.toLowerCase()}_rate_bps`;

  try {
    const defaultSetting = await getSetting(modeSettingKey, client);
    return {
      rate_bps: Number(defaultSetting.value_numeric || 0),
      settlement_mode: mode,
      is_default: true,
      record: null
    };
  } catch (_) {
    try {
      const channelSetting = await getSetting(`default_${ch}_rate_bps`, client);
      return {
        rate_bps: Number(channelSetting.value_numeric || 0),
        settlement_mode: mode,
        is_default: true,
        record: null
      };
    } catch (__) {
      const adminCut = await getSetting('default_admin_cut_bps', client);
      return {
        rate_bps: Number(adminCut.value_numeric || 60),
        settlement_mode: mode,
        is_default: true,
        record: null
      };
    }
  }
}

