import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, hasPublicSupabaseEnv } from "@/lib/supabase-env";

export { hasPublicSupabaseEnv };

let client: SupabaseClient | null = null;

/** Inside the app the session lives in the WebView storage, not in site cookies. */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (client) return client;
  client = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      storageKey: "kw-auth",
      storage: window.localStorage,
    },
  });
  return client;
}
