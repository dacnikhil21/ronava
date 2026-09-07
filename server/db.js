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
      commission_rate REAL NOT NULL, -- e.g. 1.25 for Pine Labs, 1.65 for Payswiff
      assigned_by TEXT NOT NULL,
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

  // Seed default hierarchy accounts if not exists
  const existingAdmin = db.prepare(`SELECT * FROM users WHERE role = 'ADMIN'`).get();
  if (!existingAdmin) {
    seedDefaultData();
  } else {
    // Check if beneficiaries need seeding
    const benCount = db.prepare(`SELECT COUNT(*) as count FROM beneficiaries`).get();
    if (benCount && benCount.count === 0) {
      seedBeneficiaries();
    }
  }

  // Seed default inquiries if empty
  const inqCount = db.prepare(`SELECT COUNT(*) as count FROM inquiries`).get();
  if (inqCount && inqCount.count === 0) {
    seedInquiries();
  }
}

function seedInquiries() {
  const insertInquiry = db.prepare(`
    INSERT OR IGNORE INTO inquiries (id, type, name, phone, merchant_id, amount, category, location, status, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertInquiry.run('LN-9801', 'LOAN', 'Ramesh Kumar', '9876543210', 'MID3001', '₹2,50,000', 'Personal Loan', 'Hyderabad', 'New', 'KYC check passed. Zero payslip.');
  insertInquiry.run('LN-9802', 'LOAN', 'Suresh Babu', '9123456780', null, '₹10,00,000', 'Business Loan', 'Secunderabad', 'Under Review', 'Awaiting GST returns submission.');
  insertInquiry.run('FR-4501', 'FRANCHISE', 'Rajesh Goud', '9000123456', null, '₹5,00,000', 'ATM & CDM Franchise', 'Secunderabad, Hyd', 'New', '120 sq ft commercial space available.');
  insertInquiry.run('FR-4502', 'FRANCHISE', 'Kalyan Chakravarthy', '8887776655', null, '₹7,50,000', 'WLA CDM Franchise', 'Vijayawada, AP', 'Approved', 'Site passed inspection.');
}

function seedBeneficiaries() {
  const insertBeneficiary = db.prepare(`
    INSERT OR IGNORE INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_primary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertBeneficiary.run('BEN-01', 'MID3001', 'State Bank of India', '30891245678', 'SBIN0001234', 'Ravi Kumar', 1);
  insertBeneficiary.run('BEN-02', 'MID3001', 'HDFC Bank', '50100456789', 'HDFC0000456', 'Ravi Kumar', 0);
  insertBeneficiary.run('BEN-03', 'MID3001', 'ICICI Bank', '00234567890', 'ICIC0000234', 'Ravi Kumar', 0);

  insertBeneficiary.run('BEN-04', 'MID3002', 'Canara Bank', '11002233445', 'CNRB0001122', 'Lakshmi Devi', 1);
  insertBeneficiary.run('BEN-05', 'MID3002', 'Axis Bank', '91901002345', 'UTIB0000919', 'Lakshmi Devi', 0);
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

  const insertPOS = db.prepare(`
    INSERT INTO merchant_pos (merchant_id, provider, terminal_id, commission_rate, assigned_by)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertTxn = db.prepare(`
    INSERT INTO transactions (id, merchant_id, customer_mobile, amount, type, provider, ref_number, notes, status, created_at, verified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Super Admin
  insertUser.run('ADM001', 'RONAV Super Admin', '9966203053', 'ADMIN', null);
  insertWallet.run('ADM001', 500000.0, 1250000.0, 1200000.0, 0.0, 50000.0);

  // 2. Super Distributor (Created by Admin)
  insertUser.run('SD1001', 'Ronav South Hub (SD)', '9848011223', 'SUPER_DISTRIBUTOR', 'ADM001');
  insertWallet.run('SD1001', 85000.0, 340000.0, 310000.0, 15000.0, 15000.0);

  // 3. Distributor (Created by Super Distributor)
  insertUser.run('DIST2001', 'Sri Sai Distribution', '9848099887', 'DISTRIBUTOR', 'SD1001');
  insertWallet.run('DIST2001', 42000.0, 180000.0, 165000.0, 8000.0, 7000.0);

  // 4. Merchant A — Pine Labs (Created by Distributor)
  insertUser.run('MID3001', 'Ravi Kirana Store', '9876543210', 'MERCHANT', 'DIST2001');
  insertWallet.run('MID3001', 24560.75, 185000.0, 160439.25, 3500.0, 135000.0);
  insertPOS.run('MID3001', 'Pine Labs', 'PL-HYD-9941', 1.25, 'DIST2001');

  // 5. Merchant B — Payswiff (Created by Distributor)
  insertUser.run('MID3002', 'Lakshmi Mobile Point', '9123456789', 'MERCHANT', 'DIST2001');
  insertWallet.run('MID3002', 18200.0, 94000.0, 75800.0, 5000.0, 57600.0);
  insertPOS.run('MID3002', 'Payswiff', 'SWIFF-TS-8812', 1.65, 'DIST2001');

  // Seed sample initial transactions for Merchant 1 (Pine Labs)
  insertTxn.run(
    'TXN-PL-101',
    'MID3001',
    '9849012345',
    3500.0,
    'POS_SWIPE',
    'Pine Labs',
    'REF-PL-88910',
    'Manual counter swipe verification',
    'PENDING',
    new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    null
  );

  insertTxn.run(
    'TXN-BBPS-102',
    'MID3001',
    '9988776655',
    1250.0,
    'BBPS_BILL',
    'BBPS',
    'TSSPDCL-4881',
    'Electricity Bill Collection',
    'APPROVED',
    new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  );

  // Seed sample initial transaction for Merchant 2 (Payswiff)
  insertTxn.run(
    'TXN-SW-201',
    'MID3002',
    '9700112233',
    5000.0,
    'POS_SWIPE',
    'Payswiff',
    'REF-SW-44911',
    'Payswiff Smart POS Terminal Swipe',
    'PENDING',
    new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    null
  );

  // Seed initial beneficiaries for merchants
  const insertBeneficiary = db.prepare(`
    INSERT OR IGNORE INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_primary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertBeneficiary.run('BEN-01', 'MID3001', 'State Bank of India', '30891245678', 'SBIN0001234', 'Ravi Kumar', 1);
  insertBeneficiary.run('BEN-02', 'MID3001', 'HDFC Bank', '50100456789', 'HDFC0000456', 'Ravi Kumar', 0);
  insertBeneficiary.run('BEN-03', 'MID3001', 'ICICI Bank', '00234567890', 'ICIC0000234', 'Ravi Kumar', 0);

  insertBeneficiary.run('BEN-04', 'MID3002', 'Canara Bank', '11002233445', 'CNRB0001122', 'Lakshmi Devi', 1);
  insertBeneficiary.run('BEN-05', 'MID3002', 'Axis Bank', '91901002345', 'UTIB0000919', 'Lakshmi Devi', 0);
}

// Automatically init database
initDatabase();
