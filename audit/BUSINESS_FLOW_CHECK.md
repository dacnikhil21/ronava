# RONAV TECHNOLOGIES — BUSINESS FLOW & ARCHITECTURAL VERIFICATION AUDIT
**Execution Date:** 2026-10-16  
**Git Branch:** `fix/phase-d1-backend` (Read-Only Audit, Zero Code Changes)  
**Database:** Local PostgreSQL (`ronav_test_db`)  

---

## 1. EXECUTIVE COMPLIANCE MATRIX

| Confirmed Business Rule | Status | Primary File & Line Proof | Architectural Assessment |
| :--- | :--- | :--- | :--- |
| **A. Rates per Channel + Mode & Hierarchy Check** | **PARTIAL** | [`server/rate_engine.js:35-127`](file:///c:/Users/dache/Desktop/ronava/server/rate_engine.js#L35-L127)<br>[`server/test_db_helper.js:95-104`](file:///c:/Users/dache/Desktop/ronava/server/test_db_helper.js#L95-L104) | Rates are stored and queried only by `channel`. Settlement mode (`T1` vs `INSTANT`) is missing from `user_channel_rates`. Hierarchy validation exists in code but is not invoked during user creation. |
| **B. Isolated Per-Channel Wallets & Operations** | **PARTIAL** | [`server/api.js:94-126`](file:///c:/Users/dache/Desktop/ronava/server/api.js#L94-L126)<br>[`server/withdrawal_engine.js:110-132`](file:///c:/Users/dache/Desktop/ronava/server/withdrawal_engine.js#L110-L132) | Swipes, commissions, and balances are ledger-tagged by channel. However, `wallets` table is keyed only by `user_id`, and withdrawal reserve checks apply globally across all channels. |
| **C. Swipe Mode Selector & Mode Commission** | **PARTIAL** | [`src/services/api.js:1226`](file:///c:/Users/dache/Desktop/ronava/src/services/api.js#L1226)<br>[`server/transaction_engine.js:10-85`](file:///c:/Users/dache/Desktop/ronava/server/transaction_engine.js#L10-L85) | Frontend sends `settlement_type`, but backend `/api/transactions/record` and `processSwipeTransaction()` completely ignore it. Mode is not stored on swipes or used in commission splits. |
| **D. Withdrawal Lifecycle (Request -> Pending -> Bank -> UTR / Reject)** | **PARTIAL** | [`server/withdrawal_engine.js:170`](file:///c:/Users/dache/Desktop/ronava/server/withdrawal_engine.js#L170)<br>[`server/api.js:1801-1831`](file:///c:/Users/dache/Desktop/ronava/server/api.js#L1801-L1831)<br>[`server/api.js:1701-1758`](file:///c:/Users/dache/Desktop/ronava/server/api.js#L1701-L1758) | Request creation, Excel export, and atomic rejection reversals work properly. However, "Submitted to Bank" updates a text remark rather than the SQL `status` column, and UTR is optional. |
| **E. Swipe Mode vs Withdrawal Mode Visibility & Mismatch Flag** | **MISSING** | [`src/utils/bankExportUtils.js:15-125`](file:///c:/Users/dache/Desktop/ronava/src/utils/bankExportUtils.js#L15-L125)<br>[`src/components/AdminDashboardPage.jsx:5900-6400`](file:///c:/Users/dache/Desktop/ronava/src/components/AdminDashboardPage.jsx#L5900-L6400) | System records withdrawal mode, but does not display originating swipe mode alongside it, and provides no mismatch indicator in the UI or Excel export. |
| **F. Admin Absorbs Remainder & Bank Cost OFF** | **IMPLEMENTED** | [`server/transaction_engine.js:149-163`](file:///c:/Users/dache/Desktop/ronava/server/transaction_engine.js#L149-L163)<br>[`server/settings.js:14`](file:///c:/Users/dache/Desktop/ronava/server/settings.js#L14) | Admin receives the entire fee remainder after downline commission cuts plus all rounding remainders down to the paisa. Bank cost defaults to 0 (OFF). Invariant verified. |

---

## 2. DETAILED FINDINGS FOR SPECIFIC AUDIT QUESTIONS

### 1. Rate Engine & Commission Calculation by Channel + Mode
- **Status:** **NO / MISSING**
- **Rate Engine:** In [`server/rate_engine.js:35-127`](file:///c:/Users/dache/Desktop/ronava/server/rate_engine.js#L35-L127), `setUserRate()` and `getActiveRate()` only accept and query `channel`. The underlying table `user_channel_rates` ([`server/test_db_helper.js:95-103`](file:///c:/Users/dache/Desktop/ronava/server/test_db_helper.js#L95-L103)) contains columns `(id, user_id, channel, rate_bps, effective_from, effective_to)`. It does NOT have a column for settlement mode (`T1` vs `INSTANT`).
- **Swipe Mode Storage:** In [`server/api.js:1366-1375`](file:///c:/Users/dache/Desktop/ronava/server/api.js#L1366-L1375), `body.settlement_type` is ignored and not forwarded. In [`server/transaction_engine.js:180-196`](file:///c:/Users/dache/Desktop/ronava/server/transaction_engine.js#L180-L196), `INSERT INTO transactions` does not store settlement mode.
- **Commission Calculation:** In [`server/transaction_engine.js:79`](file:///c:/Users/dache/Desktop/ronava/server/transaction_engine.js#L79), rates are loaded via `getActiveRate(client, { userId: u.id, channel: cleanChannel })`. Mode is not used when calculating commissions.

### 2. Child >= Parent Hierarchy Check on Server
- **Status:** **PARTIAL**
- **Swipe-Time Check:** In [`server/transaction_engine.js:95-103`](file:///c:/Users/dache/Desktop/ronava/server/transaction_engine.js#L95-L103), the server traverses from merchant up to Admin and asserts `child.rate_bps >= parent.rate_bps` for the transaction's channel. If violated, it throws `INVALID_RATE_HIERARCHY`.
- **Mode Distinction:** Because mode is missing from `user_channel_rates`, this hierarchy check is done per channel, NOT per `channel + mode`.
- **Onboarding / Configuration Check:** The standalone validator `validateHierarchyRates()` ([`server/rate_engine.js:6-29`](file:///c:/Users/dache/Desktop/ronava/server/rate_engine.js#L6-L29)) is only called in test files; it is NOT invoked inside user onboarding (`/api/users/create` at [`server/api.js:724`](file:///c:/Users/dache/Desktop/ronava/server/api.js#L724)) or profile update (`/api/users/update-profile` at [`server/api.js:354`](file:///c:/Users/dache/Desktop/ronava/server/api.js#L354)).

### 3. Mode on Withdrawal, Admin Verification Screen & Excel Export Mismatch Flag
- **Status:** **PARTIAL / MISSING**
- **Stored on Withdrawal:** **YES**. In [`server/withdrawal_engine.js:167-180`](file:///c:/Users/dache/Desktop/ronava/server/withdrawal_engine.js#L167-L180), `quote.settlement_type` (`'T1'` or `'INSTANT'`) is persisted into `withdrawals.settlement_type`.
- **Admin Screen & Excel Export:** **MISSING**. In [`src/utils/bankExportUtils.js:15-125`](file:///c:/Users/dache/Desktop/ronava/src/utils/bankExportUtils.js#L15-L125), Excel exports `Settlement Speed` (the withdrawal mode), but has no column for `Swipe Mode`. In [`src/components/AdminDashboardPage.jsx:5900-6400`](file:///c:/Users/dache/Desktop/ronava/src/components/AdminDashboardPage.jsx#L5900-L6400), payouts display only withdrawal speed without cross-referencing swipe history or rendering a mismatch warning flag.

### 4. Withdrawal Statuses, "Submitted to Bank" State & Duplicate Actions
- **Status:** **PARTIAL / HACK**
- **Database Status Constraints:** [`server/test_db_helper.js:198`](file:///c:/Users/dache/Desktop/ronava/server/test_db_helper.js#L198) defines `CHECK (status IN ('PENDING', 'SUBMITTED_TO_BANK', 'APPROVED', 'REJECTED'))`.
- **"Submitted to Bank" Flow:** In [`server/api.js:1801-1831`](file:///c:/Users/dache/Desktop/ronava/server/api.js#L1801-L1831) (`POST /api/admin/withdrawals/batch-status`), the endpoint does NOT update the SQL column `status = 'SUBMITTED_TO_BANK'`. Instead, it leaves `status` as `'PENDING'`, prepends `[SUBMITTED_TO_BANK]` to `admin_remark`, and sets `submitted_to_bank_at`.
- **Duplicate Downloads & Submissions:**
  - **Excel Download:** Purely client-side in `bankExportUtils.js`; can be downloaded unlimited times with no server-side lock.
  - **Submit to Bank:** Has no guard against re-submission. Invoking `batch-status` on an already-submitted record simply overwrites the remark and timestamp without error.

### 5. UTR Requirement & Duplicate UTR Rejection
- **Status:** **NO / MISSING**
- **UTR Requirement:** In [`server/api.js:1701-1707`](file:///c:/Users/dache/Desktop/ronava/server/api.js#L1701-L1707), `utr` is optional. If missing, it defaults to:
  `remark || existingRemark || 'Bank payout cleared via IMPS/NEFT'`
- **Duplicate UTR Rejection:** There is no uniqueness check or SQL unique index on UTR in `withdrawals`. Submitting the same UTR on multiple payouts is currently accepted without error.

### 6. Reject & Complete Ledger Transactions & Terminal State Locks
- **Status:** **YES / IMPLEMENTED**
- **Atomic Ledger Posting:** In [`server/api.js:1688-1762`](file:///c:/Users/dache/Desktop/ronava/server/api.js#L1688-L1762), both `APPROVE` and `REJECT` execute within an atomic PostgreSQL transaction (`await withTransaction(async (client) => { ... })`).
  - Approval posts `withdrawal_paid`, increments `wallets.withdrawn_paise`, and marks withdrawal `APPROVED`.
  - Rejection posts `withdrawal_reversal` (+held amount restored) and marks withdrawal `REJECTED`.
- **State Machine Protection:** In [`server/api.js:1695-1697`](file:///c:/Users/dache/Desktop/ronava/server/api.js#L1695-L1697):
  ```javascript
  if (wth.status !== 'PENDING') {
    throw new Error(`Withdrawal is already ${wth.status}.`);
  }
  ```
  Once marked `APPROVED` or `REJECTED`, the payout cannot be modified or transitioned again.

### 7. Admin Remainder Share & Bank Cost Setting
- **Status:** **YES / IMPLEMENTED**
- **Calculation:** In [`server/transaction_engine.js:149-163`](file:///c:/Users/dache/Desktop/ronava/server/transaction_engine.js#L149-L163):
  `adminRemainderPaise = merchantFeePaise - distributedPaiseSum - bankCostPaise;`
- **Bank Cost Setting:** In [`server/settings.js:14`](file:///c:/Users/dache/Desktop/ronava/server/settings.js#L14) and [`server/test_db_helper.js:85`](file:///c:/Users/dache/Desktop/ronava/server/test_db_helper.js#L85), `bank_cost_enabled` defaults to `0` (OFF). Thus `bankCostPaise = 0n`.
- **Remainder Absorption:** All uplines receive integer cuts rounded down to the paisa (`Math.floor`). Admin receives the entire fee remainder plus all rounding fractions. Verified by invariant assertion at line 166.

### 8. Cross-Channel Deductions & Rental Debts
- **Status:** **NO / IMPLEMENTED (Zero Cross-Channel Deductions)**
- **Channel Isolation:** In [`server/api.js:94-126`](file:///c:/Users/dache/Desktop/ronava/server/api.js#L94-L126) (`calculateUserChannelBalances`), channel balances are derived strictly by grouping `financial_ledger` rows by `channel`.
- **Rental Debts:** No rental debts or negative balances from Payswiff are deducted from Pine Labs or QR balances.
- **Architectural Caveat:** In [`server/test_db_helper.js:55`](file:///c:/Users/dache/Desktop/ronava/server/test_db_helper.js#L55) and [`server/withdrawal_engine.js:110-132`](file:///c:/Users/dache/Desktop/ronava/server/withdrawal_engine.js#L110-L132), `wallets` table is keyed by `user_id` alone. While credits/debits don't cross channels, withdrawal reserve rules (Rs 500) and available balance locks currently evaluate the global wallet container.

---

## 3. IDENTIFIED ARCHITECTURAL GAPS & PROPOSED FIXES

1. **Gap 1: Missing Mode in `user_channel_rates`**
   - *Fix:* Add `settlement_mode VARCHAR(20) NOT NULL DEFAULT 'T1'` to `user_channel_rates`. Update `setUserRate` and `getActiveRate` in `server/rate_engine.js` to accept and query `(channel, settlement_mode)`.
2. **Gap 2: Swipe Mode Not Forwarded or Persisted**
   - *Fix:* In `server/api.js:1366`, pass `body.settlement_type || 'T1'` into `processSwipeTransaction()`. Add `settlement_mode` column to `transactions` table, and resolve commission rates using that mode.
3. **Gap 3: Missing Swipe Mode Correlation on Withdrawals**
   - *Fix:* In `server/withdrawal_engine.js`, record the channel's dominant swipe mode on the withdrawal. In `bankExportUtils.js` and `AdminDashboardPage.jsx`, add columns for `Swipe Mode`, `Withdrawal Mode`, and `Mode Mismatch Flag`.
4. **Gap 4: `SUBMITTED_TO_BANK` Uses Text Remarks Instead of SQL Status**
   - *Fix:* In `server/api.js:1825`, update SQL status directly: `UPDATE withdrawals SET status = 'SUBMITTED_TO_BANK' WHERE id = $1 AND status = 'PENDING'`. Prevent duplicate batch submission. Allow `/api/admin/verify-withdrawal` to approve or reject from `SUBMITTED_TO_BANK`.
5. **Gap 5: UTR Not Enforced & Duplicate UTR Not Rejected**
   - *Fix:* In `server/api.js:1701`, enforce `if (!cleanUtr) throw new Error('UTR is mandatory to complete a payout');`. Add `CREATE UNIQUE INDEX uq_withdrawal_utr ON withdrawals (utr) WHERE status = 'APPROVED';`.
6. **Gap 6: User-Level Wallet Table Instead of Per-Channel Wallets**
   - *Fix:* Update `wallets` primary key to `(user_id, channel)`. In `withdrawal_engine.js`, lock and validate available balance specifically for the requested `channel`.

---
**Audit Status:** COMPLETE & VERIFIED (READ-ONLY)
