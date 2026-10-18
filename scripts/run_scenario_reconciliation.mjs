// scripts/run_scenario_reconciliation.mjs
// Strictly runs on ronav_scenario_db to verify 2 rejected swipes return all balances to starting values
// and net ledger amounts equal 0.
process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_scenario_db';

import assert from 'node:assert/strict';
import pg from 'pg';
import { cleanAndReseed } from '../server/clean_and_reseed.mjs';
import { processSwipeTransaction } from '../server/transaction_engine.js';
import { reverseTransaction } from '../server/reversal_engine.js';

async function run() {
  console.log('--- RUNNING 2 REJECTED SWIPES TEST ON ronav_scenario_db ---');
  assert.equal(
    process.env.TEST_DATABASE_URL,
    'postgres://postgres:postgres@localhost:5432/ronav_scenario_db',
    'Safety check: MUST ONLY RUN ON ronav_scenario_db'
  );

  await cleanAndReseed();
  console.log('✓ Clean and reseed completed on ronav_scenario_db.');

  const pool = new pg.Pool({
    connectionString: 'postgres://postgres:postgres@localhost:5432/ronav_scenario_db'
  });

  const client = await pool.connect();
  try {
    // Record starting balances
    const initialBalancesRes = await client.query('SELECT user_id, balance_paise FROM wallets ORDER BY user_id');
    const startBalances = {};
    initialBalancesRes.rows.forEach(r => { startBalances[r.user_id] = r.balance_paise; });

    // Process 2 swipes
    const s1 = await processSwipeTransaction(client, {
      merchantId: 'MID4001',
      amountPaise: 1000000n, // Rs 10,000
      channel: 'pinelabs',
      settlementMode: 'T1',
      notes: 'Swipe 1 to reject',
      refNumber: 'REF-S1-' + Date.now(),
      createdBy: 'MID4001'
    });
    const s2 = await processSwipeTransaction(client, {
      merchantId: 'MID4001',
      amountPaise: 1000000n, // Rs 10,000
      channel: 'pinelabs',
      settlementMode: 'T1',
      notes: 'Swipe 2 to reject',
      refNumber: 'REF-S2-' + Date.now(),
      createdBy: 'MID4001'
    });
    console.log(`✓ Processed 2 swipes: ${s1.id}, ${s2.id}`);

    // Reject both swipes
    await reverseTransaction(client, {
      txnId: s1.id,
      reason: 'REJECTED_BY_ADMIN',
      callerId: 'ADM001'
    });
    await reverseTransaction(client, {
      txnId: s2.id,
      reason: 'REJECTED_BY_ADMIN',
      callerId: 'ADM001'
    });
    console.log('✓ Rejected both swipes with reverseTransaction.');

    // Check ending wallet balances match starting balances
    const endBalancesRes = await client.query('SELECT user_id, balance_paise FROM wallets ORDER BY user_id');
    for (const r of endBalancesRes.rows) {
      assert.equal(r.balance_paise, startBalances[r.user_id], `User ${r.user_id} balance did not return to starting value!`);
    }
    console.log('✓ All user wallet balances returned exactly to starting values.');

    // Check net ledger sums for both swipes
    const ledgerSum = await client.query(`
      SELECT COALESCE(SUM(amount_paise), 0) as net
      FROM financial_ledger
      WHERE reference_id IN ($1, $2)
    `, [s1.id, s2.id]);
    assert.equal(BigInt(ledgerSum.rows[0].net), 0n, 'Net ledger amount for rejected swipes must be 0');
    console.log('✓ Net financial ledger sum for rejected swipes is exactly 0.');

    // Check net for each category: swipe_credit + refund = 0, commission + adjustment = 0
    const typeSums = await client.query(`
      SELECT type, COALESCE(SUM(amount_paise), 0) as total
      FROM financial_ledger
      WHERE reference_id IN ($1, $2)
      GROUP BY type
    `, [s1.id, s2.id]);
    const typeMap = {};
    typeSums.rows.forEach(r => { typeMap[r.type] = BigInt(r.total); });
    
    const merchantCreditNet = (typeMap['swipe_credit'] || 0n) + (typeMap['refund'] || 0n);
    assert.equal(merchantCreditNet, 0n, 'swipe_credit + refund must net to exactly 0');
    
    const commissionNet = (typeMap['commission'] || 0n) + (typeMap['adjustment'] || 0n);
    assert.equal(commissionNet, 0n, 'commission + adjustment must net to exactly 0');

    // Check each user's net ledger change is exactly 0
    const userNets = await client.query(`
      SELECT user_id, COALESCE(SUM(amount_paise), 0) as net
      FROM financial_ledger
      WHERE reference_id IN ($1, $2)
      GROUP BY user_id
    `, [s1.id, s2.id]);
    for (const r of userNets.rows) {
      assert.equal(BigInt(r.net), 0n, `User ${r.user_id} net ledger change is not 0: ${r.net}`);
    }

    console.log('✓ All categories (merchant credits, fees, commissions, admin profit) netted out to 0.');
    console.log('✓ 2-swipe rejection verification passed 100% on ronav_scenario_db.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Scenario reconciliation test failed:', err);
  process.exit(1);
});
