import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mqsbejpakkolowfkkaas.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xc2JlanBha2tvbG93ZmtrYWFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODc1Nzg5MywiZXhwIjoyMTA0MzMzODkzfQ.1rz2SX_PT7HiZCqzfeKBTu_rehSYxxIzmcWh9RmPF2E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function wipeAllTestData() {
  console.log('=== WIPING ALL TEST DATA FROM SUPABASE ===\n');

  // 1. Delete all transactions
  const { error: tErr } = await supabase.from('transactions').delete().neq('id', 'KEEP_NONE');
  console.log('1. Transactions deleted:', tErr ? tErr.message : '✓ All cleared');

  // 2. Delete all withdrawals
  const { error: wErr } = await supabase.from('withdrawals').delete().neq('id', 'KEEP_NONE');
  console.log('2. Withdrawals deleted:', wErr ? wErr.message : '✓ All cleared');

  // 3. Delete all beneficiaries
  const { error: bErr } = await supabase.from('beneficiaries').delete().neq('id', 'KEEP_NONE');
  console.log('3. Beneficiaries deleted:', bErr ? bErr.message : '✓ All cleared');

  // 4. Delete all merchant_pos
  const { error: pErr } = await supabase.from('merchant_pos').delete().neq('merchant_id', 'KEEP_NONE');
  console.log('4. POS terminals deleted:', pErr ? pErr.message : '✓ All cleared');

  // 5. Delete all non-admin wallets
  const { error: walErr } = await supabase.from('wallets').delete().neq('user_id', 'ADM001');
  console.log('5. Non-admin wallets deleted:', walErr ? walErr.message : '✓ Cleared');

  // 6. Delete all non-admin users (due to self-referencing creator_id hierarchy, delete in batches)
  // First delete merchants & retailers (leaves of the tree)
  await supabase.from('users').delete().in('role', ['MERCHANT', 'RETAILER']);
  // Next delete area distributors
  await supabase.from('users').delete().in('role', ['DISTRIBUTOR']);
  // Next delete district distributors & super distributors
  await supabase.from('users').delete().in('role', ['DIST_FRANCHISE', 'DISTRICT_DISTRIBUTOR', 'SUPER_DISTRIBUTOR', 'MASTER']);
  // Delete any remaining non-admin
  const { error: uErr } = await supabase.from('users').delete().neq('id', 'ADM001');
  console.log('6. Non-admin users deleted:', uErr ? uErr.message : '✓ All cleared');

  // 7. Ensure ADM001 exists cleanly
  await supabase.from('users').upsert({
    id: 'ADM001',
    name: 'RONAV Super Admin',
    mobile: '9966203053',
    role: 'ADMIN',
    creator_id: null
  });
  console.log('7. ADM001 verified in users table');

  // 8. Reset ADM001 wallet balance to exactly ₹0.00
  await supabase.from('wallets').upsert({
    user_id: 'ADM001',
    available_balance: 0.0,
    total_sales: 0.0,
    received_sales: 0.0,
    pending_balance: 0.0,
    withdrawn_amount: 0.0
  });
  console.log('8. ADM001 wallet reset to ₹0.00');

  // 9. Delete test inquiries/leads (leave only SYS-CONFIG-QR & SYS-USER-STATUSES)
  const { error: inqErr } = await supabase.from('inquiries').delete().not('id', 'like', 'SYS%');
  console.log('9. Test inquiries deleted:', inqErr ? inqErr.message : '✓ Cleared');

  // Reset status map registry to empty
  await supabase.from('inquiries').upsert({
    id: 'SYS-USER-STATUSES',
    name: 'RONAV_USER_STATUS_REGISTRY',
    phone: '9966203053',
    type: 'FRANCHISE',
    category: 'PLATFORM_SETTINGS',
    location: 'SYSTEM',
    status: 'ACTIVE',
    remarks: '{}'
  });

  console.log('\n=== VERIFYING FINAL DATABASE STATE ===');
  const { data: finalUsers } = await supabase.from('users').select('*');
  console.log('Users remaining:', finalUsers?.length, finalUsers);

  const { data: finalWallets } = await supabase.from('wallets').select('*');
  console.log('Wallets remaining:', finalWallets?.length, finalWallets);

  const { data: finalTxns } = await supabase.from('transactions').select('*');
  console.log('Transactions remaining:', finalTxns?.length);

  const { data: finalWds } = await supabase.from('withdrawals').select('*');
  console.log('Withdrawals remaining:', finalWds?.length);

  const { data: finalPos } = await supabase.from('merchant_pos').select('*');
  console.log('POS terminals remaining:', finalPos?.length);

  const { data: finalInqs } = await supabase.from('inquiries').select('*');
  console.log('Inquiries remaining:', finalInqs?.length, finalInqs?.map(i => i.id));

  console.log('\n=== COMPLETE PURGE FINISHED! ===');
}

wipeAllTestData();
