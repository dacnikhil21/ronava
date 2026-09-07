import { db } from './db.js';
import { supabaseAdmin, checkSupabaseConnection } from './supabase.js';

async function main() {
  console.log('🚀 Checking Supabase connection and tables...');
  const isReady = await checkSupabaseConnection();
  if (!isReady) {
    console.log(`
⚠️ Notice: Supabase tables are not yet created in the database.
To create them:
1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/mqsbejpakkolowfkkaas
2. Navigate to "SQL Editor" -> "New Query"
3. Copy the entire contents of "supabase/schema.sql" and click "Run"
4. Once run, rerun this script with: node server/sync-to-supabase.js
`);
    return;
  }

  console.log('📦 Supabase tables detected! Starting data sync from local database...');

  try {
    // 1. Sync Users
    const users = db.prepare(`SELECT * FROM users`).all();
    if (users.length > 0) {
      const { error } = await supabaseAdmin.from('users').upsert(users);
      if (error) console.error('Error syncing users:', error.message);
      else console.log(`✓ Synced ${users.length} users to Supabase.`);
    }

    // 2. Sync Merchant POS
    const pos = db.prepare(`SELECT * FROM merchant_pos`).all();
    if (pos.length > 0) {
      const { error } = await supabaseAdmin.from('merchant_pos').upsert(pos);
      if (error) console.error('Error syncing merchant_pos:', error.message);
      else console.log(`✓ Synced ${pos.length} merchant POS machines to Supabase.`);
    }

    // 3. Sync Wallets
    const wallets = db.prepare(`SELECT * FROM wallets`).all();
    if (wallets.length > 0) {
      const { error } = await supabaseAdmin.from('wallets').upsert(wallets);
      if (error) console.error('Error syncing wallets:', error.message);
      else console.log(`✓ Synced ${wallets.length} wallets to Supabase.`);
    }

    // 4. Sync Transactions
    const txns = db.prepare(`SELECT * FROM transactions`).all();
    if (txns.length > 0) {
      const { error } = await supabaseAdmin.from('transactions').upsert(txns);
      if (error) console.error('Error syncing transactions:', error.message);
      else console.log(`✓ Synced ${txns.length} transactions to Supabase.`);
    }

    // 5. Sync Withdrawals
    const withdrawals = db.prepare(`SELECT * FROM withdrawals`).all();
    if (withdrawals.length > 0) {
      const { error } = await supabaseAdmin.from('withdrawals').upsert(withdrawals);
      if (error) console.error('Error syncing withdrawals:', error.message);
      else console.log(`✓ Synced ${withdrawals.length} withdrawals to Supabase.`);
    }

    // 6. Sync Beneficiaries
    const beneficiaries = db.prepare(`SELECT * FROM beneficiaries`).all();
    if (beneficiaries.length > 0) {
      const { error } = await supabaseAdmin.from('beneficiaries').upsert(beneficiaries);
      if (error) console.error('Error syncing beneficiaries:', error.message);
      else console.log(`✓ Synced ${beneficiaries.length} beneficiaries to Supabase.`);
    }

    // 7. Sync Inquiries
    const inquiries = db.prepare(`SELECT * FROM inquiries`).all();
    if (inquiries.length > 0) {
      const { error } = await supabaseAdmin.from('inquiries').upsert(inquiries);
      if (error) console.error('Error syncing inquiries:', error.message);
      else console.log(`✓ Synced ${inquiries.length} inquiries to Supabase.`);
    }

    console.log('🎉 Supabase synchronization completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  }
}

main();
