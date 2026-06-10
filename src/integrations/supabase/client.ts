import { createClient } from '@supabase/supabase-js';
import { appEnv, requireEnv } from '@/lib/env';

const supabaseUrl = requireEnv(appEnv.supabaseUrl, 'VITE_SUPABASE_URL');
const supabaseKey = requireEnv(appEnv.supabaseAnonKey, 'VITE_SUPABASE_ANON_KEY');

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
