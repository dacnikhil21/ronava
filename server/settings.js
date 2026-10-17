import { pgQuery } from './pg_db.js';

/**
 * Fetch a single setting from PostgreSQL system_settings table.
 * Throws a descriptive error if the setting does not exist (no silent fallback).
 */
export async function getSetting(key, dbClient = null) {
  if (!key || typeof key !== 'string') {
    throw new Error('INVALID_ARGUMENT: Setting key must be a non-empty string.');
  }

  const queryFn = dbClient 
    ? (sql, params) => dbClient.query(sql, params).then(r => r.rows || r)
    : pgQuery;

  const rows = await queryFn(
    `SELECT key, value_numeric, value_text, value_json, description, updated_by, updated_at 
     FROM system_settings 
     WHERE key = $1`,
    [key]
  );

  if (!rows || rows.length === 0) {
    throw new Error(`SETTING_NOT_FOUND: Required setting "${key}" is missing in system_settings table.`);
  }

  const row = rows[0];
  return {
    key: row.key,
    value_numeric: row.value_numeric !== null ? Number(row.value_numeric) : null,
    value_text: row.value_text,
    value_json: row.value_json,
    description: row.description,
    updated_by: row.updated_by,
    updated_at: row.updated_at
  };
}

/**
 * Fetch all system settings as a key-value dictionary.
 */
export async function getAllSettings(dbClient = null) {
  const queryFn = dbClient 
    ? (sql, params) => dbClient.query(sql, params).then(r => r.rows || r)
    : pgQuery;

  const rows = await queryFn(
    `SELECT key, value_numeric, value_text, value_json, description FROM system_settings`
  );

  const settings = {};
  for (const r of rows) {
    settings[r.key] = {
      value_numeric: r.value_numeric !== null ? Number(r.value_numeric) : null,
      value_text: r.value_text,
      value_json: r.value_json,
      description: r.description
    };
  }
  return settings;
}

/**
 * Update a setting in PostgreSQL.
 */
export async function updateSetting(key, { value_numeric, value_text, value_json }, updatedBy, dbClient = null) {
  if (!key) {
    throw new Error('INVALID_ARGUMENT: Setting key must be specified.');
  }
  if (!updatedBy) {
    throw new Error('CALLER_IDENTIFICATION_REQUIRED: updatedBy is required.');
  }

  const queryFn = dbClient 
    ? (sql, params) => dbClient.query(sql, params).then(r => r.rows || r)
    : pgQuery;

  const rows = await queryFn(
    `UPDATE system_settings 
     SET value_numeric = COALESCE($1, value_numeric),
         value_text = COALESCE($2, value_text),
         value_json = COALESCE($3, value_json),
         updated_by = $4,
         updated_at = NOW()
     WHERE key = $5
     RETURNING key, value_numeric, value_text, value_json`,
    [
      value_numeric !== undefined ? value_numeric : null,
      value_text !== undefined ? value_text : null,
      value_json !== undefined ? JSON.stringify(value_json) : null,
      updatedBy,
      key
    ]
  );

  if (!rows || rows.length === 0) {
    throw new Error(`SETTING_NOT_FOUND: Cannot update non-existent setting "${key}".`);
  }

  return rows[0];
}
