import assert from 'node:assert/strict';
import { generateBankBatchCSV, generateCommissionBatchCSV } from '../src/utils/bankExportUtils.js';

async function testExportIntegrity() {
  console.log('=== TEST: Bank Export Integrity (Zero Browser Math, Zero Regex Guessing, Exact Columns) ===');

  const testWithdrawal = {
    id: 'WTH-1001',
    merchant_id: 'MID1001',
    merchant_name: 'D Nik',
    merchant_mobile: '6301646000',
    holder_name: 'D Nik Real Account Holder',
    account_number: '1234567890123456',
    ifsc: 'SBIN0001234',
    bank_name: 'State Bank of India',
    amount_rupees: '1500.00',
    net_amount_rupees: '1500.00',
    net_amount_paise: 150000,
    channel: 'pinelabs',
    terminal_id: 'TERM9901',
    withdrawal_mode: 'T1',
    swipe_mode: 'T1',
    utr_number: 'UTR12345678',
    created_at: '2026-10-19T18:52:54.394Z',
    admin_remark: 'Transfer Name: FAKE_NAME_IN_REMARK | Notes'
  };

  const { csvContent } = generateBankBatchCSV([testWithdrawal]);
  const lines = csvContent.replace(/^\uFEFF/, '').trim().split('\r\n');
  assert.equal(lines.length, 2, 'Should have header row and 1 data row');

  const header = lines[0];
  const expectedHeader = 'Sl No,Merchant ID,Merchant Name,Merchant Mobile,Beneficiary Name,Account Number,IFSC,Bank Name,Net Amount,Machine Name,Channel,Withdrawal Mode,Swipe Mode,UTR Number,Date & Time';
  assert.equal(header, expectedHeader, `Header must match required standard format exactly. Got: ${header}`);

  const row = lines[1];
  console.log('Exported row:', row);

  // 1. Beneficiary name must come strictly from holder_name, NOT FAKE_NAME_IN_REMARK
  assert.ok(row.includes('"D Nik Real Account Holder"'), 'Beneficiary Name must match holder_name');
  assert.ok(!row.includes('FAKE_NAME_IN_REMARK'), 'Beneficiary Name must NEVER be guessed from admin_remark regex');

  // 2. Account number must be formatted to prevent scientific notation truncation
  assert.ok(row.includes('="1234567890123456"'), 'Account number must be safely escaped for Excel');

  // 3. Net Amount must be exact server value
  assert.ok(row.includes('1500.00'), 'Net Amount must be exact stored server amount');

  console.log('✓ PASS: Bank export integrity contracts verified successfully.');
}

testExportIntegrity().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('TEST FAILED:', err.message);
  process.exit(1);
});
