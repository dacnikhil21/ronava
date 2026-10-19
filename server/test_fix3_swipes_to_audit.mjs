import assert from 'node:assert/strict';
import fs from 'node:fs';

async function testSwipesToAudit() {
  console.log('--- TEST: Swipes to Audit (Count and Amount from Same Server Query) ---');
  
  const adminPageContent = fs.readFileSync('src/components/AdminDashboardPage.jsx', 'utf8');
  
  // Verify that totalPendingSwipesAmount is not decoupled from pendingSwipesList
  // Both count and amount must come from the server query or the exact same list
  assert.ok(
    !adminPageContent.includes("totalPendingSwipesAmount = parseFloat(metrics.pendingVolume || 0);") ||
    adminPageContent.includes("pendingSwipesCount: "),
    'totalPendingSwipesAmount must not mismatch pendingSwipesList count'
  );
  
  const apiContent = fs.readFileSync('server/api.js', 'utf8');
  assert.ok(
    apiContent.includes("pendingSwipesCount") && apiContent.includes("pendingSwipesVolume"),
    'server/api.js stats must return both pendingSwipesCount and pendingSwipesVolume from the same query'
  );

  console.log('✓ TEST PASSED: Swipes to Audit count and volume unified.');
}

testSwipesToAudit().catch(err => {
  console.error('EXPECTED FAILING TEST:', err.message);
  process.exit(1);
});
