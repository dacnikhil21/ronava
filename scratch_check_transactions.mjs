const res = await fetch('http://13.201.4.145/api/admin/pending');
const data = await res.json();

console.log('--- PENDING TRANSACTIONS (SWIPES) ---');
console.log(JSON.stringify(data.pendingTransactions?.filter(t => t.merchant_id === 'MID1001' || t.terminal_id === '11111'), null, 2));

console.log('\n--- ALL TRANSACTIONS FOR MID1001 ---');
console.log(JSON.stringify(data.allTransactions?.filter(t => t.merchant_id === 'MID1001').slice(0, 5), null, 2));

const userRes = await fetch('http://13.201.4.145/api/users/MID1001');
const userData = await userRes.json();
console.log('\n--- MID1001 USER & WALLET DATA ---');
console.log(JSON.stringify(userData, null, 2));

const wRes = await fetch('http://13.201.4.145/api/merchant/withdrawals?merchant_id=MID1001');
const wData = await wRes.json();
console.log('\n--- MID1001 WITHDRAWALS ---');
console.log(JSON.stringify(wData, null, 2));
