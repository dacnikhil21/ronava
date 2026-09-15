import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../ronav.db');

export const db = new DatabaseSync(dbPath);

// Initialize schema
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL, -- 'ADMIN', 'SUPER_DISTRIBUTOR', 'DISTRIBUTOR', 'MERCHANT'
      creator_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS merchant_pos (
      merchant_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL, -- 'Pine Labs' or 'Payswiff'
      terminal_id TEXT NOT NULL,
      commission_rate REAL NOT NULL, -- e.g. 1.53 for T1, 1.83 for Instant
      assigned_by TEXT NOT NULL,
      vendor_entity TEXT DEFAULT 'Rose Navaneetham Enterprises', -- 'Rose Navaneetham Enterprises', 'RONAV Technologies', 'R.P. Technologies'
      device_plan TEXT DEFAULT 'RENTAL', -- 'LIFETIME' or 'RENTAL'
      monthly_rent REAL DEFAULT 499.0,
      settlement_type TEXT DEFAULT 'T1', -- 'T1' or 'INSTANT'
      instant_surcharge REAL DEFAULT 0.0, -- 0.30 for Payswiff Instant
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT PRIMARY KEY,
      available_balance REAL DEFAULT 0.0,
      total_sales REAL DEFAULT 0.0,
      received_sales REAL DEFAULT 0.0,
      pending_balance REAL DEFAULT 0.0,
      withdrawn_amount REAL DEFAULT 0.0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL,
      customer_mobile TEXT,
      amount REAL NOT NULL,
      type TEXT NOT NULL, -- 'POS_SWIPE', 'BBPS_BILL', 'QR_COLLECT', 'ADD_MONEY'
      provider TEXT, -- 'Pine Labs', 'Payswiff', or 'BBPS'
      ref_number TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
      admin_remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      verified_at TEXT,
      FOREIGN KEY (merchant_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL,
      amount REAL NOT NULL,
      bank_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      ifsc TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
      admin_remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      verified_at TEXT,
      FOREIGN KEY (merchant_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS beneficiaries (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      ifsc TEXT NOT NULL,
      holder_name TEXT NOT NULL,
      is_primary INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- 'LOAN', 'FRANCHISE', 'TERMINAL_SUPPORT'
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      merchant_id TEXT,
      amount TEXT,
      category TEXT,
      location TEXT,
      status TEXT DEFAULT 'New',
      remarks TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe runtime migrations for existing databases
  try { db.exec(`ALTER TABLE merchant_pos ADD COLUMN vendor_entity TEXT DEFAULT 'Rose Navaneetham Enterprises'`); } catch(e){}
  try { db.exec(`ALTER TABLE merchant_pos ADD COLUMN device_plan TEXT DEFAULT 'RENTAL'`); } catch(e){}
  try { db.exec(`ALTER TABLE merchant_pos ADD COLUMN monthly_rent REAL DEFAULT 499.0`); } catch(e){}
  try { db.exec(`ALTER TABLE merchant_pos ADD COLUMN settlement_type TEXT DEFAULT 'T1'`); } catch(e){}
  try { db.exec(`ALTER TABLE merchant_pos ADD COLUMN instant_surcharge REAL DEFAULT 0.0`); } catch(e){}

  try { db.exec(`ALTER TABLE transactions ADD COLUMN vendor_entity TEXT DEFAULT 'Rose Navaneetham Enterprises'`); } catch(e){}
  try { db.exec(`ALTER TABLE transactions ADD COLUMN settlement_type TEXT DEFAULT 'T1'`); } catch(e){}
  try { db.exec(`ALTER TABLE transactions ADD COLUMN instant_fee REAL DEFAULT 0.0`); } catch(e){}
  try { db.exec(`ALTER TABLE transactions ADD COLUMN admin_margin REAL DEFAULT 0.0`); } catch(e){}

  // Seed default Super Admin account if not exists
  const existingAdmin = db.prepare(`SELECT * FROM users WHERE role = 'ADMIN'`).get();
  if (!existingAdmin) {
    seedDefaultData();
  }
}

function seedDefaultData() {
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, mobile, role, creator_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertWallet = db.prepare(`
    INSERT INTO wallets (user_id, available_balance, total_sales, received_sales, pending_balance, withdrawn_amount)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // 1. Super Admin ONLY
  insertUser.run('ADM001', 'RONAV Super Admin', '9966203053', 'ADMIN', null);
  insertWallet.run('ADM001', 0.0, 0.0, 0.0, 0.0, 0.0);
}


// Automatically init database
initDatabase();
