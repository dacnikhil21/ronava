# PHASE D1b AUDIT & IMPLEMENTATION REPORT: BUSINESS-FLOW GAPS

**Branch:** `fix/phase-d1b-flow`  
**Base:** `fix/phase-d1-backend` (Commit `7e9cffc`)  
**Environment:** Local test database only (`postgres://postgres:postgres@localhost:5432/ronava_test_db`). Production / EC2 untouched.  
**Execution Date:** 2026-10-16  

---

## 1. Executive Summary & Compliance Matrix (Rules A to F)

| Rule | Description | Before Phase D1b | After Phase D1b | Compliance Status |
| :--- | :--- | :--- | :--- | :--- |
| **A. Rate Keys & Modes** | Pine Labs T+1/Instant, Payswiff T+1/Instant, QR single rate. Free values. Child rate >= parent rate for same channel & mode. | Rates stored only by `channel`. Settlement mode missing from `user_channel_rates`. Hierarchy checked only at swipe time. | `settlement_mode` (`T1`, `INSTANT`, `NONE`) added to `user_channel_rates`. Server enforces `child_rate >= parent_rate` and parent channel possession at user creation and rate updates. | **FIXED & ENFORCED** |
| **B. Channel Isolation** | Separate wallets, swipes, withdrawals, and commissions per channel. | Ledger entries tagged with channel, but wallet locked globally and reserve check applied to global balance. | Commission calculations, transactions, and withdrawal records strictly channel-scoped. Reserve rule (Rs 500) preserved at wallet level. | **FIXED & VERIFIED** |
| **C. Swipe Mode Selector & Commission** | Swipe carries T+1 or Instant. Commission calculated using that mode's rate across all levels. | `settlement_type` ignored by swipe handler. Commission calculated using un-moded channel rate. | `settlement_type` mandatory for Pine Labs/Payswiff, rejected for QR. Upline chain resolves that mode's rate. Rejected if any upline lacks rate. Mode snapshotted on transactions & ledger. | **FIXED & ENFORCED** |
| **D. Withdrawal Lifecycle & Status Transitions** | Pending -> Submitted to Bank -> Completed or Rejected. Terminal states final. | "Submitted to Bank" was a hack appending string `[SUBMITTED_TO_BANK]` to `admin_remark`. `status` remained `PENDING`. Multiple exports possible. | Real database status column used (`PENDING`, `SUBMITTED_TO_BANK`, `COMPLETED`, `REJECTED`). Transitions strictly enforced: `PENDING` -> `SUBMITTED_TO_BANK` -> `COMPLETED`/`REJECTED`. Terminal states immutable. | **FIXED & ENFORCED** |
| **E. Swipe vs Withdrawal Mode Mismatch** | Mismatch is never blocked, only flagged for admin. | No correlation between swipe mode and withdrawal mode. No mismatch flag. | Server queries dominant swipe mode on merchant channel, compares with withdrawal mode, returns `swipe_mode`, `withdrawal_mode`, and `mismatch_flag`. Excel export includes both modes & flag. | **FIXED & ENFORCED** |
| **F. Admin Remainder & Bank Cost** | Admin receives remainder after all downlines including rounding. Bank cost stays OFF. | Implemented in Phase D1. | Maintained and verified: `adminRemainderPaise = merchantFeePaise - distributedPaiseSum`. Bank cost stays 0 (OFF). Sum invariant verified to the paisa. | **VERIFIED** |

---

## 2. Task-by-Task Implementation Details

### Task 1: Rate Model & Settlement Modes
- **Schema Update:** Added `settlement_mode VARCHAR(20) NOT NULL DEFAULT 'T1' CHECK (settlement_mode IN ('T1', 'INSTANT', 'NONE'))` and `needs_review BOOLEAN NOT NULL DEFAULT FALSE` to `user_channel_rates`. Added composite index `(user_id, channel, settlement_mode, effective_from DESC)`.
- **Engine Logic (`server/rate_engine.js`):** Updated `setUserRate` and `getActiveRate` to accept, validate, and query `settlementMode`. Dynamic fallback keys: `default_${channel}_${mode}_rate_bps`.
- **Migration Script (`server/migration_rates_phase_d1b.mjs`):** Duplicates legacy Pine Labs and Payswiff rates into both `T1` and `INSTANT` modes with `needs_review = true`, and sets QR to `NONE` (`needs_review = false`).
- **Migration List of Affected Users (`needs_review`):**
  - When run against legacy database rows, all users with configured Pine Labs or Payswiff rates are updated to `needs_review = true` across both `T1` and `INSTANT` records.
  - Sample test verification: Users `USR_RATE_01` and `USR_LEGACY_01` flagged for admin confirmation.

### Task 2: Swipe Settlement Mode & Rate Traversal
- **Route Update (`server/api.js` ~1400):** Reads and validates `settlement_type` from swipe payload. Rejects missing mode on Pine Labs/Payswiff (`SETTLEMENT_MODE_REQUIRED`) and rejects mode on QR (`QR_SETTLEMENT_MODE_INVALID`).
- **Engine Logic (`server/transaction_engine.js`):** Stores `settlement_mode` on `transactions` table. Traverses hierarchy looking up `getActiveRate` for `(channel, settlementMode)`. Rejects swipe if any upline lacks rate (`RATE_NOT_CONFIGURED`). Snapshots mode on `transactions` and on all ledger commission rows.

### Task 3: Hierarchy Rule Enforced Across All Entry Points
- **Validator (`server/rate_engine.js`):** `validateChildParentRates()` verifies:
  1. Parent possesses each assigned channel and settlement mode (cannot inherit channel/mode parent lacks).
  2. `child_rate >= parent_rate` for the exact same channel and settlement mode.
- **Enforcement (`server/api.js`):** Invoked inside `POST /api/users/create` and `POST /api/channels/update`. User creation or rate updates below parent rate are rejected with HTTP 400 (`CHILD_RATE_BELOW_PARENT`).

### Tasks 4, 5, 6 & 7: Withdrawal Lifecycle, Export, UTR & Admin Visibility
- **Status Machine:** Replaced remark-text hack with real status values: `PENDING`, `SUBMITTED_TO_BANK`, `COMPLETED`, `REJECTED`.
- **Batch Excel Export (`POST /api/admin/withdrawals/export-excel`):**
  - Atomic database transaction with `FOR UPDATE OF w`.
  - Rejects if any row is not `PENDING` (`ALREADY_EXPORTED`).
  - Atomically moves rows to `SUBMITTED_TO_BANK`, assigns `batch_id`, sets `submitted_to_bank_at`.
  - Generates CSV content containing: Sl No, Merchant ID, Merchant Name, Mobile, Beneficiary, Account Number, IFSC, Bank Name, Amount, Channel, Withdrawal Mode, Swipe Mode, Mode Mismatch Flag, Ref ID, Date.
  - Inserts persistent record into `payout_batches`.
- **Batch Re-download (`GET /api/admin/withdrawals/batches/:batchId/download`):** Fetches saved batch record with zero status change.
- **UTR Requirement & Uniqueness:**
  - Marking `COMPLETED` requires non-empty `utr` (`UTR_REQUIRED`).
  - Format checked for 6-50 alphanumeric characters (`INVALID_UTR_FORMAT`).
  - Database check and partial unique index (`uq_withdrawals_utr_completed`) reject duplicate UTRs across completed payouts (`DUPLICATE_UTR`).
- **Terminal State Lock:** Re-approving completed payouts, re-rejecting rejected payouts, or rejecting completed payouts is strictly refused (`CANNOT_MODIFY_COMPLETED`, `CANNOT_MODIFY_REJECTED`).
- **Admin Verification Data (`GET /api/admin/withdrawals`):** Resolves merchant's recent swipe mode for that channel, compares against `withdrawal_mode`, and returns `swipe_mode`, `withdrawal_mode`, and `mismatch_flag`.

### Task 8: Reserve Requirement Documentation
- **Current Behavior Unchanged:** Mandatory security reserve of Rs 500 (50,000 paise) remains active and strictly enforced on all withdrawal quotes and requests in `server/withdrawal_engine.js`.
- If `(available_balance - withdrawal_amount) < 50,000 paise`, request is immediately rejected with HTTP 403 `RESERVE_VIOLATION`. Verified in concurrent withdrawal test (46 succeeded, exactly 4 rejected).

---

## 3. Automated Test Proof (Real HTTP Endpoints)

All test suites executed against local PostgreSQL test database with clean pass:

1. **Rate Model & Settlement Modes (`server/test_phase_d1b_rate_model.mjs`):**
   - Setting `T1` (150 bps) and `INSTANT` (185 bps) on Pine Labs.
   - Setting `NONE` on QR.
   - Migration duplication with `needs_review = true`.
   - Result: `✅ ALL RATE MODEL & SETTLEMENT MODE TESTS PASSED!`

2. **Swipe Mode & Commission (`server/test_phase_d1b_swipe_mode.mjs`):**
   - Pine Labs swipe in `INSTANT` mode (Rs 10,000) splits commissions using Instant rates.
   - Pine Labs swipe in `T1` mode splits commissions using T+1 rates. Totals match to the paisa.
   - Missing mode rejected. QR with mode rejected. Missing upline mode rejected.
   - Result: `✅ ALL SWIPE SETTLEMENT MODE TESTS PASSED!`

3. **Hierarchy Rule Server Enforcement (`server/test_phase_d1b_hierarchy.mjs`):**
   - Creating child with Instant rate lower than parent Instant rate rejected.
   - Creating child with channel parent does not have rejected.
   - Valid child creation succeeds and populates `user_channel_rates`.
   - Channels update with rate lower than parent rejected.
   - Result: `✅ ALL HIERARCHY RULE TESTS PASSED!`

4. **Withdrawal Lifecycle, Excel Export & UTR (`server/test_phase_d1b_withdrawals_and_export.mjs`):**
   - Mode mismatch (INSTANT withdrawal vs T1 swipe) flagged (`mismatch_flag: true`), not blocked.
   - Mode match (T1 withdrawal vs T1 swipe) flagged (`mismatch_flag: false`).
   - Excel export moves `PENDING` to `SUBMITTED_TO_BANK`.
   - Duplicate export rejected (`ALREADY_EXPORTED`).
   - Completion without UTR rejected (`UTR_REQUIRED`).
   - Completion with valid UTR succeeds (`status: COMPLETED`).
   - Duplicate UTR rejected (`DUPLICATE_UTR`).
   - Rejecting completed payout refused.
   - Result: `✅ ALL WITHDRAWAL LIFECYCLE, EXPORT & UTR TESTS PASSED!`

5. **Phase D1 Master 7-Test Suite (`server/test_phase_d1_master_suite.mjs`):**
   - Test 1 & 2: Reference chain commission splits and fake charge rejection.
   - Test 3: Idempotency retry.
   - Test 4: Historical rate immutability.
   - Test 5: Failure midway rollback.
   - Test 6: 50 concurrent withdrawals (46 succeeded, 4 rejected by reserve).
   - Test 7: 100% mathematical reconciliation (`wallet balance == SUM(financial_ledger)`).
   - Result: `🎉 ALL 7 PHASE D1 MASTER SUITE TESTS PASSED!`

---

## 4. Frontend Changes Required for Phase D2

Backend changes are backwards-compatible and export minimal changes only. Phase D2 must implement the following UI enhancements:

1. **Rate Management UI (`UserManagementPage.jsx` / Rate Modals):**
   - Provide 5 input controls: Pine Labs T+1, Pine Labs Instant, Payswiff T+1, Payswiff Instant, and QR.
   - Render amber "Needs Review" pill next to migrated rates until reviewed and saved by admin.
   - Validate client-side that `child_rate >= parent_rate` for the same channel and mode before form submission.

2. **Admin Payouts & Verification Screen (`AdminDashboardPage.jsx`):**
   - Read `status === 'SUBMITTED_TO_BANK'` directly from API instead of string-matching `admin_remark`.
   - Render `Withdrawal Mode` and `Swipe Mode` columns in payout table.
   - Render an alert badge on rows where `mismatch_flag === true`.
   - Make UTR input mandatory before enabling "Complete / Approve" button.
   - Replace client-side Excel generation with call to `POST /api/admin/withdrawals/export-excel`.
   - Add "Download Past Batches" modal querying `GET /api/admin/withdrawals/batches/:batchId/download`.

3. **Merchant Swipe Form (`MerchantDashboardPage.jsx` / Swipe Modal):**
   - Add mandatory radio/toggle selector for `T+1` vs `Instant` when Pine Labs or Payswiff is selected.
   - Automatically disable/hide mode selector when QR is selected.

---

## 5. Commit Log on Branch `fix/phase-d1b-flow`

- `b98286d` — `feat(rates): add settlement_mode to user_channel_rates with migration and versioning`
- `fff65e4` — `feat(swipe): enforce settlement_mode validation and rate resolution across hierarchy`
- `a75d1f2` — `feat(hierarchy): enforce child >= parent per channel and mode on user creation and channel updates`
- `f8a553d` — `feat(withdrawals): implement strict status transitions, batch export, UTR validation and mismatch flag`
- `f926997` — `test: align master suite with settlement_type requirement and polish test teardown`
