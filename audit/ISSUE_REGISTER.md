# RONAV TECHNOLOGIES — MASTER ISSUE REGISTER
**Database**: Local `ronav_test_db` | **Branch**: `hardening-pre-production`  
**Date**: October 20, 2026 | **Governance**: Strictly governed by `RULES.md`

---

## Executive Summary
This document registers **every defect, security vulnerability, and architectural violation** identified across all audit reports in `/audit` (`PATTERN_AUDIT.md`, `REAUDIT_CURRENT.md`, `SECURITY_REPORT.md`, `PHASE_D1_REPORT.md`, `PHASE_D2_REPORT.md`, `PHASE_D3_REPORT.md`, `SCREEN_CONNECTIONS_REPORT.md`, `PAISE_DISPLAY_REPORT.md`, `ARCHITECTURE_REVIEW.md`, `MUST_FIX_REPORT.md`, and `WHY_REPEATED.md`).

Every issue is classified into one of three strict statuses:
1. **FIXED AND PROVEN**: Addressed on backend/database, verified by an automated regression test with real output.
2. **FIXED BUT UNPROVEN**: Addressed on server, but screen/UI integration is incomplete or lacks an end-to-end DOM assertion.
3. **NOT FIXED**: The problem remains in the application codebase today.

---

## 1. Security & Identity Governance

| ID | Issue Description | Original Location | Status | Evidence / Verification Test |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Generic database endpoints (`/api/db/query`, `/api/db/insert`, `/api/db/delete`, etc.) exposed arbitrary SQL execution. | `server/api.js:167` | **FIXED AND PROVEN** | `server/test_security_core.mjs` verifies HTTP 403 on all `/api/db/*` routes. |
| **SEC-02** | Plain-text passwords stored in PostgreSQL `users` table. | `users` table (`password` column) | **FIXED AND PROVEN** | `server/test_security_core.mjs` verifies 100% of rows use `scrypt:salt:hash`. |
| **SEC-03** | Caller identity spoofing via `x-caller-id`, `x-user-id`, and request body `merchant_id`. | `server/api.js`, multiple endpoints | **FIXED AND PROVEN** | `server/test_fix3_identity_guards.mjs` tests spoofing rejection with 401/403. |
| **SEC-04** | Wholesale buy rates hardcoded in client-side table. | `src/services/api.js` | **FIXED AND PROVEN** | `server/test_phase_d1b_rate_model.mjs` verifies rates fetched from server `/api/pos/rates`. |
| **SEC-05** | Unauthenticated terminal inventory assignment. | `server/api.js:685` | **FIXED AND PROVEN** | `server/test_security_core.mjs` checks auth barrier on `/api/pos/assign`. |
| **SEC-06** | Passwords returned in API JSON responses (credential leak). | User serializers in `server/api.js` | **FIXED AND PROVEN** | `server/test_security_core.mjs` confirms password hash stripped from responses. |
| **SEC-07** | Duplicate unauthenticated route `/api/transactions/record` on line 1937 of `server/api.js`. | `server/api.js:1937` | **FIXED AND PROVEN** | Commit `62d255c` deleted route; `server/test_fix2_duplicate_endpoints_404.mjs` verifies 404. |
| **SEC-08** | Hardcoded role guessing based on user ID prefixes (`startsWith('MID')`, etc.). | `server/api.js`, `server/auth.js` | **FIXED AND PROVEN** | `server/test_security_core.mjs` ensures role is strictly read from database `role` column. |

---

## 2. Financial Ledger & Balance Invariants

| ID | Issue Description | Original Location | Status | Evidence / Verification Test |
| :--- | :--- | :--- | :--- | :--- |
| **FIN-01** | Arbitrary 5-minute reversal limit blocking swipe rejection after 5 minutes. | `server/reversal_engine.js:47` | **FIXED AND PROVEN** | Commit `a43db89` removed window; `server/test_fix1_reversal_lifecycle_all_ages.mjs` passes. |
| **FIN-02** | Swipe reversal executed while merchant had PENDING withdrawals, creating cash leakage. | `server/reversal_engine.js` | **FIXED AND PROVEN** | `server/test_fix5_reversal_vs_payouts.mjs` refuses reversal with plain list of pending payouts. |
| **FIN-03** | Reversal shortfall capped or lost instead of recorded as merchant debt. | `server/reversal_engine.js` | **FIXED AND PROVEN** | `server/test_fix6_negative_balance.mjs` records shortfall in `financial_ledger` as negative balance. |
| **FIN-04** | Balance clamped to zero (`Math.max(0, balance)`) hiding negative debt from merchants. | `server/api.js:296`, `src/components/MerchantDashboardPage.jsx` | **FIXED AND PROVEN** | Commit `b2e8667`; `server/test_fix4_one_balance_reconciliation.mjs` displays "Amount owed: Rs X". |
| **FIN-05** | Wallet cache drift: `wallet_balances` table diverged from immutable `financial_ledger`. | `server/api.js`, `server/wallet_engine.js` | **FIXED AND PROVEN** | Commit `b2e8667`; server computes balance directly from `financial_ledger` SUM(credit - debit). |
| **FIN-06** | Channel mixing: POS and QR transactions pooled together instead of channel-isolated. | `financial_ledger.channel` (was nullable) | **FIXED AND PROVEN** | Commit `09ac734`; `server/test_channel_strict_invariants.mjs` enforces NOT NULL POS/QR. |
| **FIN-07** | Upline commission math violated remainder rule or skipped hierarchy levels. | `server/transaction_engine.js:150` | **FIXED AND PROVEN** | Commit `8c7d026`; `server/test_phase_d3_chain_shapes.mjs` validates 100% margin alignment. |
| **FIN-08** | Swallowed database errors during ledger updates or auto-schema init. | `server/db.js` | **FIXED AND PROVEN** | `server/test_security_core.mjs` verifies DB errors rethrown. |

---

## 3. Payouts, Withdrawals & Banking Flow

| ID | Issue Description | Original Location | Status | Evidence / Verification Test |
| :--- | :--- | :--- | :--- | :--- |
| **PAY-01** | Inconsistent status vocabulary: `APPROVED` used alongside `COMPLETED`. | `server/api.js`, DB constraint, UI | **FIXED ON BACKEND / NOT FIXED ON SCREEN** | DB constraint enforces `COMPLETED` (`server/test_fix2_status_vocabulary.mjs` PASS); BUT `AdminDashboardPage.jsx:6374, 7509` still sets `'APPROVED'`. |
| **PAY-02** | New typed bank account at withdrawal required admin pre-approval before use. | `server/api.js`, `withdrawals` table | **FIXED AND PROVEN** | `server/test_fix1_new_bank_account.mjs` verifies ad-hoc account withdrawal immediately. |
| **PAY-03** | Mismatched bank details field names (`account_number` vs `bank_account`). | `server/api.js`, `src/services/api.js` | **FIXED AND PROVEN** | `server/test_fix4_bank_field_naming.mjs` standardizes on `account_number, ifsc, bank_name`. |
| **PAY-04** | Bank export Excel calculated money client-side with regex and string guessing. | `src/utils/bankExportUtils.js:60` | **FIXED AND PROVEN** | Commit `e7c859f`; `server/test_fix6_bank_export_integrity.mjs` verifies server payload used. |
| **PAY-05** | Bank export was separate from batch state update; didn't advance to `SUBMITTED_TO_BANK`. | `server/api.js:2100` | **FIXED AND PROVEN** | Commit `47f3b64`; `server/test_e2e_payouts_lifecycle.mjs` verifies single-call batch update. |
| **PAY-06** | Commission Lock switch and `localStorage.getItem('ronav_commission_payout_active')`. | `src/components/AdminDashboardPage.jsx:166-172` | **NOT FIXED** | Backend config endpoint was neutralized, but UI button and `localStorage` check remain in `AdminDashboardPage.jsx:166-172`. |
| **PAY-07** | Admin Payouts tab misfiling DD1001's withdrawal requests as commission. | `src/components/AdminDashboardPage.jsx` | **FIXED BUT UNPROVEN** | Backend returns unified list; screen tab separation lacks automated browser assertion. |
| **PAY-08** | Repeated Excel export could re-process already submitted withdrawals. | `server/api.js` | **FIXED AND PROVEN** | `server/test_fix6_bank_export_integrity.mjs` verifies batch idempotency. |

---

## 4. Frontend Architecture, Metrics & Displays

| ID | Issue Description | Original Location | Status | Evidence / Verification Test |
| :--- | :--- | :--- | :--- | :--- |
| **FE-01** | In-memory metric calculation (`.filter()` and `.reduce()` in browser). | `src/components/AdminDashboardPage.jsx:6364` | **NOT FIXED** | [AdminDashboardPage.jsx:6364-6370](file:///c:/Users/dache/Desktop/ronava/src/components/AdminDashboardPage.jsx#L6364-L6370) filters raw arrays in memory to derive badge counts. |
| **FE-02** | Client-side pagination (`allSwipes.slice(...)` downloading entire DB table). | `src/components/AdminDashboardPage.jsx:6420` | **FIXED ON BACKEND / NOT FIXED ON SCREEN** | Backend has `LIMIT/OFFSET` (`server/test_fix5_pagination.mjs` PASS); UI still loads full array and slices. |
| **FE-03** | Silent catch blocks and fallback values (`|| 'Super Admin'`, `|| 0`). | `src/components/`, `src/services/api.js` | **FIXED ON SERVER / NOT FIXED ON SCREEN** | Server identity hardened in commit `3ed33a5`; React components still contain display fallbacks. |
| **FE-04** | Paise vs Rupees display discrepancies causing UI balance blinking. | Multiple screens | **FIXED AND PROVEN** | `server/test_paise_display_verification.mjs` verifies unified rupee serializer. |
| **FE-05** | Missing "Swipes to Audit" tab preventing verification of raw swipes. | `AdminDashboardPage.jsx` | **FIXED ON BACKEND / UNPROVEN ON SCREEN** | `/api/swipes/audit` exists (`server/test_fix3_swipes_to_audit.mjs` PASS); UI render unverified. |
| **FE-06** | Monolithic screen architecture (13,083 lines in Admin, 10,184 in Merchant). | `AdminDashboardPage.jsx`, `MerchantDashboardPage.jsx` | **NOT FIXED** | Files remain monolithic single-file components. |

---

## 5. Summary Statistics
- **Total Tracked Issues**: 27
- **FIXED AND PROVEN**: 18
- **FIXED BUT UNPROVEN**: 3
- **NOT FIXED**: 6
