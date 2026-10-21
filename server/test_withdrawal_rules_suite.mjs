import assert from 'node:assert/strict';
import { getDbPool } from './pg_db.js';
import { processWithdrawalRequest } from './withdrawal_engine.js';
import { setUserRate } from './rate_engine.js';
import { postLedgerEntry } from './ledger_engine.js';

async function testWithdrawalRules() {
  console.log('--- TEST: Strict Withdrawal Rules & Role Guards ---');
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    const timestamp = Date.now().toString().slice(-5);
    const mid = `MID-RULE-${timestamp}`;
    const did = `DD-RULE-${timestamp}`;
    const adm = `ADM001`;

    // Setup test users in DB
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id) VALUES
      ($1, 'Rule Merchant', $2, 'MERCHANT', 'ADM001'),
      ($3, 'Rule Distributor', $4, 'DISTRICT_DISTRIBUTOR', 'ADM001')
      ON CONFLICT (id) DO NOTHING
    `, [mid, `91${timestamp}01`, did, `91${timestamp}02`]);

    await client.query(`
      INSERT INTO wallets (user_id, balance_paise, held_paise) VALUES
      ($1, 0, 0),
      ($2, 0, 0)
      ON CONFLICT (user_id) DO UPDATE SET balance_paise = 0, held_paise = 0
    `, [mid, did]);

    // Give ledger entries so balance exists on pinelabs channel
    await postLedgerEntry(client, {
      userId: mid,
      type: 'swipe_credit',
      amountPaise: 1000000n, // Rs 10,000
      channel: 'pinelabs',
      createdBy: mid
    });

    await postLedgerEntry(client, {
      userId: did,
      type: 'commission',
      amountPaise: 1000000n, // Rs 10,000
      channel: 'pinelabs',
      createdBy: 'ADM001'
    });

    // TEST 1: REGULAR without UTR must be rejected
    console.log('1. Testing REGULAR withdrawal without UTR (must be rejected)...');
    let errNoUtr = null;
    try {
      await processWithdrawalRequest(client, {
        merchantId: mid,
        amountPaise: 100000n,
        channel: 'pinelabs',
        payoutType: 'REGULAR',
        utr: '',
        enforceUtr: true,
        bankName: 'HDFC Bank',
        accountNumber: '123456789012',
        ifsc: 'HDFC0001234',
        holderName: 'Rule Merchant'
      });
    } catch (e) {
      errNoUtr = e;
    }
    assert.ok(errNoUtr, 'REGULAR withdrawal without UTR must fail');
    assert.ok(
      errNoUtr.message.includes('UTR_REQUIRED') || errNoUtr.message.includes('Slip UTR'),
      `Expected UTR required error, got: ${errNoUtr.message}`
    );
    console.log('   ✓ REGULAR without UTR rejected as expected.');

    // TEST 2: COMMISSION without UTR must SUCCEED for distributor
    console.log('2. Testing COMMISSION withdrawal without UTR for Distributor (must succeed)...');
    const commWth = await processWithdrawalRequest(client, {
      merchantId: did,
      amountPaise: 100000n, // Rs 1,000
      channel: 'pinelabs',
      payoutType: 'COMMISSION',
      utr: null,
      bankName: 'ICICI Bank',
      accountNumber: '987654321098',
      ifsc: 'ICIC0000001',
      holderName: 'Rule Distributor'
    });
    assert.ok(commWth && commWth.id, 'COMMISSION withdrawal without UTR must succeed');
    assert.equal(commWth.payout_type, 'COMMISSION');
    assert.equal(commWth.utr, null);
    console.log('   ✓ COMMISSION without UTR succeeded.');

    // TEST 3: Merchant requesting COMMISSION must be rejected
    console.log('3. Testing Merchant requesting COMMISSION (must be rejected)...');
    let errMerchantComm = null;
    try {
      await processWithdrawalRequest(client, {
        merchantId: mid,
        amountPaise: 100000n,
        channel: 'pinelabs',
        payoutType: 'COMMISSION',
        bankName: 'HDFC Bank',
        accountNumber: '123456789012',
        ifsc: 'HDFC0001234',
        holderName: 'Rule Merchant'
      });
    } catch (e) {
      errMerchantComm = e;
    }
    assert.ok(errMerchantComm, 'Merchant requesting COMMISSION must be rejected');
    assert.ok(
      errMerchantComm.message.includes('MERCHANT_COMMISSION_DISALLOWED') || errMerchantComm.message.includes('Merchants cannot request commission'),
      `Expected Merchant commission rejection, got: ${errMerchantComm.message}`
    );
    console.log('   ✓ Merchant commission request rejected.');

    // TEST 4: Admin requesting withdrawal must be rejected
    console.log('4. Testing Admin requesting withdrawal (must be rejected)...');
    let errAdminWth = null;
    try {
      await processWithdrawalRequest(client, {
        merchantId: 'ADM001',
        amountPaise: 100000n,
        channel: 'pinelabs',
        payoutType: 'REGULAR',
        utr: 'UTR-ADM-FAIL',
        bankName: 'HDFC Bank',
        accountNumber: '123456789012',
        ifsc: 'HDFC0001234',
        holderName: 'Admin'
      });
    } catch (e) {
      errAdminWth = e;
    }
    assert.ok(errAdminWth, 'Admin requesting withdrawal must be rejected');
    assert.ok(
      errAdminWth.message.includes('ADMIN_WITHDRAWAL_DISALLOWED') || errAdminWth.message.includes('Administrator accounts cannot request withdrawals'),
      `Expected Admin withdrawal rejection, got: ${errAdminWth.message}`
    );
    console.log('   ✓ Admin withdrawal request rejected.');

    // TEST 5: REGULAR with non-empty UTR succeeds and preserves exact typed UTR
    console.log('5. Testing REGULAR with typed UTR (must succeed and preserve exact string)...');
    const testTypedUtr = `utr-exact-1234-${timestamp}`;
    const regWth = await processWithdrawalRequest(client, {
      merchantId: mid,
      amountPaise: 100000n,
      channel: 'pinelabs',
      payoutType: 'REGULAR',
      utr: `  ${testTypedUtr}  `,
      bankName: 'State Bank of India',
      accountNumber: '555566667777',
      ifsc: 'SBIN0001234',
      holderName: 'Rule Merchant'
    });
    assert.ok(regWth && regWth.id);
    assert.equal(regWth.payout_type, 'REGULAR');
    assert.equal(regWth.utr, testTypedUtr, 'UTR must be stored trimmed without uppercase mutation or lost chars');
    console.log('   ✓ REGULAR with exact UTR succeeded.');

    // TEST 6: Informational flag when COMMISSION exceeds earned commission on channel
    console.log('6. Testing informational flag when COMMISSION exceeds earned commission...');
    // did only earned Rs 10,000 (1000000 paise). Post a commission withdrawal of Rs 15,000
    // Give did enough wallet balance via ledger credit (e.g. swipe credit from its own channel sale):
    await postLedgerEntry(client, {
      userId: did,
      type: 'swipe_credit',
      amountPaise: 2000000n, // Rs 20,000 regular swipe
      channel: 'pinelabs',
      createdBy: did
    });

    const excessCommWth = await processWithdrawalRequest(client, {
      merchantId: did,
      amountPaise: 1500000n, // Rs 15,000 > Rs 10,000 earned commission
      channel: 'pinelabs',
      payoutType: 'COMMISSION',
      bankName: 'ICICI Bank',
      accountNumber: '987654321098',
      ifsc: 'ICIC0000001',
      holderName: 'Rule Distributor'
    });
    assert.ok(excessCommWth && excessCommWth.id, 'Excess commission withdrawal must not be blocked (flag only)');
    // Check DB row has informational flag recorded in admin_remark
    const dbWth = await client.query(`SELECT admin_remark FROM withdrawals WHERE id = $1`, [excessCommWth.id]);
    assert.ok(
      dbWth.rows[0]?.admin_remark?.includes('COMMISSION_EXCEEDS_EARNED'),
      'Withdrawal must record informational flag [COMMISSION_EXCEEDS_EARNED] when exceeding earned commission'
    );
    console.log('   ✓ Informational flag recorded on excess commission withdrawal.');

    console.log('\n✅ ALL WITHDRAWAL RULES SUITE TESTS PASSED.');
  } finally {
    client.release();
    await pool.end();
  }
}

testWithdrawalRules().catch(err => {
  console.error('❌ TEST FAILED:', err.message);
  process.exit(1);
});
