-- =========================================================================
-- RONAV TECHNOLOGIES — SUPABASE POSTGRESQL ENTERPRISE FINTECH SCHEMA
-- Run this SQL in your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Paste & Click Run
-- =========================================================================

-- 1. Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'SUPER_DISTRIBUTOR', 'DISTRIBUTOR', 'MERCHANT')),
  creator_id TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 3. MERCHANT POS MACHINES TABLE
CREATE TABLE IF NOT EXISTS public.merchant_pos (
  merchant_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'Pine Labs' or 'Payswiff'
  terminal_id TEXT NOT NULL,
  commission_rate NUMERIC NOT NULL DEFAULT 1.25,
  assigned_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 4. VIRTUAL WALLETS TABLE
CREATE TABLE IF NOT EXISTS public.wallets (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  available_balance NUMERIC DEFAULT 0.0,
  total_sales NUMERIC DEFAULT 0.0,
  received_sales NUMERIC DEFAULT 0.0,
  pending_balance NUMERIC DEFAULT 0.0,
  withdrawn_amount NUMERIC DEFAULT 0.0,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 5. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  customer_mobile TEXT,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('POS_SWIPE', 'BBPS_BILL', 'QR_COLLECT', 'ADD_MONEY', 'QR_SCAN')),
  provider TEXT, -- 'Pine Labs', 'Payswiff', 'BBPS', etc.
  ref_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  admin_remark TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  verified_at TIMESTAMPTZ
);

-- 6. WITHDRAWALS TABLE
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  admin_remark TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  verified_at TIMESTAMPTZ
);

-- 7. BENEFICIARIES (BANK ACCOUNTS) TABLE
CREATE TABLE IF NOT EXISTS public.beneficiaries (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc TEXT NOT NULL,
  holder_name TEXT NOT NULL,
  is_primary INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 8. INQUIRIES & APPLICATIONS TABLE (LOANS & FRANCHISES)
CREATE TABLE IF NOT EXISTS public.inquiries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('LOAN', 'FRANCHISE', 'TERMINAL_SUPPORT', 'GENERAL')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  merchant_id TEXT,
  amount TEXT,
  category TEXT,
  location TEXT,
  status TEXT DEFAULT 'New',
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- =========================================================================
-- PERFORMANCE INDEXES
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON public.transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_merchant ON public.withdrawals(merchant_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_merchant ON public.beneficiaries(merchant_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_type ON public.inquiries(type);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries(status);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- Allow public read and write with anon key (and service_role bypasses RLS automatically)
DO $$
BEGIN
  -- Users
  DROP POLICY IF EXISTS "Public access users" ON public.users;
  CREATE POLICY "Public access users" ON public.users FOR ALL USING (true) WITH CHECK (true);

  -- Merchant POS
  DROP POLICY IF EXISTS "Public access merchant_pos" ON public.merchant_pos;
  CREATE POLICY "Public access merchant_pos" ON public.merchant_pos FOR ALL USING (true) WITH CHECK (true);

  -- Wallets
  DROP POLICY IF EXISTS "Public access wallets" ON public.wallets;
  CREATE POLICY "Public access wallets" ON public.wallets FOR ALL USING (true) WITH CHECK (true);

  -- Transactions
  DROP POLICY IF EXISTS "Public access transactions" ON public.transactions;
  CREATE POLICY "Public access transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);

  -- Withdrawals
  DROP POLICY IF EXISTS "Public access withdrawals" ON public.withdrawals;
  CREATE POLICY "Public access withdrawals" ON public.withdrawals FOR ALL USING (true) WITH CHECK (true);

  -- Beneficiaries
  DROP POLICY IF EXISTS "Public access beneficiaries" ON public.beneficiaries;
  CREATE POLICY "Public access beneficiaries" ON public.beneficiaries FOR ALL USING (true) WITH CHECK (true);

  -- Inquiries
  DROP POLICY IF EXISTS "Public access inquiries" ON public.inquiries;
  CREATE POLICY "Public access inquiries" ON public.inquiries FOR ALL USING (true) WITH CHECK (true);
END $$;

-- =========================================================================
-- SEED INITIAL CORE DATA
-- =========================================================================

-- Hierarchy Users
INSERT INTO public.users (id, name, mobile, role, creator_id) VALUES
  ('ADM001', 'RONAV Super Admin', '9966203053', 'ADMIN', NULL),
  ('SD1001', 'Telangana Super Distributor', '9848011223', 'SUPER_DISTRIBUTOR', 'ADM001'),
  ('DIST2001', 'Hyderabad Central Distributor', '9848099887', 'DISTRIBUTOR', 'SD1001'),
  ('MID3001', 'Ravi General Store (Koti)', '9876543210', 'MERCHANT', 'DIST2001'),
  ('MID3002', 'Lakshmi Supermarket (Ameerpet)', '9123456789', 'MERCHANT', 'DIST2001'),
  ('MID3003', 'Sri Sai Kirana & Provisions', '9888776655', 'MERCHANT', 'DIST2001')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  mobile = EXCLUDED.mobile,
  role = EXCLUDED.role,
  creator_id = EXCLUDED.creator_id;

-- Merchant POS Terminals
INSERT INTO public.merchant_pos (merchant_id, provider, terminal_id, commission_rate, assigned_by) VALUES
  ('MID3001', 'Pine Labs', 'PINE-HYD-8821', 1.25, 'DIST2001'),
  ('MID3002', 'Payswiff', 'SWIFF-AMP-4402', 1.65, 'DIST2001'),
  ('MID3003', 'Pine Labs', 'PINE-SEC-1109', 1.25, 'DIST2001')
ON CONFLICT (merchant_id) DO UPDATE SET
  provider = EXCLUDED.provider,
  terminal_id = EXCLUDED.terminal_id,
  commission_rate = EXCLUDED.commission_rate;

-- Wallets
INSERT INTO public.wallets (user_id, available_balance, total_sales, received_sales, pending_balance, withdrawn_amount) VALUES
  ('ADM001', 542000.0, 1850000.0, 1850000.0, 0.0, 0.0),
  ('SD1001', 78400.0, 420000.0, 410000.0, 10000.0, 50000.0),
  ('DIST2001', 34200.0, 185000.0, 180000.0, 5000.0, 25000.0),
  ('MID3001', 38060.75, 199000.0, 195500.0, 3500.0, 135000.0),
  ('MID3002', 24150.50, 142000.0, 138000.0, 4000.0, 85000.0),
  ('MID3003', 12800.00, 89000.0, 85000.0, 4000.0, 40000.0)
ON CONFLICT (user_id) DO UPDATE SET
  available_balance = EXCLUDED.available_balance,
  total_sales = EXCLUDED.total_sales,
  received_sales = EXCLUDED.received_sales,
  pending_balance = EXCLUDED.pending_balance,
  withdrawn_amount = EXCLUDED.withdrawn_amount;

-- Beneficiaries
INSERT INTO public.beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_primary) VALUES
  ('BEN-01', 'MID3001', 'State Bank of India', '30891245678', 'SBIN0001234', 'Ravi Kumar', 1),
  ('BEN-02', 'MID3001', 'HDFC Bank', '50100456789', 'HDFC0000456', 'Ravi Kumar', 0),
  ('BEN-03', 'MID3001', 'ICICI Bank', '00234567890', 'ICIC0000234', 'Ravi Kumar', 0),
  ('BEN-04', 'MID3002', 'Canara Bank', '11002233445', 'CNRB0001122', 'Lakshmi Devi', 1),
  ('BEN-05', 'MID3002', 'Axis Bank', '91901002345', 'UTIB0000919', 'Lakshmi Devi', 0)
ON CONFLICT (id) DO NOTHING;

-- Inquiries
INSERT INTO public.inquiries (id, type, name, phone, merchant_id, amount, category, location, status, remarks) VALUES
  ('LN-9801', 'LOAN', 'Ramesh Kumar', '9876543210', 'MID3001', '₹2,50,000', 'Personal Loan', 'Hyderabad', 'New', 'KYC check passed. Zero payslip.'),
  ('LN-9802', 'LOAN', 'Suresh Babu', '9123456780', NULL, '₹10,00,000', 'Business Loan', 'Secunderabad', 'Under Review', 'Awaiting GST returns submission.'),
  ('FR-4501', 'FRANCHISE', 'Rajesh Goud', '9000123456', NULL, '₹5,00,000', 'ATM & CDM Franchise', 'Secunderabad, Hyd', 'New', '120 sq ft commercial space available.'),
  ('FR-4502', 'FRANCHISE', 'Kalyan Chakravarthy', '8887776655', NULL, '₹7,50,000', 'WLA CDM Franchise', 'Vijayawada, AP', 'Approved', 'Site passed inspection.')
ON CONFLICT (id) DO NOTHING;
