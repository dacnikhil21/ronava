# RONAV TECHNOLOGIES — PRE-PRODUCTION HARDENING AUDIT REPORT
**Target Database**: Local `ronav_test_db` | **Git Branch**: `hardening-pre-production`  
**Execution Date**: October 20, 2026 | **Author**: System Architecture Team

---

## Executive Summary
This report documents the architectural hardening and bug remediation performed prior to handling real money. Zero production or remote environments were contacted. Hand-made accounts, historical rates, and transaction rows in `ronav_test_db` remain completely preserved. Every change followed a strict **test-first, one-commit-per-fix** standard, accompanied by database-level constraints and verified in real browser and HTTP suites.

---

## Summary of the 6 Hardened Fixes

### FIX 1: Swipe Reversal Window & Payout Age Protection
* **Problem**: Swipes had a 5-minute age restriction and ignored existing payouts, allowing merchants to withdraw funds and leave the ecosystem short if a swipe was subsequently rejected. Additionally, `reversal_engine.js` had nested transaction blocks (`BEGIN/COMMIT`) that triggered PostgreSQL warnings.
* **Hardened Fix**:
  * Removed the 5-minute limit completely; reversals can occur anytime within policy.
  * Reversal now queries all withdrawals for that merchant and channel within a locked transaction.
  * If the channel wallet cannot cover the reversal because of **PENDING** withdrawals, the reversal is refused with a plain message listing the exact withdrawal IDs so Admin rejects them first.
  * If funds were already submitted or paid out (`SUBMITTED_TO_BANK` / `COMPLETED`), the shortfall is recorded as **OWED** (blocking further withdrawals until cleared).
  * Added PostgreSQL trigger `trg_wallets_no_silent_negative` on table `wallets` to prevent silent negative balances unless explicitly tagged with `is_shortfall_owed: true`.
  * Removed nested `BEGIN/COMMIT` calls.
* **Verification**: [server/test_fix1_reversal_lifecycle_all_ages.mjs](file:///c:/Users/dache/Desktop/ronava/server/test_fix1_reversal_lifecycle_all_ages.mjs) passes across 10m, 1h, and 2d payout ages across all three states.
* **Commit**: `a43db89`

---

### FIX 2: Elimination of Duplicate Routes
* **Problem**: Multiple legacy endpoints existed for swipes and withdrawals, creating divergent validation logic and potential bypasses.
* **Hardened Fix**: Purged legacy duplicate routes. All screens and clients now route exclusively to the canonical engine endpoints. Deleted routes return `404 NOT FOUND`.

| Operation | Deprecated / Purged Route (Before) | Canonical Engine Route (After) | Status |
| :--- | :--- | :--- | :--- |
| **Record Swipe** | `POST /api/transactions/process-swipe` | `POST /api/transactions/record` | 404 (Purged) |
| **Record Swipe (Alt)** | `POST /api/transactions/record-authoritative` | `POST /api/transactions/record` | 404 (Purged) |
| **Request Payout** | `POST /api/withdrawals/execute` | `POST /api/withdrawals/request` | 404 (Purged) |
| **Request Payout (Alt)**| `POST /api/withdrawals/request-authoritative` | `POST /api/withdrawals/request` | 404 (Purged) |
| **Merchant Transactions**| Duplicate unauth route at line 1937 | `GET /api/transactions/merchant/:id` | Unified & Paginated |
| **Add Beneficiary** | Unauthenticated `POST /api/beneficiaries/add` | `POST /api/beneficiaries` | 404 (Purged) |
| **Delete User** | Duplicate unauthenticated route at line 2087 | `POST /api/admin/users/delete` | Purged |

* **Verification**: [server/test_fix2_duplicate_endpoints_404.mjs](file:///c:/Users/dache/Desktop/ronava/server/test_fix2_duplicate_endpoints_404.mjs) confirms all legacy endpoints return 404.
* **Commit**: `62d255c`

---

### FIX 3: Strict Token Identity & Ownership Enforcement
* **Problem**: Routes fell back to reading `merchant_id` from request bodies or headers, allowing a merchant to spoof other accounts.
* **Hardened Fix**:
  * Caller identity is extracted **exclusively** from the cryptographically verified JWT Bearer token via `requireAuth(req)`.
  * Removed all `body.merchant_id || caller.id` fallbacks.
  * Added `assertCanAccessUser(caller, targetUserId)` checks to all merchant endpoints. Merchants attempting to view or initiate actions on other accounts are rejected with `403 FORBIDDEN`.
  * Unauthenticated requests are rejected with `401 AUTH_TOKEN_MISSING`.
* **Verification**: [server/test_fix3_identity_guards.mjs](file:///c:/Users/dache/Desktop/ronava/server/test_fix3_identity_guards.mjs) passes.
* **Commit**: `3ed33a5`

---

### FIX 4: Single Source of Truth (Financial Ledger vs Wallet Cache)
* **Problem**: `wallets` table balances and `financial_ledger` rows could drift out of sync.
* **Hardened Fix**:
  * `financial_ledger` per channel is established as the absolute single source of truth.
  * `wallets` table functions strictly as an append/lock cache updated within the exact same atomic transaction in `postLedgerEntry`.
  * Added real-time reconciliation checks in `getWalletBalances` and `processWithdrawalRequest`. If `wallets.balance_paise` differs from `SUM(financial_ledger.amount_paise)` by even 1 paisa, execution immediately aborts with `LEDGER_WALLET_DISCREPANCY`.
* **Verification**: [server/test_fix4_one_balance_reconciliation.mjs](file:///c:/Users/dache/Desktop/ronava/server/test_fix4_one_balance_reconciliation.mjs) asserts loud error when drift is simulated.
* **Commit**: `b2e8667`

---

### FIX 5: Standardized List Pagination
* **Problem**: Large database tables were queried in full without pagination, leading to memory bloat and slow loads as transactions scale.
* **Hardened Fix**:
  * Implemented `limit` (default 50, maximum 200 clamped) and `offset` query parameters with total row counts on all list endpoints:
    * `GET /api/users`
    * `GET /api/admin/transactions`
    * `GET /api/admin/withdrawals`
    * `GET /api/transactions/merchant/:merchantId`
    * `GET /api/withdrawals/merchant/:merchantId`
    * `GET /api/wallets`
    * `GET /api/financial-ledger`
    * `GET /api/inquiries`
  * Updated frontend data layer (`supabase.js` compatibility layer) to forward `limit` and `offset` and return total counts.
* **Verification**: [server/test_fix5_pagination.mjs](file:///c:/Users/dache/Desktop/ronava/server/test_fix5_pagination.mjs) and [server/test_pagination_500_copy_db.mjs](file:///c:/Users/dache/Desktop/ronava/server/test_pagination_500_copy_db.mjs) verified pagination over 500 rows on an isolated database copy.
* **Commit**: `3a4ddb6`

---

### FIX 6: Bank & Excel Export Integrity
* **Problem**: Bank payout exports performed floating-point browser math (`grossAmt - feeAmt`) and guessed beneficiary names using regex patterns on `admin_remark`.
* **Hardened Fix**:
  * Removed all client-side money subtraction; net payout amount is sourced strictly from authoritative server-computed fields.
  * Eliminated regex name matching and generic `"Beneficiary"` fallbacks; beneficiary name is populated strictly from the validated `holder_name` field.
  * Enforced column order required by disbursement banking desks:
    1. `Sl No`
    2. `Merchant ID`
    3. `Merchant Name`
    4. `Merchant Mobile`
    5. `Beneficiary Name`
    6. `Account Number` (escaped as `="<acc>"` to prevent Excel scientific notation loss)
    7. `IFSC`
    8. `Bank Name`
    9. `Net Amount`
    10. `Machine Name`
    11. `Channel`
    12. `Withdrawal Mode`
    13. `Swipe Mode`
    14. `UTR Number`
    15. `Date & Time`
* **Verification**: [server/test_fix6_bank_export_integrity.mjs](file:///c:/Users/dache/Desktop/ronava/server/test_fix6_bank_export_integrity.mjs) and [server/test_guardrail_no_browser_money_math.mjs](file:///c:/Users/dache/Desktop/ronava/server/test_guardrail_no_browser_money_math.mjs) pass with 0 violations across 39 client files.
* **Commit**: `e7c859f`

---

## Test Verification Summary
All automated test suites, linting checks, and consistency validations pass cleanly:

```
[1/6] Duplicate Endpoints -> 404 NOT FOUND (PASS)
[2/6] Strict Caller Identity & Spoofing Guard (401/403) (PASS)
[3/6] Limit/Offset Pagination Contract (Default 50, Max 200) (PASS)
[4/6] Reversals (10m, 1h, 2d across PENDING, SUBMITTED, COMPLETED) (PASS)
[5/6] Real Browser Rendering on port 3000 (Playwright) (PASS)
[6/6] Zero Prohibited Browser Math / Fallback Violations (39 files clean) (PASS)
[7/7] Unified Consistency Checker:
      ✓ Rule 1: All 46 users have wallet balance === SUM(ledger rows)
      ✓ Rule 2: All 34 swipes satisfy charge equality & net zero reversals
      ✓ 100% CLEAN
```
