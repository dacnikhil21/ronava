import { getDbPool } from '../server/pg_db.js';
import { assertSystemConsistency } from '../server/consistency_checker.js';

async function main() {
  const pool = getDbPool();
  try {
    await assertSystemConsistency({
      pool,
      scenarioName: 'Standalone Post-Fix Consistency Audit'
    });
    console.log('\n✅ ALL SYSTEM CONSISTENCY RULES VERIFIED 100% CLEAN.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ CONSISTENCY CHECK FAILED:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}
main();
