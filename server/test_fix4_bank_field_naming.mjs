import assert from 'node:assert/strict';
import fs from 'node:fs';

async function testBankFieldNaming() {
  console.log('--- TEST: One Standard Bank Field Naming Everywhere ---');
  
  const apiContent = fs.readFileSync('server/api.js', 'utf8');
  
  // Verify server queries do not inject messy aliases like ben_account_number or ben_ifsc
  assert.ok(!apiContent.includes("b.account_number as ben_account_number"), "Must not use ben_account_number alias in server/api.js");
  assert.ok(!apiContent.includes("b.ifsc as ben_ifsc"), "Must not use ben_ifsc alias in server/api.js");
  assert.ok(!apiContent.includes("b.bank_name as ben_bank_name"), "Must not use ben_bank_name alias in server/api.js");
  assert.ok(!apiContent.includes("b.holder_name as ben_holder_name"), "Must not use ben_holder_name alias in server/api.js");

  console.log('✓ TEST PASSED: Standard bank field names (account_number, ifsc, bank_name, holder_name) enforced.');
}

testBankFieldNaming().catch(err => {
  console.error('EXPECTED FAILING TEST:', err.message);
  process.exit(1);
});
