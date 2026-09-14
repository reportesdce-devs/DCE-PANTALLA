import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://zruztkzddsyskzqfiicv.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_P-nTwV0PMH8pNg-8jLchIg_-9NpODVF";

export const isSupabaseConfigured =
  SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_") ||
  SUPABASE_PUBLISHABLE_KEY.startsWith("eyJ");

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
