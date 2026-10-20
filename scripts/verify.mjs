import { execSync } from 'child_process';
import path from 'path';

console.log('========================================================================');
console.log('           RONAV TECHNOLOGIES — MASTER VERIFICATION RUNNER              ');
console.log('========================================================================\n');

const testSuites = [
  {
    issue: 'Lint & Code Syntax',
    test: 'scripts/lint_check.mjs',
    cmd: 'node scripts/lint_check.mjs'
  },
  {
    issue: 'SEC-01, 02, 05, 06 (Security Core & Hashing)',
    test: 'server/test_security_core.mjs',
    cmd: 'node server/test_security_core.mjs'
  },
  {
    issue: 'SEC-03 (Token Caller Identity Enforcement)',
    test: 'server/test_fix3_identity_guards.mjs',
    cmd: 'node server/test_fix3_identity_guards.mjs'
  },
  {
    issue: 'SEC-07 (Purge Duplicate Server Routes)',
    test: 'server/test_fix2_duplicate_endpoints_404.mjs',
    cmd: 'node server/test_fix2_duplicate_endpoints_404.mjs'
  },
  {
    issue: 'FIN-04, FIN-05 (Ledger Balance Single Source)',
    test: 'server/test_fix4_one_balance_reconciliation.mjs',
    cmd: 'node server/test_fix4_one_balance_reconciliation.mjs'
  },
  {
    issue: 'FIN-06 (Channel Strict Invariants)',
    test: 'server/test_channel_strict_invariants.mjs',
    cmd: 'node server/test_channel_strict_invariants.mjs'
  },
  {
    issue: 'FIN-01 (Reversal Lifecycle All Ages)',
    test: 'server/test_fix1_reversal_lifecycle_all_ages.mjs',
    cmd: 'node server/test_fix1_reversal_lifecycle_all_ages.mjs'
  },
  {
    issue: 'FIN-02 (Reversal Refusal on Pending Payouts)',
    test: 'server/test_fix5_reversal_vs_payouts.mjs',
    cmd: 'node server/test_fix5_reversal_vs_payouts.mjs'
  },
  {
    issue: 'FIN-03 (Shortfall Debt / Negative Balance)',
    test: 'server/test_fix6_negative_balance.mjs',
    cmd: 'node server/test_fix6_negative_balance.mjs'
  },
  {
    issue: 'PAY-01 (DB Status Constraint Vocabulary)',
    test: 'server/test_fix2_status_vocabulary.mjs',
    cmd: 'node server/test_fix2_status_vocabulary.mjs'
  },
  {
    issue: 'PAY-02 (Ad-hoc Typed Bank Accounts)',
    test: 'server/test_fix1_new_bank_account.mjs',
    cmd: 'node server/test_fix1_new_bank_account.mjs'
  },
  {
    issue: 'PAY-04, 05, 08 (Bank Export Integrity & Lifecycle)',
    test: 'server/test_fix6_bank_export_integrity.mjs',
    cmd: 'node server/test_fix6_bank_export_integrity.mjs'
  },
  {
    issue: 'FE-02 (Server Pagination Limit & Offset)',
    test: 'server/test_fix5_pagination.mjs',
    cmd: 'node server/test_fix5_pagination.mjs'
  },
  {
    issue: 'FIN-07 (Commission Chain Shapes & Margins)',
    test: 'server/test_phase_d3_chain_shapes.mjs',
    cmd: 'node server/test_phase_d3_chain_shapes.mjs'
  },
  {
    issue: 'Core Ledger 4-Rule System Consistency',
    test: 'scripts/run_consistency_check.mjs',
    cmd: 'node scripts/run_consistency_check.mjs'
  },
  {
    issue: 'Pattern Guards: Screens Financial Math (FE-01)',
    test: 'server/test_pattern_guards.mjs (Guard 1)',
    cmd: 'node -e "import(\'./server/test_pattern_guards.mjs\').then(m => { const r = m.results.find(x => x.name.includes(\'Guard 1\')); process.exit(r && r.status === \'PASS\' ? 0 : 1); })"'
  },
  {
    issue: 'Pattern Guards: Commission Lock Storage (PAY-06)',
    test: 'server/test_pattern_guards.mjs (Guard 2)',
    cmd: 'node -e "import(\'./server/test_pattern_guards.mjs\').then(m => { const r = m.results.find(x => x.name.includes(\'Guard 2\')); process.exit(r && r.status === \'PASS\' ? 0 : 1); })"'
  },
  {
    issue: 'Pattern Guards: Status Aliases APPROVED (PAY-01)',
    test: 'server/test_pattern_guards.mjs (Guard 3)',
    cmd: 'node -e "import(\'./server/test_pattern_guards.mjs\').then(m => { const r = m.results.find(x => x.name.includes(\'Guard 3\')); process.exit(r && r.status === \'PASS\' ? 0 : 1); })"'
  },
  {
    issue: 'Pattern Guards: Server ID Prefix Auth (SEC-08)',
    test: 'server/test_pattern_guards.mjs (Guard 6)',
    cmd: 'node -e "import(\'./server/test_pattern_guards.mjs\').then(m => { const r = m.results.find(x => x.name.includes(\'Guard 6\')); process.exit(r && r.status === \'PASS\' ? 0 : 1); })"'
  },
  {
    issue: 'Browser Live DOM vs DB Number Parity',
    test: 'scripts/test_admin_screen_numbers_match_db.mjs',
    cmd: 'node scripts/test_admin_screen_numbers_match_db.mjs'
  }
];

const resultsTable = [];

for (const t of testSuites) {
  process.stdout.write(`Executing: ${t.issue.slice(0, 45).padEnd(45)} `);
  try {
    const out = execSync(t.cmd, { stdio: 'pipe' }).toString();
    console.log('✅ PASS');
    resultsTable.push({
      issue: t.issue,
      test: t.test,
      result: 'PASS',
      details: 'All assertions verified against local ronav_test_db'
    });
  } catch (err) {
    console.log('❌ FAIL');
    const errOutput = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
    const firstErr = errOutput.split('\n').filter(l => l.includes('FAIL') || l.includes('Error') || l.includes('Mismatch')).slice(0, 1).join('').trim() || 'Command exited with failure';
    resultsTable.push({
      issue: t.issue,
      test: t.test,
      result: 'FAIL',
      details: firstErr.slice(0, 60)
    });
  }
}

console.log('\n========================================================================================================');
console.log('| ISSUE / AREA                                 | TEST NAME                                | RESULT | DETAILS');
console.log('========================================================================================================');

for (const row of resultsTable) {
  const issueCol = row.issue.padEnd(44).slice(0, 44);
  const testCol = row.test.padEnd(40).slice(0, 40);
  const resultCol = (row.result === 'PASS' ? '✅ PASS' : '❌ FAIL').padEnd(6);
  const detailsCol = row.details.slice(0, 30);
  console.log(`| ${issueCol} | ${testCol} | ${resultCol} | ${detailsCol}`);
}

console.log('========================================================================================================\n');

const total = resultsTable.length;
const passed = resultsTable.filter(r => r.result === 'PASS').length;
const failed = resultsTable.filter(r => r.result === 'FAIL').length;

console.log(`Verification Summary: Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) {
  console.log('⚠️ ATTENTION: System has unproven or failing areas listed above.');
}
