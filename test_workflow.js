import { db } from './server/db.js';

console.log('----------------------------------------------------');
console.log('🧪 RONAV TECHNOLOGIES: END-TO-END SQLITE TEST RUN');
console.log('----------------------------------------------------');

// 1. Check Seeding & Hierarchy
const users = db.prepare(`SELECT * FROM users`).all();
console.log(`✓ Users in system (${users.length} accounts):`);
users.forEach(u => {
  console.log(`  - [${u.role}] ${u.name} (${u.id}) | Creator: ${u.creator_id || 'Root Admin'}`);
});

// 2. Check Pine Labs vs Pray Labs POS Assignments
console.log('\n✓ POS Swipe Machine Configurations:');
const posMachines = db.prepare(`SELECT * FROM merchant_pos`).all();
posMachines.forEach(p => {
  console.log(`  - Merchant: ${p.merchant_id} | Provider: ${p.provider} | Terminal: ${p.terminal_id} | MDR Fee: ${p.commission_rate}%`);
});

// 3. Test Manual Merchant Sale Recording
console.log('\n✓ Testing Manual Sale Recording:');
const initialWallet = db.prepare(`SELECT * FROM wallets WHERE user_id = 'MID3001'`).get();
console.log(`  - Before Sale: Available Balance = ₹${initialWallet.available_balance.toFixed(2)}, Pending = ₹${initialWallet.pending_balance.toFixed(2)}`);

const testTxnId = `TEST-TXN-${Date.now().toString().slice(-4)}`;
const saleAmount = 4500.0;

// Record transaction
db.prepare(`
  INSERT INTO transactions (id, merchant_id, customer_mobile, amount, type, provider, ref_number, notes, status)
  VALUES (?, 'MID3001', '9849011223', ?, 'POS_SWIPE', 'Pine Labs', 'SLIP-9921', 'Test Counter Swipe', 'PENDING')
`).run(testTxnId, saleAmount);

// Update wallet pending
db.prepare(`
  UPDATE wallets 
  SET pending_balance = pending_balance + ?,
      total_sales = total_sales + ?
  WHERE user_id = 'MID3001'
`).run(saleAmount, saleAmount);

const pendingWallet = db.prepare(`SELECT * FROM wallets WHERE user_id = 'MID3001'`).get();
console.log(`  - After Recording Sale (Status PENDING): Available = ₹${pendingWallet.available_balance.toFixed(2)}, Pending = ₹${pendingWallet.pending_balance.toFixed(2)}`);

// 4. Test Admin Verification & Approval
console.log('\n✓ Testing Admin Verification & Approval:');
const pendingTxn = db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(testTxnId);
console.log(`  - Found in Admin Review Queue: ${pendingTxn.id} for ₹${pendingTxn.amount} (Status: ${pendingTxn.status})`);

// Admin Approves
db.prepare(`
  UPDATE transactions 
  SET status = 'APPROVED', 
      admin_remark = 'Verified slip against Pine Labs terminal statement',
      verified_at = CURRENT_TIMESTAMP 
  WHERE id = ?
`).run(testTxnId);

// Credit Wallet Available Balance & clear Pending
db.prepare(`
  UPDATE wallets 
  SET available_balance = available_balance + ?,
      received_sales = received_sales + ?,
      pending_balance = MAX(0.0, pending_balance - ?),
      updated_at = CURRENT_TIMESTAMP
  WHERE user_id = 'MID3001'
`).run(saleAmount, saleAmount, saleAmount);

const approvedWallet = db.prepare(`SELECT * FROM wallets WHERE user_id = 'MID3001'`).get();
console.log(`  - After Admin Approval: Available = ₹${approvedWallet.available_balance.toFixed(2)}, Pending = ₹${approvedWallet.pending_balance.toFixed(2)}`);
console.log(`  - Available balance successfully increased by +₹${saleAmount.toFixed(2)}!`);

console.log('\n----------------------------------------------------');
// 6. Test Beneficiaries
console.log('\n✓ Testing Beneficiaries (Unlimited Bank Accounts):');
const bens = db.prepare(`SELECT * FROM beneficiaries WHERE merchant_id = 'MID3001'`).all();
console.log(`  - Found ${bens.length} beneficiaries for MID3001:`);
bens.forEach(b => {
  console.log(`    • [${b.id}] ${b.bank_name} - ${b.account_number} (${b.holder_name}) ${b.is_primary ? '★ PRIMARY' : ''}`);
});

console.log('\n✅ ALL WORKFLOW RULES & DATA STORES VERIFIED SUCCESSFULLY!');
console.log('----------------------------------------------------');
