import assert from 'node:assert/strict';
import fs from 'node:fs';

async function testStatusVocabulary() {
  console.log('--- TEST: One Status Vocabulary Across Database, Server, and Frontend ---');
  
  // 1. Verify AdminDashboardPage.jsx includes SUBMITTED_TO_BANK and COMPLETED in allWithdrawals filter
  const adminPageContent = fs.readFileSync('src/components/AdminDashboardPage.jsx', 'utf8');
  
  // Find allWithdrawals definition
  const allWithdrawalsMatch = adminPageContent.match(/const allWithdrawals = dedupeById\(\[\s*([\s\S]*?)\]\);/);
  assert.ok(allWithdrawalsMatch, 'allWithdrawals must be defined in AdminDashboardPage.jsx');
  const allWithdrawalsCode = allWithdrawalsMatch[1];
  
  assert.ok(
    allWithdrawalsCode.includes("'SUBMITTED_TO_BANK'") || allWithdrawalsCode.includes('"SUBMITTED_TO_BANK"'),
    'allWithdrawals MUST include SUBMITTED_TO_BANK filter'
  );
  assert.ok(
    allWithdrawalsCode.includes("'COMPLETED'") || allWithdrawalsCode.includes('"COMPLETED"'),
    'allWithdrawals MUST include COMPLETED filter'
  );

  console.log('✓ TEST PASSED: AdminDashboardPage.jsx includes SUBMITTED_TO_BANK and COMPLETED in allWithdrawals.');
}

testStatusVocabulary().catch(err => {
  console.error('EXPECTED FAILING TEST:', err.message);
  process.exit(1);
});
