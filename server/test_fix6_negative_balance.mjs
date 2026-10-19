import assert from 'node:assert/strict';
process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
import { getDbPool } from './pg_db.js';
import { getWalletBalances } from './ledger_engine.js';
import { processWithdrawalRequest } from './withdrawal_engine.js';

async function testNegativeBalance() {
  console.log('--- TEST: Negative Balance Representation & Withdrawal Block ---');
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    const testMid = `MID-NEG-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 89)}`;
    const testMob = `97${Math.floor(10000000 + Math.random() * 89999999)}`;
    
    // Create merchant with negative balance (-5,000 Rs = -500,000 paise)
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id) VALUES ($1, 'Test Neg Merchant', $2, 'MERCHANT', 'ADM001')
    `, [testMid, testMob]);
    await client.query(`
      INSERT INTO wallets (user_id, balance_paise, held_paise) VALUES ($1, -500000, 0)
    `, [testMid]);
    await client.query(`
      INSERT INTO financial_ledger (user_id, type, amount_paise, channel, reference_id, reference_type, created_by)
      VALUES ($1, 'adjustment', -500000, 'pinelabs', 'ADJ-NEG-1', 'ADJUSTMENT', 'ADM001')
    `, [testMid]);

    // 1. getWalletBalances MUST NOT clamp to 0
    const balances = await getWalletBalances(client, testMid);
    assert.equal(balances.balance_paise, -500000n, 'balance_paise must be -500000n');
    assert.equal(balances.available_balance_paise, -500000n, 'available_balance_paise must NOT be clamped to 0');
    console.log('✓ TEST PASSED: available_balance_paise correctly preserves negative value without clamping.');

    // 2. Withdrawal request MUST be blocked with plain-English message
    let blockedErr = null;
    try {
      await processWithdrawalRequest(client, {
        merchantId: testMid,
        amountPaise: 100000n,
        channel: 'pinelabs',
        bankName: 'SBI',
        accountNumber: '123456789012',
        ifsc: 'SBIN0001234',
        holderName: 'Test Neg Merchant'
      });
    } catch (err) {
      blockedErr = err;
    }

    assert.ok(blockedErr, 'Withdrawal must be blocked when balance is negative');
    assert.ok(
      blockedErr.message.includes('negative balance') || blockedErr.message.includes('Amount owed: Rs 5,000'),
      `Error must contain plain-English explanation. Got: "${blockedErr.message}"`
    );
    console.log('✓ TEST PASSED: Withdrawal blocked with message:', blockedErr.message);

  } finally {
    client.release();
    await pool.end();
  }
}

testNegativeBalance().then(() => {
  console.log('✓ Negative balance test suite passed.');
  process.exit(0);
}).catch(err => {
  console.error('TEST FAILED:', err.message);
  process.exit(1);
});
