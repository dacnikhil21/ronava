import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://mqsbejpakkolowfkkaas.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

// Elevated server-side Supabase client (bypasses RLS)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

let isSupabaseReady = false;

// Check if tables are present in Supabase
export async function checkSupabaseConnection() {
  try {
    const { data, error } = await supabaseAdmin.from('users').select('id').limit(1);
    if (!error) {
      isSupabaseReady = true;
      console.log('✅ Supabase backend tables detected and active.');
      return true;
    }
    isSupabaseReady = false;
    console.log('ℹ️ Supabase connected. Remote tables pending migration (falling back seamlessly to local database).');
    return false;
  } catch (err) {
    isSupabaseReady = false;
    console.warn('⚠️ Supabase connection check error:', err.message);
    return false;
  }
}

export function isSupabaseActive() {
  return isSupabaseReady;
}

// Background sync helper: syncs a record to Supabase if available
export async function syncToSupabase(table, record) {
  if (!isSupabaseReady) return null;
  try {
    const { data, error } = await supabaseAdmin.from(table).upsert(record);
    if (error) {
      console.warn(`[Supabase Sync Error] ${table}:`, error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn(`[Supabase Sync Exception] ${table}:`, err.message);
    return null;
  }
}
