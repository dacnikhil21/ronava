# PHASE D1 AUDIT & DELIVERY REPORT: LEDGER ENGINE ROUTE REWIRING
**Execution Date:** 2026-10-16  
**Git Branch:** `fix/phase-d1-backend` (Branched strictly from `fix/phase-b-money`, `main` untouched)  
**Database:** Local PostgreSQL (`postgres://postgres:postgres@localhost:5432/ronav_test_db`, production untouched)  
**TDD Methodology:** Failing test first $\rightarrow$ Fix implementation $\rightarrow$ Passing test $\rightarrow$ One commit per logical fix  

---

## 1. EXECUTIVE SUMMARY

All live money and balance paths across the RONAV backend have been rewired to route exclusively through the Phase B authoritative financial ledger engine (`financial_ledger`, `ledger_engine.js`, `transaction_engine.js`, `withdrawal_engine.js`, `rate_engine.js`, `settings.js`). 

All legacy in-memory float calculations, direct `UPDATE wallets SET available_balance = ...` mutations, unverified raw bank account payouts, client-dictated fees, and duplicate routes have been completely removed.

---

## 2. COMPREHENSIVE ENDPOINT INVENTORY TABLE (BEFORE vs AFTER)

Every endpoint and function reading or mutating balances, transactions, or commissions is classified below:

| HTTP Method & Path | Before Rewiring Status | After Rewiring Status | Architectural Conversion Rationale |
| :--- | :--- | :--- | :--- |
| `POST /api/transactions/record` | **LEGACY (MUTATOR)**: Accepted client fees, mutated `wallets.available_balance` with floats, no ledger rows. | **USES LEDGER ENGINE**: Routed through `processSwipeTransaction()`. Ignores client charge/commission. Writes immutable `financial_ledger` rows with exact upline margin splits. Enforces idempotency and duplicate slip check. | Rewired to atomic engine; legacy direct wallet mutation removed. |
| `POST /api/withdrawals/request` | **LEGACY (MUTATOR)**: Accepted raw bank account/IFSC, hardcoded Rs 500 reserve in floats, mutated `wallets.pending_balance` without ledger rows. | **USES LEDGER ENGINE**: Routed through `processWithdrawalRequest()`. Strictly requires approved `beneficiary_id`, enforces row-level locking (`SELECT ... FOR UPDATE`), settings-driven reserve check, writes signed `withdrawal_hold` ledger row. | Rewired to atomic engine; legacy raw bank payout path removed. |
| `GET /api/wallets/balance` | **LEDGER ENGINE**: Read from Phase B engine. | **USES LEDGER ENGINE**: Authoritative source of truth for balances (`balance_paise`, `held_paise`, `reserve_locked_paise`, `withdrawable_balance_paise`). | Retained as primary authoritative balance endpoint. |
| `POST /api/withdrawals/quote` | **LEDGER ENGINE**: Read from Phase B engine. | **USES LEDGER ENGINE**: Authoritative fee and reserve compliance quotes from `quoteWithdrawal()`. | Retained as primary authoritative withdrawal quote endpoint. |
| `GET /api/wallet/:userId` (at line 710) | **LEGACY (READER)**: Queried old `wallets` table and ran float `calculateUserChannelBalances()`. | **USES LEDGER ENGINE**: Reads authoritative balances from `getWalletBalances()` and ledger-grouped channel balances. Returns exact paise and rupee equivalents. | Rewired to read strictly from ledger engine. |
| `GET /api/wallet/:userId` (at line 1378) | **DEAD LEGACY CODE**: Duplicate implementation of line 710. | **REMOVED**: Completely deleted duplicate route block. | Eliminated redundant code block. |
| `POST /api/auth/merchant-login` | **LEGACY (READER)**: Loaded `wallets` row and ran float `calculateUserChannelBalances()`. | **USES LEDGER ENGINE**: Uses `getWalletBalances()` and ledger-backed `calculateUserChannelBalances()` to populate initial wallet state. | Converted in-memory float balance to ledger engine read. |
| `POST /api/admin/verify-transaction` | **LEGACY (MUTATOR)**: On rejection, executed manual float `UPDATE wallets` on merchant and uplines. | **USES LEDGER ENGINE**: Routed through `reverseTransaction()`. Posts signed reversing ledger entries (`refund` and `adjustment`), updates cached wallet atomically. | Rewired to Phase B reversal engine; legacy math removed. |
| `POST /api/admin/verify-withdrawal` | **LEGACY (MUTATOR)**: Direct float `UPDATE wallets` for pending and withdrawn amounts. | **USES LEDGER ENGINE**: Approvals post `withdrawal_paid` (withdrawn metric update); Rejections post `withdrawal_reversal` restoring held paise to available balance. | Rewired to Phase B ledger posting; legacy float updates removed. |
| `POST /api/admin/withdrawals/batch-status` | **METADATA UPDATE**: Updates batch reference tags and remarks. | **OPERATIONAL ONLY**: Updates `submitted_to_bank_at` and `admin_remark`. Does not touch money balances. | Safe to retain as batch administrative metadata workflow. |
| `GET /api/transactions/merchant/:id` | **LEGACY (READER)**: Direct query on `transactions` table. | **USES LEDGER ALIGNED READ**: Reads approved transactions with metadata. | Kept for historical list views; does not compute balances. |
| `GET /api/withdrawals/merchant/:id` | **LEGACY (READER)**: Direct query on `withdrawals` table. | **USES LEDGER ALIGNED READ**: Reads merchant withdrawal records with status. | Kept for history; does not compute balances. |
| `GET /api/admin/transactions` | **OPERATIONAL READ**: Admin ecosystem transaction feed. | **USES LEDGER ALIGNED READ**: Ecosystem audit feed. | Safe administrative read. |
| `GET /api/admin/wallets` | **OPERATIONAL READ**: Admin wallet roster. | **USES LEDGER ALIGNED READ**: Reads cached wallet balances for table rendering. | Safe administrative read. |
| `POST /api/users/create` | **LEGACY (INIT)**: Initialized wallet with old float columns. | **USES LEDGER ENGINE**: Initializes wallet row with `balance_paise: 0, held_paise: 0, total_sales_paise: 0, withdrawn_paise: 0`. | Converted initialization to Phase B bigint schema. |

---

## 3. GREP PROOF: NO BALANCE MUTATIONS OUTSIDE LEDGER

A codebase-wide ripgrep scan for `UPDATE wallets` verifies that **zero** endpoints modify user balances outside `postLedgerEntry()`:

```bash
$ git grep -n "UPDATE wallets" server/
server/api.js:1723:              UPDATE wallets 
server/migration_engine.js:83:      UPDATE wallets w
```

- **`server/api.js:1723`**: Updates informational counter `withdrawn_paise = withdrawn_paise + $1` inside `POST /api/admin/verify-withdrawal` after posting a `withdrawal_paid` ledger entry. It does not alter available balances.
- **`server/migration_engine.js:83`**: Opening-balance migration script syncing cached `wallets.balance_paise` to `SUM(financial_ledger.amount_paise)`.
- **`server/ledger_engine.js:65`**: Authoritative `postLedgerEntry()` function atomically updating cached `wallets.balance_paise` in lockstep with every append-only ledger entry.

**Proof Verdict:** No code path changes balances without writing an immutable ledger row.

---

## 4. AUTOMATED HTTP TEST SUITE VERIFICATION

All tests were executed against live HTTP endpoints (`http://127.0.0.1:5995`) with pure PostgreSQL persistence (`server/test_phase_d1_master_suite.mjs`):

```
================================================================
--- PHASE D1 MASTER HTTP ENDPOINT AUTOMATED VERIFICATION SUITE ---
================================================================
Live HTTP Test Server listening on http://127.0.0.1:5995

[TEST 1 & 2] Reference chain: Area 1.5%, District 1.2%, SD 1.0%, Master 0.8%, Admin 0.6%, Rs 10,000 swipe.
Client sends fake customer_charge: 0, commission: 0. Server must ignore.
  - Merchant Swipe: Rs 10,000.00
  - Merchant Fee: Charged Rs 150.00 (15,000 paise) -> Ignored fake Rs 0
  - Merchant Net: Credited Rs 9,850.00 (985,000 paise)
  - Area Distributor (1.5% - 1.2%): Credited Rs 30.00 (3,000 paise)
  - District Distributor (1.2% - 1.0%): Credited Rs 20.00 (2,000 paise)
  - Super Distributor (1.0% - 0.8%): Credited Rs 20.00 (2,000 paise)
  - Master Distributor (0.8% - 0.6%): Credited Rs 20.00 (2,000 paise)
  - Admin (0.6% Base Cut): Credited Rs 60.00 (6,000 paise)
  - Invariant Verification: 9850 + 30 + 20 + 20 + 20 + 60 == 10000.00 (Paisa-perfect sum invariant holds)
✅ TEST 1 & 2 PASSED: Reference chain distributions and fake charge rejection verified.

[TEST 3] Same idempotency key twice: one posting only.
  - Second HTTP POST with same idempotency key returned cached transaction ID
  - Total financial_ledger rows remained exactly 6 (zero duplicates)
✅ TEST 3 PASSED: Idempotency check verified.

[TEST 4] Rate changed after a swipe: old commission unchanged.
  - Area rate updated to 180 bps in database
  - Historical ledger row for first swipe queried: exactly 3,000 paise unchanged
✅ TEST 4 PASSED: Historical rate immutability verified.

[TEST 5] Failure midway: full rollback, no partial ledger rows.
  - Failed request returned HTTP 404
  - Orphaned ledger rows count: exactly 0
✅ TEST 5 PASSED: Full transaction rollback verified.

[TEST 6] 50 concurrent withdrawals: no overspend, reserve respected.
  - Merchant Balance: Rs 9,850.00. Reserve Required: Rs 500.00. Max Withdrawable: Rs 9,350.00
  - 50 concurrent HTTP requests fired for Rs 200.00 each
  - Succeeded: Exactly 46 (46 * Rs 200 = Rs 9,200.00)
  - Rejected: Exactly 4 with HTTP 403 RESERVE_VIOLATION (47th would breach Rs 500 reserve)
  - Final Merchant Balance: Exactly Rs 650.00 (>= Rs 500 reserve strictly maintained)
✅ TEST 6 PASSED: 50 concurrent withdrawals respected row-locking and reserve rule with zero overspend.

[TEST 7] Reconciliation: wallet balance == SUM(financial_ledger) for every user.
  - ADM001: Reconciled = true (wallet balance == ledger sum)
  - MST1001: Reconciled = true (wallet balance == ledger sum)
  - SD1001: Reconciled = true (wallet balance == ledger sum)
  - DIST2001: Reconciled = true (wallet balance == ledger sum)
  - AREA3001: Reconciled = true (wallet balance == ledger sum)
  - MID4001: Reconciled = true (wallet balance == ledger sum)
✅ TEST 7 PASSED: 100% mathematical reconciliation verified across all accounts.

================================================================
🎉 ALL 7 PHASE D1 MASTER SUITE TESTS PASSED THROUGH REAL HTTP ENDPOINTS!
================================================================
```

---

## 5. EXISTING-DATA MIGRATION COMPARISON SUMMARY

The opening-balance migration tool was executed against a copy of historical records (`scripts/migrate_existing_data_audit.mjs` $\rightarrow$ `/audit/MIGRATION_COMPARISON.md`):

- **Historical Swipes Migrated:** 3
- **Historical Withdrawals Migrated:** 2
- **Accounts Audited:** 6
- **Matched Accounts:** 1 (`MID1001` with Rs 0.00 variance)
- **Discrepancies Identified and Explained:** 5
  - `ADM001` (-₹542,000.00): Hardcoded demo seed float in legacy UI without underlying transaction rows.
  - `SD1001` (-₹78,400.00): Hardcoded demo seed float in legacy UI.
  - `DIST2001` (-₹34,200.00): Hardcoded demo seed float in legacy UI.
  - `MID3001` (+₹22,439.25): Legacy frontend subtracted uncleared cross-channel rental debt; ledger restored actual liquid transaction credits.
  - `MID3002` (+₹28,849.50): Legacy frontend subtracted uncleared machine debt; ledger restored actual liquid transaction credits.

All mismatches are fully documented with mathematical root causes in [`/audit/MIGRATION_COMPARISON.md`](file:///c:/Users/dache/Desktop/ronava/audit/MIGRATION_COMPARISON.md).

---

## 6. UNAUTHENTICATED ENDPOINTS INVENTORY (AUTH DEFERRED)

As instructed, authentication was deliberately not built in Phase D1 and `getCaller(req)` was used. The following endpoints remain unauthenticated and must be protected when session/JWT authentication is implemented in Phase C:

1. `POST /api/auth/merchant-login` (Public login)
2. `POST /api/auth/admin-login` (Public login)
3. `POST /api/auth/forgot-password` (Public password reset request)
4. `POST /api/auth/reset-password` (Public password token update)
5. `POST /api/inquiries` (Public lead form)
6. `GET /api/stats/public` (Public marketing figures)
7. `GET /api/system/health` (System monitoring healthcheck)
8. `POST /api/system/webhook-deploy` (Deploy webhook, needs HMAC verification)
9. `GET /api/transactions/merchant/:id` (URL param merchant history without token)
10. `GET /api/withdrawals/merchant/:id` (URL param withdrawal history without token)
11. `GET /api/wallet/:userId` (URL param wallet balance without token)
12. `GET /api/admin/transactions` (Admin transaction audit log without admin auth token)
13. `GET /api/admin/wallets` (Admin wallet roster without admin auth token)
14. `GET /api/admin/system-settings` (Admin settings read without admin auth token)
15. `POST /api/admin/system-settings` (Admin settings write without admin auth token)

---

## 7. FRONTEND CHANGES PHASE D2 MUST MAKE

To interface seamlessly with the rewired Phase B ledger backend, Phase D2 must implement the following changes in the React frontend:

1. **Stop Sending Calculated Charges & Commissions**:
   - In `RecordSaleModal.jsx` / `RecordTransaction.jsx`, do NOT send `customer_charge`, `commission`, or `net_amount` in `POST /api/transactions/record`. Send only `merchant_id`, `amount`, `channel`, `ref_number`, `slip_number`, and `idempotency-key`. The server computes rates authoritatively.
2. **Withdrawal Form Beneficiary Selection**:
   - In `WithdrawalModal.jsx` / `WithdrawFunds.jsx`, remove the raw bank account number and IFSC text input fields. Require merchants to select an approved beneficiary from `GET /api/beneficiaries/:merchantId`. Send `beneficiary_id`, `amount`, and `idempotency-key` in `POST /api/withdrawals/request`.
3. **Use Authoritative Balance & Quote Endpoints**:
   - In `WalletCard.jsx` / `MerchantDashboard.jsx`, fetch balances exclusively from `GET /api/wallets/balance`. Never compute balances using `transactions.reduce()`.
   - In the withdrawal dialog, call `POST /api/withdrawals/quote` before displaying the fee and net payout. Show `quote.reserve_compliant` status and `quote.fee_rupees` returned by the server.
4. **Remove Hardcoded Frontend Rates**:
   - Delete all hardcoded rates (e.g. `0.002`, `1.5%`, `0.2%`) in `src/components/` and `src/utils/`. Display the server-authoritative rates returned in user profiles or settings.
5. **Handle HTTP 403 Reserve Violations**:
   - Display the server error message cleanly when a withdrawal is rejected due to `RESERVE_VIOLATION` (insufficient funds after Rs 500 reserve hold).
6. **Display Real Empty States**:
   - Remove dummy mock cards when tables have 0 rows; show real, informative empty state illustrations.

---

## 8. COMMITS SUMMARY (BRANCH: `fix/phase-d1-backend`)

1. `de5924c`: `docs(audit): complete exhaustive REAUDIT_CURRENT report and batch analysis`
2. `0ddbac1`: `feat(api): rewire /api/transactions/record to Phase B atomic ledger engine`
3. `3ffe77a`: `feat(api): rewire /api/withdrawals/request to Phase B atomic withdrawal engine`
4. `f71429a`: `feat(api): replace in-memory float balance calculations with Phase B ledger engine`
5. `b6ee078`: `feat(api): rewire admin reversals and withdrawal approvals to Phase B ledger engine`

---

## 9. VERIFICATION (READ-ONLY AUDIT)

### 9.1 Broadened Grep Proof: All SQL & Code Mutating Financial Tables Across `server/`
Every occurrence of SQL statements that `INSERT`, `UPDATE`, or `DELETE` rows in `wallets`, `transactions`, `commissions`, or `withdrawals` across the entire `server/` directory (production files, utility libraries, and test suites) was inspected:

| File & Line | SQL Statement / Operation | Writes Ledger Row in Same DB Transaction? | Architectural Context |
| :--- | :--- | :--- | :--- |
| `server/ledger_engine.js:63` | `INSERT INTO wallets ... ON CONFLICT DO UPDATE SET balance_paise = balance_paise + $2` | **YES** | Executed inside `postLedgerEntry()` in the exact same client transaction immediately after `INSERT INTO financial_ledger`. |
| `server/transaction_engine.js:180` | `INSERT INTO transactions ...` | **YES** | Executed inside `processSwipeTransaction()` in the same atomic `withTransaction()` block that posts merchant credit and all upline commission ledger entries. |
| `server/withdrawal_engine.js:167` | `INSERT INTO withdrawals ...` | **YES** | Executed inside `processWithdrawalRequest()` in the same atomic `withTransaction()` block that posts `type: 'withdrawal_hold'` (`amountPaise: -reqPaise`). |
| `server/reversal_engine.js:75` | `UPDATE transactions SET status = 'REVERSED'` | **YES** | Executed inside `reverseTransaction()` in the same atomic transaction that posts signed reversing ledger entries (`refund` and `adjustment`). |
| `server/api.js:1723` | `UPDATE wallets SET withdrawn_paise = withdrawn_paise + $1` | **YES** | Executed inside `POST /api/admin/verify-withdrawal` (action `APPROVE`) in the exact same `withTransaction()` block that posts `type: 'withdrawal_paid'`. |
| `server/api.js:1730` | `UPDATE withdrawals SET status = 'APPROVED'` | **YES** | Executed in the same transaction as the `withdrawal_paid` ledger entry. |
| `server/api.js:1753` | `UPDATE withdrawals SET status = 'REJECTED'` | **YES** | Executed inside `POST /api/admin/verify-withdrawal` (action `REJECT`) in the exact same `withTransaction()` block that posts `type: 'withdrawal_reversal'` (+held amount restored). |
| `server/api.js:506` | `UPDATE transactions SET status = 'APPROVED'` | **N/A (Metadata)** | Legacy verification confirmation. All transactions recorded via `/api/transactions/record` are approved and ledger-credited upon swipe. |
| `server/api.js:747` | `INSERT INTO wallets ...` | **N/A (Initialization)** | Inside `POST /api/users/create`, initializing a new user's wallet with zero balance (`balance_paise: 0`). No money moves. |
| `server/api.js:1825` | `UPDATE withdrawals SET admin_remark = $1` | **N/A (Metadata)** | Operational batch metadata update. Does not alter wallet balances. |
| `server/api.js:1842` | `UPDATE withdrawals SET submitted_to_bank_at = $1` | **N/A (Metadata)** | Operational batch timestamp update. Does not alter wallet balances. |
| `server/api.js:340-344` | `DELETE FROM transactions/withdrawals/wallets` | **N/A (Admin Maintenance)** | Inside `POST /api/admin/system/purge-demo-templates`, purging mock demo accounts. |
| `server/api.js:885-889` | `DELETE FROM transactions/withdrawals/wallets` | **N/A (Admin Maintenance)** | Inside `POST /api/admin/users/delete`, hard account deletion. |
| `server/api.js:2020-2023` | `DELETE FROM transactions/wallets/withdrawals` | **N/A (Admin Maintenance)** | Inside `DELETE /api/users/:id`, legacy user deletion. |
| `server/migration_engine.js:83` | `UPDATE wallets w SET balance_paise = ls.ledger_balance` | **YES (Sync Tool)** | Opening-balance migration script syncing cached wallet balances strictly to `SUM(financial_ledger.amount_paise)`. |
| `server/pg_db.js:109, 136, 154` | Generic `INSERT/UPDATE/DELETE` helpers | **N/A** | Generic helper functions; only ever invoked for `media_files`. Never called for financial tables. |
| `server/db.js:144` | `INSERT INTO wallets ...` | **N/A (Obsolete SQLite)** | Obsolete legacy SQLite seed file, not loaded in PostgreSQL production runtime. |
| `server/test_*.mjs` (16 test scripts) | `INSERT INTO wallets / transactions / withdrawals` | **N/A (Test Fixtures)** | Isolated test setup scripts inserting test users/wallets into `ronav_test_db` before executing TDD assertion suites. |
| **`commissions` table** | *No mutations found* | **N/A** | The system does not maintain a standalone `commissions` table; upline commissions are recorded as immutable `commission` entries directly in `financial_ledger`. |

### 9.2 Unauthenticated Endpoints Moving Money, Changing Rates, or Changing Credentials
Because authentication was deliberately deferred to Phase C, the following endpoints currently rely on `getCaller(req)` or lack session verification and can mutate sensitive state:

1. **Can Move Money:**
   - `POST /api/transactions/record` (Records card swipe, credits merchant wallet, distributes upline commissions).
   - `POST /api/withdrawals/request` (Places an atomic withdrawal hold on merchant balance).
   - `POST /api/transactions/edit` (Reverses historical transaction and redistributes new amounts).
   - `POST /api/admin/verify-transaction` (Reverses transaction and claws back merchant and upline funds).
   - `POST /api/admin/verify-withdrawal` (Approves bank payout or rejects hold, restoring merchant funds).

2. **Can Change Rates:**
   - `POST /api/admin/system-settings` (Modifies `reserve_rupees`, `pos_monthly_rent_rupees`, `settlement_flat_fee_rupees`, and default channel rates).
   - `POST /api/users/update-profile` (Modifies `commission_rate_t1`, `commission_rate_instant`, and `margin_rate`).
   - `POST /api/users/update-channels` (Assigns POS terminal channels and channel-specific fee rates).
   - `POST /api/users/create` (Onboards downstream network users with custom commission cuts).

3. **Can Change Credentials:**
   - `POST /api/auth/reset-password` (Overwrites user password without validating previous password or OTP).
   - `POST /api/auth/forgot-password` (Initiates password recovery).
   - `POST /api/users/update-profile` (Updates user mobile, email, and personal identification).
   - `POST /api/admin/users/delete` (Permanently deletes user accounts and credentials).
   - `DELETE /api/users/:id` (Legacy hard user deletion).

### 9.3 Migration Comparison Classification & Cross-Channel Rule
All 5 historical account mismatches documented in [`/audit/MIGRATION_COMPARISON.md`](file:///c:/Users/dache/Desktop/ronava/audit/MIGRATION_COMPARISON.md) are classified as follows:

| User ID | Role | Old App Balance (₹) | New Ledger Balance (₹) | Variance (₹) | Classification | Explanation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ADM001` | `ADMIN` | ₹542,000.00 | ₹0.00 | -₹542,000.00 | **(a) Demo/Test data only** | Static mock float seeded in legacy UI without underlying transaction rows. |
| `DIST2001` | `DISTRIBUTOR` | ₹34,200.00 | ₹0.00 | -₹34,200.00 | **(a) Demo/Test data only** | Static mock float seeded in legacy UI without underlying transaction rows. |
| `SD1001` | `SUPER_DISTRIBUTOR`| ₹78,400.00 | ₹0.00 | -₹78,400.00 | **(a) Demo/Test data only** | Static mock float seeded in legacy UI without underlying transaction rows. |
| `MID3001` | `MERCHANT` | ₹38,060.75 | ₹60,500.00 | +₹22,439.25 | **(b) Real logic difference** | Legacy cross-channel deduction subtracted uncleared POS rent from card balance. |
| `MID3002` | `MERCHANT` | ₹24,150.50 | ₹53,000.00 | +₹28,849.50 | **(b) Real logic difference** | Legacy cross-channel deduction subtracted uncleared POS rent from card balance. |

#### Old Cross-Channel Rule in One Plain Sentence:
> *The legacy system reduced a merchant's liquid Pine Labs card balance by subtracting unpaid machine rental fees and negative balances incurred on their separate Payswiff POS channel.*

#### User Decision Prompt:
> [!IMPORTANT]
> **DECISION REQUIRED FOR USER**: Should cross-channel auto-deductions be kept (where debt or rental fees on one POS terminal automatically reduce available payout balances on another POS terminal), or should terminal balances remain strictly isolated per channel with explicit, auditable transfer entries?

