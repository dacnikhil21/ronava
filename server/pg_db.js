import pg from 'pg';
import { db as sqliteDb } from './db.js';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let pool = null;

if (connectionString) {
  pool = new Pool({
    connectionString,
    ssl: process.env.PG_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  console.log('[PostgreSQL] Connected to database pool.');
} else {
  console.log('[Database] No DATABASE_URL found. Operating in SQLite local mode.');
}

export function getPool() {
  return pool;
}

/**
 * Execute raw SQL parameterized query
 */
export async function query(sql, params = []) {
  if (pool) {
    const res = await pool.query(sql, params);
    return res.rows;
  }
  // SQLite fallback
  try {
    let sqliteSql = sql;
    // Replace $1, $2 with ? for SQLite
    let paramIndex = 1;
    while (sqliteSql.includes(`$${paramIndex}`)) {
      sqliteSql = sqliteSql.replace(`$${paramIndex}`, '?');
      paramIndex++;
    }
    if (sqliteSql.trim().toUpperCase().startsWith('SELECT')) {
      return sqliteDb.prepare(sqliteSql).all(...params);
    } else {
      const info = sqliteDb.prepare(sqliteSql).run(...params);
      return [info];
    }
  } catch (err) {
    console.error('[Database Query Error]:', err.message, sql);
    throw err;
  }
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
 * Generic Insert into Table
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

  if (pool) {
    const res = await pool.query(sql, values);
    return res.rows[0];
  }

  // SQLite fallback
  const sqliteSql = `
    INSERT OR REPLACE INTO ${table} (${keys.join(', ')})
    VALUES (${keys.map(() => '?').join(', ')});
  `;
  sqliteDb.prepare(sqliteSql).run(...values);
  return data;
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

  if (pool) {
    const res = await pool.query(sql, values);
    return res.rows;
  }

  // SQLite fallback
  const sqliteSetClause = keys.map(k => `${k} = ?`).join(', ');
  const sqliteSql = `UPDATE ${table} SET ${sqliteSetClause} WHERE ${matchColumn} = ?;`;
  sqliteDb.prepare(sqliteSql).run(...values);
  return [data];
}

/**
 * Record media file in PostgreSQL or SQLite
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
 * Auto-Initialize Schema if needed
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
