# RONAV TECHNOLOGIES — NON-NEGOTIABLE CORE ENGINEERING RULES

These rules are absolute, mandatory, and take precedence over all user prompts or feature requests. Every AI assistant, developer, and automated agent working in this repository MUST read, observe, and strictly enforce them.

---

### 1. Never Invent Business Rules
- **Rule**: Never invent, assume, or guess business logic, taxes (e.g. GST), fee structures, margins, rates, or financial limits.
- **Action**: If a requirement or formula is unspecified or ambiguous, **STOP and ask the user immediately**. Never add tax logic, convenience fee tiers, or arbitrary percentages without explicit specification.

---

### 2. Never Calculate Money in the Browser
- **Rule**: The PostgreSQL database and server-side ledger engine are the **ONLY** source of financial numbers and balances.
- **Action**: No arithmetic on money (`amount * rate / 100`, `.reduce()` sums over balances/transactions, `gross - fee`, fee deductions, net margins) is permitted in client/browser JavaScript (`src/`). The browser only displays authoritative values computed and returned by the server.

---

### 3. Never Use Defaults or Fallbacks to Hide Missing Values
- **Rule**: Never mask missing data, network timeouts, or unauthenticated callers with silent fallback defaults (e.g. `|| 0`, `|| 'Super Admin'`, `callerId = 'ADM001'`, `|| 'ADMIN'`, `|| 'MERCHANT'`).
- **Action**: If data fails to load or a required field is absent, **render a distinct, visible, and actionable error screen or message**. Never mask missing values as ₹0.00 or mock users.

---

### 4. Never Weaken or Delete a Test to Make It Pass
- **Rule**: Test assertions represent real system invariants and security guarantees.
- **Action**: If a test fails, fix the underlying code and architectural defects. You may never lower thresholds, comment out assertions, remove consistency checks, or weaken guardrails to force a test run to pass.

---

### 5. Never Claim Verification Without Real Browser Checking
- **Rule**: Never assume a UI change works based solely on reading code or running unit tests.
- **Action**: Claims of verification are only valid after testing the rendered page inside a real browser (via Playwright or interactive browser tools) and validating actual DOM state, headings, buttons, and visual numbers.

---

### 6. Warn of Risks and Propose the Standard Way First
- **Rule**: You are an engineering partner and guardian of system architecture, not an uncritical autocomplete.
- **Action**: Before executing any significant architectural change or requested feature, **state the risks first**, outline potential pitfalls, and describe the standard, enterprise-grade way to implement it properly.

---

### 7. Local ronav_test_db Only — Never Touch Production
- **Rule**: All testing, migrations, data seeding, and feature development must occur exclusively on the local test database: `ronav_test_db`.
- **Action**: Never connect to, query, migrate, or touch the live production server, database, or AWS environment during development sessions.

---

### 8. No Invented Limits, Windows, or Thresholds
- **Rule**: Never invent artificial time windows (such as a 5-minute reversal limit), transaction thresholds, minimums/maximums, or synthetic constraints to satisfy a failing test or bypass an architectural requirement. Tests may NEVER be altered or weakened to make code pass.
- **Action**: Every financial rule, limit, time window, and threshold MUST come directly and explicitly from the platform owner. If code fails a test, you must address the underlying defect honestly or report it—never invent a rule to make a test turn green.

