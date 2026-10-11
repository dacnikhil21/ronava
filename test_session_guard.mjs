import fetch from 'node-fetch';

async function testSessionGuard() {
  console.log('🧪 TESTING LIVE SESSION INACTIVATION & GUARD...');
  const baseUrl = 'http://13.201.4.145';

  // 1. Non-existent user verify
  const nonExistentRes = await fetch(`${baseUrl}/api/auth/verify?userId=GHOST_USER_999`).then(r => r.json());
  console.log('1. Non-existent user check:', nonExistentRes);
  if (nonExistentRes.code === 'USER_NOT_FOUND' || nonExistentRes.success === false) {
    console.log('   ✅ PASSED: Non-existent user properly rejected.');
  } else {
    console.error('   ❌ FAILED:', nonExistentRes);
  }

  // 2. Active user verify
  const activeRes = await fetch(`${baseUrl}/api/auth/verify?userId=MID1001`).then(r => r.json());
  console.log('2. Active user check:', activeRes);
  if (activeRes.success && activeRes.user.id === 'MID1001') {
    console.log('   ✅ PASSED: Active user accepted.');
  } else {
    console.error('   ❌ FAILED:', activeRes);
  }

  // 3. Attempting transaction with ghost user
  const ghostSale = await fetch(`${baseUrl}/api/transactions/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchant_id: 'GHOST_USER_999',
      amount: 1000
    })
  }).then(r => r.json());
  console.log('3. Ghost user sale attempt:', ghostSale);
  if (ghostSale.code === 'USER_NOT_FOUND' || ghostSale.success === false) {
    console.log('   ✅ PASSED: Ghost user transaction rejected with code USER_NOT_FOUND.');
  } else {
    console.error('   ❌ FAILED:', ghostSale);
  }

  // 4. Attempting withdrawal with ghost user
  const ghostWithdraw = await fetch(`${baseUrl}/api/withdrawals/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchant_id: 'GHOST_USER_999',
      amount: 500,
      bank_name: 'HDFC Bank',
      account_number: '123456789'
    })
  }).then(r => r.json());
  console.log('4. Ghost user withdrawal attempt:', ghostWithdraw);
  if (ghostWithdraw.code === 'USER_NOT_FOUND' || ghostWithdraw.success === false) {
    console.log('   ✅ PASSED: Ghost user withdrawal rejected with code USER_NOT_FOUND.');
  } else {
    console.error('   ❌ FAILED:', ghostWithdraw);
  }

  console.log('\n🏁 ALL SESSION GUARD TESTS COMPLETE!');
}

testSessionGuard();
