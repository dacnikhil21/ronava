# DESIGN_PAYOUTS.md — Architecture & Blueprint for Withdrawals, Payouts & Swipes

## 1. Executive Summary
This design document defines a unified, server-authoritative architecture for merchant withdrawals, partner commission payouts, POS swipe recording, and audit reconciliations in RONAV. It eliminates client-side role guessing, removes chained frontend API calls, guarantees atomic ledger writes, and ensures all cards, tabs, and lists always match.

---

## 2. Decision Record (Reasoning for Each Decision)

1. **Immediate Wallet Credit on Swipe:** Money from a recorded swipe reflects immediately in the wallet and is immediately withdrawable, because merchants require real-time liquidity for daily business operations.
2. **Explicit `payout_type` in Database:** We add an explicit `payout_type` column (`REGULAR` or `COMMISSION`) to the `withdrawals` table, because the system must never guess the nature of a withdrawal from user ID letters (like `DD` or `DIST`).
3. **Uplines Can Have Both Regular and Commission Withdrawals:** Partners (`DD1001`, `DIST1001`, `SD1001`, `MST1002`) can swipe on their own POS machines and withdraw their swipe earnings under Regular Withdrawals, because distributors are also merchant operators who run counter sales.
4. **Server-Enforced Commission Lock:** The commission lock is verified inside the withdrawal transaction on the server, because client-side or localStorage locks can be bypassed by direct API calls.
5. **One Action = One Server Endpoint:** Batch export to Excel generates the file and transitions the status to `SUBMITTED_TO_BANK` in a single server transaction, because chaining multiple HTTP requests from the browser creates race conditions and partial failures.
6. **Unified Status Vocabulary (`COMPLETED` over `APPROVED`):** We standardize exclusively on `COMPLETED` for finalized payouts with a bank UTR, because having two aliases (`APPROVED` and `COMPLETED`) creates filter fragmentation across screens.
7. **Single Query Layer for Cards and Lists:** Every dashboard card, tab badge, and data table reads from the exact same server aggregation function, because having screens compute their own totals leads to card vs. table discrepancies.
8. **Clean Swipe and Withdrawal Rejection:** Rejecting a withdrawal returns the held money to the wallet, and rejecting a swipe reverses both the merchant net credit and upline commissions, because accounting books must balance to zero when a transaction is invalidated.
9. **Single ₹500 Reserve Across Channels:** A single ₹500 minimum wallet reserve applies across all channels combined, because security reserves protect the entire merchant relationship rather than individual machine terminals.
10. **Zero Nested Transactions:** We remove raw `BEGIN` statements inside `withTransaction`, because nested transactions trigger PostgreSQL warnings and can cause unexpected rollback states.

---

## 3. The Unified Withdrawal State Machine

### 3.1 Statuses & Allowed Transitions
The `withdrawals` table uses exactly 4 statuses:
* **`PENDING`**: Request submitted and funds locked.
* **`SUBMITTED_TO_BANK`**: Included in a bank payout batch export.
* **`COMPLETED`**: Disbursed via bank with an authoritative UTR.
* **`REJECTED`**: Declined by admin; funds returned to user's wallet.

```
       [Merchant / Partner]
                │
                ▼
           ┌─────────┐
           │ PENDING │
           └────┬────┘
                │
                ├─────────────────────────────────────────┐
                │ [Admin: Export Batch]                   │ [Admin: Reject Request]
                ▼                                         ▼
     ┌───────────────────┐                         ┌──────────┐
     │ SUBMITTED_TO_BANK │                         │ REJECTED │ (Hold returned)
     └──────────┬────────┘                         └──────────┘
                │
                ├─────────────────────────────────────────┐
                │ [Admin: Enter UTR]                      │ [Admin: Reject Batch Item]
                ▼                                         ▼
          ┌───────────┐                            ┌──────────┐
          │ COMPLETED │ (With Bank UTR)            │ REJECTED │ (Hold returned)
          └───────────┘                            └──────────┘
```

### 3.2 Transitions & Ledger Writes

| Transition | Triggered By | Valid Prior Status | Database & Ledger Actions |
| :--- | :--- | :--- | :--- |
| **Create Request** | Merchant or Partner | *New* | 1. Lock wallet row (`SELECT ... FOR UPDATE`).<br>2. Check channel balance and ₹500 reserve.<br>3. Insert `financial_ledger` row (`type: withdrawal_hold`, signed negative `-amount`).<br>4. Insert `withdrawals` row (`status: PENDING`, `payout_type: REGULAR|COMMISSION`). |
| **Submit to Bank** | Admin (Export Excel) | `PENDING` | 1. Update `withdrawals.status = 'SUBMITTED_TO_BANK'`.<br>2. Attach `batch_id` and timestamp.<br>*(Ledger unchanged; hold remains active).* |
| **Complete with UTR** | Admin (Disburse) | `SUBMITTED_TO_BANK` or `PENDING` | 1. Validate alphanumeric UTR (6–50 chars) and uniqueness.<br>2. Insert `financial_ledger` row (`type: withdrawal_paid`, amount: `0`, metadata with UTR).<br>3. Update `wallets.withdrawn_paise += amount`.<br>4. Update `withdrawals.status = 'COMPLETED'`, `utr = $utr`. |
| **Reject Withdrawal** | Admin | `PENDING` or `SUBMITTED_TO_BANK` | 1. Insert `financial_ledger` row (`type: withdrawal_reversal`, signed positive `+amount`).<br>2. Update `withdrawals.status = 'REJECTED'`, `admin_remark = $reason`.<br>3. Wallet available balance automatically restores. |

---

## 4. Withdrawal Types & Channel Separation

### 4.1 Explicit `payout_type`
The `withdrawals` table will feature a non-null column:
`payout_type VARCHAR(20) NOT NULL CHECK (payout_type IN ('REGULAR', 'COMMISSION'))`

* **`REGULAR` (Channel Swipe Balance):**
  * Created when withdrawing from a specific POS/QR channel (`pinelabs`, `payswiff`, `qr`).
  * Available to all roles that have POS terminals (`MERCHANT`, `DISTRIBUTOR`, `DISTRICT_DISTRIBUTOR`, etc.).
  * Feeds the **"Regular Withdrawals"** tab in Admin Payouts.
* **`COMMISSION` (Downline Commission Balance):**
  * Created when a partner withdraws their accumulated upline margin earnings.
  * Verified against the server-side Commission Lock.
  * Feeds the dedicated **"Commission Payouts"** tab in Admin Payouts.

### 4.2 Server-Enforced Commission Lock
1. The lock configuration is stored in `system_settings` (`key = 'commission_payouts_locked'`, value `0` or `1`).
2. Inside `processWithdrawalRequest`, if `payout_type === 'COMMISSION'`:
   * The server reads `commission_payouts_locked`.
   * If locked (`1`), the server rejects with HTTP 403: `"COMMISSION_PAYOUTS_LOCKED: Downline commission withdrawals are currently frozen by Admin."`
   * The browser cannot bypass this.

### 4.3 Channel Balance & Reserve Rule
* A user's total withdrawable money from channel $C$ is calculated as:
  $$\text{Max Withdrawable} = \max\left(0, \min\left(\text{Balance of } C, \text{Total Balance Across All Channels} - 500\right)\right)$$
* Money earned in Pine Labs can only be withdrawn under Pine Labs; money earned in Payswiff can only be withdrawn under Payswiff.

---

## 5. Swipes & Audit Flow

1. **Immediate Credit:**
   * When a swipe is recorded, the transaction is inserted with `status = 'APPROVED'`.
   * Merchant is credited immediately (`swipe_credit`), and uplines receive commissions (`commission`).
   * Money is immediately withdrawable.
2. **Swipes to Audit Queue:**
   * In Admin Payouts, the "💳 Swipes to Audit" tab lists recent card swipes for verification against physical POS settlement batches and RRN/UTR numbers.
   * Admin can verify and mark audited (`verified_at = NOW()`), or reject.
3. **Swipe Rejection (Clawback):**
   * If an admin rejects a swipe:
     1. If a withdrawal of those funds is currently `PENDING`, the withdrawal is automatically rejected first (hold returned).
     2. Reversing entries are posted to `financial_ledger`:
        * Merchant: `refund` (`-net_amount_paise`).
        * Uplines: `adjustment` (`-commission_paise`).
     3. Transaction status becomes `REVERSED`.
     4. Everything returns cleanly to normal.

---

## 6. One Action = One Endpoint Architecture

### 6.1 Unified Batch Export & Status Transition
* Endpoint: `POST /api/admin/withdrawals/export-excel`
* Request: `{ withdrawalIds: ['WTH-1', 'WTH-2'], batchName: 'Batch_01' }`
* Server execution inside a single `withTransaction`:
  1. Locks rows (`SELECT ... FOR UPDATE`).
  2. Validates bank details (`account_number` and `ifsc` present).
  3. Updates `status = 'SUBMITTED_TO_BANK'`, `batch_id = $batchId`.
  4. Generates and returns CSV data in the response.
* Frontend action: The frontend triggers the download and immediately updates the UI. **No second API call (`batch-status`) is made.**

### 6.2 Idempotent Batch Updates
* If an admin re-exports or updates batches, the endpoint is strictly idempotent: re-submitting rows already in `SUBMITTED_TO_BANK` updates metadata without throwing errors.

---

## 7. Unified Query Layer for Dashboards & Cards

To eliminate discrepancies between cards and tables:
1. The server exports a single query function: `getPayoutMetrics(clientOrPool, filters)`.
2. Card counts and tab totals are derived from the exact same SQL groupings:
   * **Pending Regular Card:** `SUM(amount_paise) WHERE status = 'PENDING' AND payout_type = 'REGULAR'`
   * **Pending Commission Card:** `SUM(amount_paise) WHERE status = 'PENDING' AND payout_type = 'COMMISSION'`
   * **Submitted Card:** `SUM(amount_paise) WHERE status = 'SUBMITTED_TO_BANK'`
   * **Completed Card:** `SUM(amount_paise) WHERE status = 'COMPLETED'`
3. The table lists filter by matching `status` and `payout_type`. Because both cards and lists use identical criteria, **cards and lists will never disagree**.

---

## 8. Database Migration Plan for Existing Records

### 8.1 Safety & Pre-requisites
1. Take a full `pg_dump` of `ronav_test_db`:
   ```bash
   pg_dump -U postgres -d ronav_test_db -f ronav_test_db_pre_payouts_backup.sql
   ```
2. Rollback script prepared in advance (`rollback_payouts_migration.sql`).

### 8.2 Safe Schema Updates
1. Add `payout_type` column with default `'REGULAR'`:
   ```sql
   ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS payout_type VARCHAR(20) DEFAULT 'REGULAR';
   ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_status_check;
   ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_status_check 
     CHECK (status IN ('PENDING', 'SUBMITTED_TO_BANK', 'COMPLETED', 'REJECTED'));
   ```
2. Update existing legacy `APPROVED` records to `COMPLETED`:
   ```sql
   UPDATE withdrawals SET status = 'COMPLETED' WHERE status = 'APPROVED';
   ```
3. Map existing test records:
   * The two ₹2,500 requests for `DD1001` (`WTH-1792411938114-4252` and `WTH-1792411972138-1039`) were swiped from Pine Labs balance $\rightarrow$ set `payout_type = 'REGULAR'`.
   * Legacy `MID1001` records remain intact with `payout_type = 'REGULAR'`.
   * User IDs, transaction amounts, ledger rows, and balances remain completely unchanged.

---

## 9. Mathematical & Architectural Invariants

The system enforces 6 absolute invariants:
1. **Total Wallet Balance = Sum of Financial Ledger:**
   $$\text{Wallet Balance} = \sum_{\text{ledger}} \text{amount\_paise}$$
2. **Held Funds Invariant:**
   $$\text{Held Paise} = \sum \text{amount\_paise of all withdrawals with status } \in ('\text{PENDING}', '\text{SUBMITTED\_TO\_BANK}')$$
3. **Paisa Conservation:**
   $$\text{Gross Swiped} = \text{Merchant Net} + \sum \text{Upline Commissions} + \text{Admin Margin}$$
4. **No Naked Ledger Rows:** Every ledger entry must reference a valid `transaction_id` or `withdrawal_id`.
5. **No Double Disbursal:** A withdrawal cannot be completed without a unique Bank UTR.
6. **Card Total = List Total:** The sum displayed on a dashboard card must equal the exact sum of rows in that tab.

---

## 10. Automated Test Plan

1. **Test 1: Regular Swipe & Immediate Withdrawability:** Record a ₹10,000 swipe $\rightarrow$ verify wallet reflects ₹9,840 immediately $\rightarrow$ verify quote and withdrawal request succeed immediately.
2. **Test 2: Uplines Can Request Regular Withdrawals:** Create POS swipe for `DD1001` $\rightarrow$ request withdrawal $\rightarrow$ verify `payout_type = 'REGULAR'` $\rightarrow$ verify it appears in Regular Withdrawals tab.
3. **Test 3: Commission Lock Enforcement:** Toggle Commission Lock ON $\rightarrow$ attempt commission withdrawal $\rightarrow$ verify server rejects with HTTP 403 $\rightarrow$ toggle OFF $\rightarrow$ verify request succeeds.
4. **Test 4: One-Step Excel Export:** Trigger Excel export $\rightarrow$ verify CSV is returned AND status changes to `SUBMITTED_TO_BANK` in a single server call $\rightarrow$ verify no secondary error occurs.
5. **Test 5: Withdrawal Rejection:** Reject pending withdrawal $\rightarrow$ verify `withdrawal_reversal` entry is posted $\rightarrow$ verify funds return to wallet.
6. **Test 6: Swipe Rejection Clean Rollback:** Record swipe $\rightarrow$ reject swipe $\rightarrow$ verify merchant credit and all upline commissions are reversed to zero with no orphaned money.
7. **Test 7: Shared Reserve Compliance:** Attempt withdrawal leaving less than ₹500 in total wallet $\rightarrow$ verify server blocks request with exact shortfall.

---

## 11. Risks and Open Questions

1. **Risk:** If a merchant uses multiple counter POS machines concurrently, simultaneous withdrawals could compete for the ₹500 reserve.  
   *Mitigation:* Handled via row-level locking (`SELECT ... FOR UPDATE` on `wallets`).
2. **Open Question:** Do we want a visual indicator on the merchant wallet showing how much is "Regular Swipe Earnings" vs "Commission Earnings"?  
   *Recommendation:* In Phase 2/3, display two clear sub-pills on the wallet card: "Swipe Balance" and "Commission Balance".
3. **Risk:** Legacy third-party API clients sending `APPROVED` instead of `COMPLETED`.  
   *Mitigation:* The state machine will automatically normalize any incoming `APPROVED` action to `COMPLETED`.

---

## 12. 10-Line Executive Summary

1. Money reflects in the wallet immediately after a sale is recorded, and the user can request a withdrawal right away.
2. We add an explicit `payout_type` column (`REGULAR` vs `COMMISSION`) to the database `withdrawals` table.
3. Uplines (`DD1001`, `DIST1001`, `SD1001`, `MST1002`) who swipe on their own POS machines get `REGULAR` withdrawals that appear in the Regular tab.
4. The system never guesses withdrawal types from user ID prefixes (`DD`, `DIST`, `SD`, `MST`).
5. The Commission Lock is enforced strictly inside the database transaction on the server, not in the browser.
6. Batch Excel export is unified into ONE server call that creates the file and updates the status together.
7. Duplicate status names are eliminated by standardizing on `COMPLETED` across all files and constraints.
8. Dashboard cards, tab badges, and data tables all read from the same server query function so numbers always match.
9. Swipe rejections and withdrawal rejections cleanly reverse entries without leaving orphaned balances.
10. All existing hand-made accounts, test records, and balances are safely preserved and mapped to the new schema.
