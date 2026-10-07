import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgres://ronav_admin:RonavSecure2026!Fintech@localhost:5432/ronav_db';

let pool = null;

try {
  pool = new Pool({
    connectionString,
    ssl: process.env.PG_SSL === 'false' ? false : (process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  console.log('[PostgreSQL] Connected to live enterprise database pool.');
} catch (err) {
  console.error('[PostgreSQL] Database pool initialization error:', err.message);
}

export function getPool() {
  return pool;
}

/**
 * Execute raw SQL parameterized query strictly against PostgreSQL
 */
export async function query(sql, params = []) {
  if (!pool) {
    throw new Error('[Database Error] PostgreSQL pool is not initialized.');
  }
  const res = await pool.query(sql, params);
  return res.rows;
}

/**
 * Generic Table Select with filter support
 */
export async function selectFromTable(table, filters = {}, options = {}) {
  const allowedTables = ['users', 'wallets', 'merchant_pos', 'transactions', 'withdrawals', 'beneficiaries', 'inquiries', 'media_files'];
  if (!allowedTables.includes(table)) {
    throw new Error(`Table "${table}" is not allowed.`);
  }

  let sql = `SELECT * FROM ${table} WHERE 1=1`;
  const params = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      params.push(value);
      sql += ` AND ${key} = $${params.length}`;
    }
  }

  if (options.orderBy) {
    sql += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'DESC'}`;
  }

  if (options.limit) {
    params.push(options.limit);
    sql += ` LIMIT $${params.length}`;
  }

  return await query(sql, params);
}

/**
 * Generic Insert into Table with atomic Conflict Resolution
 */
export async function insertIntoTable(table, data) {
  const allowedTables = ['users', 'wallets', 'merchant_pos', 'transactions', 'withdrawals', 'beneficiaries', 'inquiries', 'media_files'];
  if (!allowedTables.includes(table)) {
    throw new Error(`Table "${table}" is not allowed.`);
  }

  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

  const primaryKeys = {
    users: 'id',
    wallets: 'user_id',
    merchant_pos: 'merchant_id',
    transactions: 'id',
    withdrawals: 'id',
    beneficiaries: 'id',
    inquiries: 'id',
    media_files: 'id',
  };
  const pk = primaryKeys[table] || 'id';

  const sql = `
    INSERT INTO ${table} (${keys.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (${pk}) DO UPDATE SET ${keys.map(k => `${k} = EXCLUDED.${k}`).join(', ')}
    RETURNING *;
  `;

  const rows = await query(sql, values);
  return rows[0] || data;
}

/**
 * Generic Update in Table
 */
export async function updateTable(table, data, matchColumn, matchValue) {
  const allowedTables = ['users', 'wallets', 'merchant_pos', 'transactions', 'withdrawals', 'beneficiaries', 'inquiries', 'media_files'];
  if (!allowedTables.includes(table)) {
    throw new Error(`Table "${table}" is not allowed.`);
  }

  const keys = Object.keys(data);
  const values = Object.values(data);
  values.push(matchValue);

  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const matchIndex = values.length;

  const sql = `
    UPDATE ${table}
    SET ${setClause}
    WHERE ${matchColumn} = $${matchIndex}
    RETURNING *;
  `;

  return await query(sql, values);
}

/**
 * Generic Delete from Table
 */
export async function deleteFromTable(table, matchColumn, matchValue) {
  const allowedTables = ['users', 'wallets', 'merchant_pos', 'transactions', 'withdrawals', 'beneficiaries', 'inquiries', 'media_files'];
  if (!allowedTables.includes(table)) {
    throw new Error(`Table "${table}" is not allowed.`);
  }

  const sql = `DELETE FROM ${table} WHERE ${matchColumn} = $1 RETURNING *;`;
  return await query(sql, [matchValue]);
}

/**
 * Record media file in PostgreSQL
 */
export async function recordMediaFile({ id, merchant_id, file_name, s3_key, s3_url, cdn_url, mime_type, file_size_bytes, entity_type, entity_id }) {
  const mediaId = id || `MED-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  return await insertIntoTable('media_files', {
    id: mediaId,
    merchant_id: merchant_id || null,
    file_name,
    s3_key,
    s3_url,
    cdn_url: cdn_url || s3_url,
    mime_type: mime_type || 'application/octet-stream',
    file_size_bytes: file_size_bytes || 0,
    entity_type: entity_type || 'GENERAL',
    entity_id: entity_id || null,
    status: 'ACTIVE',
  });
}

/**
 * Query media files
 */
export async function getMediaFiles(merchant_id = null, entity_type = null) {
  const filters = {};
  if (merchant_id) filters.merchant_id = merchant_id;
  if (entity_type) filters.entity_type = entity_type;
  return await selectFromTable('media_files', filters, { orderBy: 'created_at', orderDirection: 'DESC' });
}

/**
 * Auto-Initialize & Verify PostgreSQL Connection
 */
export async function initPostgresSchema() {
  if (!pool) return false;
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (err) {
    console.error('[PostgreSQL] Connection check failed:', err.message);
    return false;
  }
}
