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
  console.log('[PostgreSQL] Initialized connection pool with DATABASE_URL.');
} else {
  console.log('[Database] No PostgreSQL DATABASE_URL detected. Running with SQLite + Supabase.');
}

/**
 * Initialize relational schema on PostgreSQL (including media_files table)
 */
export async function initPostgresSchema() {
  if (!pool) return false;

  const client = await pool.connect();
  try {
    console.log('[PostgreSQL] Initializing tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS media_files (
        id VARCHAR(64) PRIMARY KEY,
        merchant_id VARCHAR(50),
        file_name VARCHAR(255) NOT NULL,
        s3_key VARCHAR(500) NOT NULL,
        s3_url TEXT NOT NULL,
        cdn_url TEXT,
        mime_type VARCHAR(100),
        file_size_bytes BIGINT DEFAULT 0,
        entity_type VARCHAR(50) DEFAULT 'GENERAL', -- 'KYC_AADHAAR', 'KYC_PAN', 'LOAN_DOC', 'RECEIPT', 'AVATAR'
        entity_id VARCHAR(100),
        status VARCHAR(20) DEFAULT 'ACTIVE',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS merchants (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        business_name VARCHAR(255),
        phone VARCHAR(20) NOT NULL,
        email VARCHAR(255),
        role VARCHAR(50) DEFAULT 'MERCHANT',
        status VARCHAR(20) DEFAULT 'ACTIVE',
        wallet_balance NUMERIC(15,2) DEFAULT 0.00,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(64) PRIMARY KEY,
        merchant_id VARCHAR(50),
        type VARCHAR(50) NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'SUCCESS',
        description TEXT,
        customer_name VARCHAR(255),
        customer_phone VARCHAR(20),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS beneficiaries (
        id VARCHAR(64) PRIMARY KEY,
        merchant_id VARCHAR(50),
        account_number VARCHAR(50) NOT NULL,
        ifsc VARCHAR(20) NOT NULL,
        beneficiary_name VARCHAR(255) NOT NULL,
        bank_name VARCHAR(255),
        is_primary BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS inquiries (
        id VARCHAR(64) PRIMARY KEY,
        type VARCHAR(50) NOT NULL, -- 'LOAN', 'FRANCHISE', 'POS'
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        merchant_id VARCHAR(50),
        amount VARCHAR(50),
        category VARCHAR(100),
        location VARCHAR(255),
        remarks TEXT,
        status VARCHAR(20) DEFAULT 'NEW',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_media_merchant ON media_files(merchant_id);
      CREATE INDEX IF NOT EXISTS idx_media_entity ON media_files(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_txn_merchant ON transactions(merchant_id);
    `);

    console.log('[PostgreSQL] ✓ Schema and media_files table verified successfully.');
    return true;
  } catch (err) {
    console.error('[PostgreSQL] Schema initialization error:', err.message);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Record media file in PostgreSQL or SQLite
 */
export async function recordMediaFile({ id, merchant_id, file_name, s3_key, s3_url, cdn_url, mime_type, file_size_bytes, entity_type, entity_id }) {
  const mediaId = id || `MED-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  if (pool) {
    try {
      const res = await pool.query(`
        INSERT INTO media_files (id, merchant_id, file_name, s3_key, s3_url, cdn_url, mime_type, file_size_bytes, entity_type, entity_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
      `, [mediaId, merchant_id || null, file_name, s3_key, s3_url, cdn_url || s3_url, mime_type || 'application/octet-stream', file_size_bytes || 0, entity_type || 'GENERAL', entity_id || null]);
      return res.rows[0];
    } catch (err) {
      console.error('[PostgreSQL] recordMediaFile error:', err.message);
    }
  }

  // SQLite Fallback
  try {
    sqliteDb.prepare(`
      CREATE TABLE IF NOT EXISTS media_files (
        id TEXT PRIMARY KEY,
        merchant_id TEXT,
        file_name TEXT,
        s3_key TEXT,
        s3_url TEXT,
        cdn_url TEXT,
        mime_type TEXT,
        file_size_bytes INTEGER DEFAULT 0,
        entity_type TEXT DEFAULT 'GENERAL',
        entity_id TEXT,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    sqliteDb.prepare(`
      INSERT OR REPLACE INTO media_files (id, merchant_id, file_name, s3_key, s3_url, cdn_url, mime_type, file_size_bytes, entity_type, entity_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(mediaId, merchant_id || null, file_name, s3_key, s3_url, cdn_url || s3_url, mime_type || 'application/octet-stream', file_size_bytes || 0, entity_type || 'GENERAL', entity_id || null);

    return sqliteDb.prepare(`SELECT * FROM media_files WHERE id = ?`).get(mediaId);
  } catch (err) {
    console.error('[SQLite] recordMediaFile error:', err.message);
    return null;
  }
}

/**
 * Query media files by merchant or entity
 */
export async function getMediaFiles(merchant_id = null, entity_type = null) {
  if (pool) {
    let query = 'SELECT * FROM media_files WHERE 1=1';
    const params = [];
    if (merchant_id) {
      params.push(merchant_id);
      query += ` AND merchant_id = $${params.length}`;
    }
    if (entity_type) {
      params.push(entity_type);
      query += ` AND entity_type = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC';
    const res = await pool.query(query, params);
    return res.rows;
  }

  // SQLite fallback
  try {
    let query = 'SELECT * FROM media_files WHERE 1=1';
    const params = [];
    if (merchant_id) {
      params.push(merchant_id);
      query += ' AND merchant_id = ?';
    }
    if (entity_type) {
      params.push(entity_type);
      query += ' AND entity_type = ?';
    }
    query += ' ORDER BY created_at DESC';
    return sqliteDb.prepare(query).all(...params);
  } catch (err) {
    return [];
  }
}
