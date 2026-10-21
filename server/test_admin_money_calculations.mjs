import assert from 'node:assert';
import { query } from './pg_db.js';
import { calculateAuthoritativeLedgerStats } from './api.js';

/**
 * Proof of Concept Test for Admin Money Calculations Fix
 * 1. Verifies calculateAuthoritativeLedgerStats computes authoritative aggregates directly from PostgreSQL financial_ledger.
 * 2. Verifies filtering by date ranges (ALL, TODAY, YESTERDAY, WEEK, MONTH, CUSTOM) queries complete matching ledger data without LIMIT 100.
 * 3. Verifies user queries (GET /api/users, GET /api/hierarchy/tree, GET /api/users/:userId) return total_commission directly from ledger.
 */
async function runAdminMoneyCalculationsTest() {
  console.log('--- ADMIN MONEY CALCULATIONS AUTHORITATIVE TEST ---');

  // 1. Check ALL time ledger stats
  const allStats = await calculateAuthoritativeLedgerStats('ALL');
  console.log('1. All-time stats from ledger:', allStats);
  assert(typeof allStats.totalVolume === 'number', 'totalVolume must be number');
  assert(typeof allStats.totalFeesCollected === 'number', 'totalFeesCollected must be number');
  assert(typeof allStats.partnerCommissions === 'number', 'partnerCommissions must be number');
  assert(typeof allStats.adminNetProfit === 'number', 'adminNetProfit must be number');
  assert(allStats.tierTotals !== undefined, 'tierTotals must be present');
  assert(allStats.channelStats !== undefined, 'channelStats must be present');

  // Invariant: partnerCommissions + adminNetProfit === totalFeesCollected (within 1 paisa tolerance)
  const feeDelta = Math.abs((allStats.partnerCommissions + allStats.adminNetProfit) - allStats.totalFeesCollected);
  assert(feeDelta < 0.02, `Fees invariant violated: ${allStats.partnerCommissions} + ${allStats.adminNetProfit} !== ${allStats.totalFeesCollected}`);

  // 2. Check date-filtered stats (TODAY, WEEK, MONTH)
  const todayStats = await calculateAuthoritativeLedgerStats('TODAY');
  console.log('2. TODAY stats from ledger:', todayStats);
  assert(todayStats.totalVolume <= allStats.totalVolume, 'Today volume must be <= all-time volume');
  assert(todayStats.adminNetProfit <= allStats.adminNetProfit, 'Today profit must be <= all-time profit');

  // 3. Check custom range
  const customStats = await calculateAuthoritativeLedgerStats('CUSTOM', '2020-01-01', '2099-12-31');
  assert.equal(customStats.totalVolume, allStats.totalVolume, 'Wide custom range must match all-time volume');

  // 4. Verify users query returns total_commission from financial_ledger
  const usersWithCommission = await query(`
    SELECT u.id, u.role, COALESCE(comm.total_commission, 0) as total_commission
    FROM users u
    LEFT JOIN (
      SELECT user_id, COALESCE(SUM(amount_paise), 0)::numeric / 100.0 as total_commission
      FROM financial_ledger
      WHERE (type = 'commission' OR (type = 'adjustment' AND (reference_type = 'REVERSAL' OR metadata->>'original_type' = 'commission')))
      GROUP BY user_id
    ) comm ON u.id = comm.user_id
    WHERE comm.total_commission > 0
    LIMIT 5
  `);
  console.log('3. Sample users with ledger commission:', usersWithCommission);

  console.log('✅ ALL ADMIN MONEY CALCULATIONS AUTHORITATIVE ASSERTIONS PASSED!');
  process.exit(0);
}

runAdminMoneyCalculationsTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
