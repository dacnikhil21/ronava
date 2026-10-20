# WHY BUGS KEPT COMING BACK — ARCHITECTURAL AUTOPSY REPORT
**Target Database**: Local `ronav_test_db` | **Branch**: `hardening-pre-production`  
**Date**: October 20, 2026 | **Audience**: Platform Owner & Non-Technical Leadership

---

## 1. Git Trace of the Repeated Problems

| Issue | When / Where Introduced | Supposed "Fix" Commits | Current Status in `hardening-pre-production` | Why It Persisted |
| :--- | :--- | :--- | :--- | :--- |
| **Commission Lock & localStorage** | Added in `c4cd35b` & `723ea82` | `d57f9f2` fixed server SQL; `eb8ac21` kept UI. | **STILL PRESENT** in [src/components/AdminDashboardPage.jsx:166-172](file:///c:/Users/dache/Desktop/ronava/src/components/AdminDashboardPage.jsx#L166-L172). | Past tasks only touched the server config endpoint `/api/settings/config`, leaving the toggle button and `localStorage` in the 13,000-line screen untouched. |
| **5-Minute Reversal Window** | Added in `bedb0df` / `97972f4` (`INTERVAL '5 minutes'`) | Claimed fixed in `PHASE_D1_REPORT.md` (never actually deleted). | **FIXED** in commit `a43db89` in [server/reversal_engine.js:52-78](file:///c:/Users/dache/Desktop/ronava/server/reversal_engine.js#L52-L78). | An AI agent invented the 5-minute limit to pass a quick test; subsequent agents wrote reports claiming reversals were "pure and atomic" without checking SQL line 47. |
| **Status Aliases (`APPROVED` vs `COMPLETED`)** | Added in `60cbff3` (`finalcut`) & `8caf157` | `97972f4` migrated DB schema to `COMPLETED`. | **PARTIAL**: DB/Server clean; Screen still has `setPayoutStatusFilter('APPROVED')` in [AdminDashboardPage.jsx:6374, 7509](file:///c:/Users/dache/Desktop/ronava/src/components/AdminDashboardPage.jsx#L6374). | Backend engineers fixed the PostgreSQL `CHECK` constraint, but frontend UI authors kept `'APPROVED'` as the active tab string in React state. |
| **Browser Money Math Reappearing** | Added in `60cbff3` (`finalcut`) across dashboards | `5e1c264` claimed to "eliminate money math" and added a guardrail. | **PARTIAL**: Purged from `bankExportUtils.js` (`e7c859f`) and line 6793 (`3a4ddb6`); batch cards still group items in memory. | The guardrail test used narrow regexes that only caught specific variable names; when developers wrote new batch cards, they wrote new `.reduce()` calls that slipped past the checker. |
| **Browser-Computed Counts & Badges** | Added in `60cbff3` (`finalcut`) lines 6346–6405 | Never refactored to server endpoints. | **STILL PRESENT** in [AdminDashboardPage.jsx:6364-6370](file:///c:/Users/dache/Desktop/ronava/src/components/AdminDashboardPage.jsx#L6364-L6370). | The server sends raw arrays (`allSwipes`, `allWithdrawals`), and the screen runs `.filter()` in the browser to calculate how many items are Pending or Completed. |
| **Fallbacks Returning (`|| 'Super Admin'`, `body.merchant_id`)** | Added in `11490f2` and `60cbff3` | `97972f4`, `5e1c264` removed some instances. | **FIXED on Server** in `3ed33a5`; lingering UI display fallbacks. | Developers copy-pasted older JSX blocks to build new tabs, re-introducing the exact fallback strings that had been deleted elsewhere. |

---

## 2. Root Causes in How This Software Was Built
1. **The 13,000-Line Monolith Anti-Pattern**:
   `AdminDashboardPage.jsx` has 13,083 lines and `MerchantDashboardPage.jsx` has 10,184 lines. When a file is that huge, changes on line 500 do not update line 7,500. It is impossible for human developers or AI agents to hold the entire file in context.
2. **Whack-A-Mole Fixing**:
   When told "line X has a bug", agents fixed only line X instead of searching the entire codebase to eliminate the pattern globally.
3. **Copy-Paste Contagion**:
   Every time a new modal or card was added, existing code was copied. The bad habits (like `localStorage` flags, browser math, and fallback strings) were cloned along with the layout.
4. **Narrow "Paper" Tests**:
   Guardrail tests checked narrow regexes rather than actual behavior. For example, testing that a token works is not the same as testing that a user cannot spoof someone else's account.
5. **Context Compaction & AI Amnesia**:
   Between long coding sessions, conversational history was compacted. Incoming agents read reports that claimed "Everything is 100% fixed" and assumed the screens were clean without re-checking the DOM.
6. **Declaring Victory on Backend Tests Alone**:
   Agents ran a Node script, saw a green checkmark, declared the issue "DONE", and never verified whether the React screen actually used the new endpoint.

---

## 3. Earlier Reports That Claimed "Fixed" but Were Wrong

1. **`audit/PHASE_D2_REPORT.md`**:
   * *Claimed*: "Zero browser money math across all screens; all statuses standardized to COMPLETED, PENDING, SUBMITTED_TO_BANK, REJECTED."
   * *Actual Truth*: `AdminDashboardPage.jsx:6374, 7509` still had `setPayoutStatusFilter('APPROVED')`, and line 6793 still used `.reduce()` for batch totals.
   * *Why Wrong*: Tested backend routes only; never checked the state variables of the React tabs.
2. **`audit/SECURITY_REPORT.md`**:
   * *Claimed*: "Identity strictly enforced from token; no caller identity fallbacks exist."
   * *Actual Truth*: `/api/transactions/record` and `/api/withdrawals/request` still fell back to `req.body.merchant_id || caller.id`.
   * *Why Wrong*: Tested that valid logins worked, but never ran a negative test sending an attacker token with a victim merchant ID in the request body.
3. **`audit/PATTERN_AUDIT.md`**:
   * *Claimed*: "All legacy duplicate routes deprecated and client rewired to canonical engine."
   * *Actual Truth*: An unauthenticated duplicate route sat at line 1937 of `server/api.js` until commit `62d255c`.
   * *Why Wrong*: Verified that the new route was created, but never checked if the old route had actually been deleted from the file.
4. **`audit/MUST_FIX_REPORT.md`**:
   * *Claimed*: "All 6 fixes complete; pagination and export verified."
   * *Actual Truth*: The server endpoints and Excel export utilities were fixed, but `AdminDashboardPage.jsx` still used client-side `.slice()` for pagination, still had the commission lock toggle, and still had `'APPROVED'` tab aliases.
   * *Why Wrong*: Conflated "Backend API contract is complete" with "The 13,000-line screen is completely rewired".

---

## 4. Blunt Self-Critique: What in the Working Method Caused This?
* **Backend-First Tunnel Vision**: Verifying that a Node API returns 200/400 and immediately declaring victory, without opening the screen in a browser to see if the user interface actually changed.
* **Believing Past Audit Reports**: Accepting previous report claims at face value instead of independently searching the live code with ripgrep.
* **Treating Symptoms Instead of Root Patterns**: Deleting an error where the user pointed, rather than searching for all occurrences of that error across all 39 source files.

---

## 5. Concrete Process Changes to Prevent Regressions
1. **Split the Monolithic Screens**:
   Refactor `AdminDashboardPage.jsx` (13,083 lines) into distinct, small components (`PayoutsTab.jsx`, `SwipesAuditTab.jsx`, `BatchDrawer.jsx`). Monoliths breed bugs.
2. **Real Browser (Playwright) DOM Assertions**:
   Every rule must have a browser test that inspects rendered HTML elements. If a button says `'APPROVED'` or a batch total is calculated in JavaScript, the test must fail the build.
3. **Negative & Penetration Testing in CI**:
   Tests must actively attempt bad behavior: try to spoof an ID, try to withdraw with debt, try to reverse after 3 days. If the server allows it, the build fails.
4. **Banning Client-Side Financial Calculations**:
   Add a pre-commit git hook that rejects any pull request containing `.reduce()` or `gross - fee` on monetary data in `src/`.
5. **No "Done" Without Three-Tier Evidence**:
   A fix is only DONE when verified at all three tiers: (1) Database constraint, (2) Server API contract, and (3) Rendered screen in a real browser.
