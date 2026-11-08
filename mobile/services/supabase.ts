import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '@/constants/config';
import { ExpoSecureStoreAdapter } from '@/services/supabaseStorage';

/**
 * Mobile Supabase Client with persistent authentication state via Expo SecureStore.
 */
export const supabase = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

