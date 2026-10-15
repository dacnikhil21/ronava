import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgres://ronav_admin:RonavSecure2026!Fintech@localhost:5432/ronav_db'
});

try {
  console.log('====================================================');
  console.log('STEP 1: RAW DATABASE RECORDS FOR MERCHANT MID1001');
  console.log('====================================================');

  const wallet = (await pool.query(`SELECT * FROM wallets WHERE user_id = 'MID1001'`)).rows[0];
  console.log('1. WALLET TABLE RECORD:');
  console.log(wallet);

  const txns = (await pool.query(`SELECT id, amount, provider, status, created_at, notes, admin_remark FROM transactions WHERE merchant_id = 'MID1001' ORDER BY created_at ASC`)).rows;
  console.log('\n2. TRANSACTIONS TABLE (' + txns.length + ' rows):');
  console.table(txns.map(t => {
    let fee = 0;
    if (t.notes && t.notes.includes('[CARD_SWIPE_ENTRY]')) {
      try {
        const meta = JSON.parse(t.notes.slice(t.notes.indexOf('{')));
        fee = parseFloat(meta.company_fee) || 0;
      } catch (_) {}
    }
    return {
      id: t.id,
      provider: t.provider,
      gross: parseFloat(t.amount),
      company_fee: fee,
      net: parseFloat(t.amount) - fee,
      status: t.status,
      created_at: t.created_at
    };
  }));

  const withs = (await pool.query(`SELECT id, amount, status, channel, created_at, admin_remark FROM withdrawals WHERE merchant_id = 'MID1001' ORDER BY created_at ASC`)).rows;
  console.log('\n3. WITHDRAWALS TABLE (' + withs.length + ' rows):');
  console.table(withs.map(w => ({
    id: w.id,
    amount: parseFloat(w.amount),
    channel: w.channel,
    status: w.status,
    admin_remark: (w.admin_remark || '').slice(0, 40),
    created_at: w.created_at
  })));

  console.log('\n====================================================');
  console.log('STEP 2: RUNNING FRONTEND (MerchantDashboardPage.jsx) CODE STEP BY STEP');
  console.log('====================================================');

  // Exact reproduction of MerchantDashboardPage.jsx lines 836-847
  // activeMachineWithdrawals for 'pine_labs'
  const selectedMachineKey = 'pine_labs';
  const classifyTransactionChannel = (w) => {
    const ch = (w.channel || '').toLowerCase();
    const rem = (w.admin_remark || '').toLowerCase();
    if (ch === 'qr' || rem.includes('qr')) return 'qr';
    if (ch === 'payswiff' || rem.includes('payswiff') || rem.includes('swiff')) return 'payswiff';
    return 'pinelabs';
  };

  const activeMachineWithdrawals = withs.filter(w => {
    const channel = classifyTransactionChannel(w);
    if (selectedMachineKey === 'qr') return channel === 'qr';
    if (selectedMachineKey === 'payswiff') return channel === 'payswiff';
    return channel === 'pinelabs';
  });

  console.log('activeMachineWithdrawals count for Pine Labs:', activeMachineWithdrawals.length);

  // Exact reproduction of activeMachineTransactions for 'pine_labs'
  const activeMachineTransactions = txns.filter(t => {
    const p = (t.provider || '').toLowerCase();
    return p.includes('pine');
  });
  console.log('activeMachineTransactions count for Pine Labs:', activeMachineTransactions.length);

  // Exact reproduction of lines 884-905
  let directSwipeNet = 0;
  const approvedTxns = activeMachineTransactions.filter(t => (t.status || '').toUpperCase() === 'APPROVED');
  approvedTxns.forEach(t => {
    let fee = 0;
    if (t.notes && t.notes.includes('[CARD_SWIPE_ENTRY]')) {
      try {
        const meta = JSON.parse(t.notes.slice(t.notes.indexOf('{')));
        fee = parseFloat(meta.company_fee) || 0;
      } catch (_) {}
    }
    directSwipeNet += Math.max(0, parseFloat(t.amount) - fee);
  });
  const receivedSales = directSwipeNet;

  // Exact reproduction of lines 910-913
  const approvedWiths = activeMachineWithdrawals.filter(w => (w.status || '').toUpperCase() === 'APPROVED');
  const withdrawnAmount = approvedWiths.reduce((sum, w) => sum + parseFloat(w.amount), 0);
  const pendingWiths = activeMachineWithdrawals.filter(w => (w.status || '').toUpperCase() === 'PENDING');
  const pendingWithdrawn = pendingWiths.reduce((sum, w) => sum + parseFloat(w.amount), 0);

  // Exact reproduction of lines 933-940
  const channelCredited = receivedSales;
  const channelDebited = withdrawnAmount + pendingWithdrawn;
  const rawChannelBalance = Math.max(0, parseFloat((channelCredited - channelDebited).toFixed(2)));
  const dbAvailableBalance = parseFloat(wallet.available_balance || 0);
  const channelAvailableBalance = Math.min(rawChannelBalance, dbAvailableBalance);

  console.log('\n--- COMPUTED NUMBERS IN FRONTEND ---');
  console.log('1. receivedSales (Total approved Pine swipes net):', receivedSales);
  console.log('2. withdrawnAmount (Total approved withdrawals tagged to Pine):', withdrawnAmount);
  console.log('3. pendingWithdrawn (Pending withdrawal):', pendingWithdrawn);
  console.log('4. channelCredited:', channelCredited);
  console.log('5. channelDebited (withdrawnAmount + pendingWithdrawn):', channelDebited);
  console.log('6. rawChannelBalance (channelCredited - channelDebited):', rawChannelBalance);
  console.log('7. dbAvailableBalance (from PostgreSQL wallet table):', dbAvailableBalance);
  console.log('8. channelAvailableBalance (Math.min(rawChannelBalance, dbAvailableBalance)):', channelAvailableBalance);

  console.log('\n--- EXACT MATCH WITH USER SCREENSHOT ---');
  console.log('Before the pending withdrawal of 10k:');
  console.log('rawChannelBalance was:', (channelCredited - withdrawnAmount));
  console.log('Screen showed: ₹' + (channelCredited - withdrawnAmount - 9820) + ' -> wait, let us trace exact timestamp!');

} catch (err) {
  console.error(err);
} finally {
  await pool.end();
}
