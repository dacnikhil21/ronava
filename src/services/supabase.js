import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 'https://mqsbejpakkolowfkkaas.supabase.co';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xc2JlanBha2tvbG93ZmtrYWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NTc4OTMsImV4cCI6MjEwNDMzMzg5M30.SK2tPZY5Uk2lH2yVHjlEY8d4VhtOWpQLRR_spWMXtoc';

// Client-side Supabase instance
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : null;

/**
 * Subscribe to real-time wallet changes for a merchant
 */
export function subscribeToWallet(userId, onUpdate) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`wallet-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` },
      (payload) => onUpdate(payload.new)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to real-time transactions for a merchant
 */
export function subscribeToTransactions(merchantId, onInsert) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`transactions-${merchantId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'transactions', filter: `merchant_id=eq.${merchantId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to all ecosystem changes (transactions, withdrawals, wallets, inquiries) for Admin
 */
export function subscribeToAdminFeed(onUpdate) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('admin-live-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => onUpdate('transactions'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, () => onUpdate('withdrawals'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, () => onUpdate('wallets'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, () => onUpdate('inquiries'))
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export default supabase;
