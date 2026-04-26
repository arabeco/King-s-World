import type { User } from "@supabase/supabase-js";

export const DEV_AUTH_COOKIE = "kw_dev_auth";

export function isDevAuthEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.KW_SMOKE === "1";
}

export function buildDevUser(): User {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    app_metadata: { provider: "dev", providers: ["dev"] },
    user_metadata: {
      username: "afonso_dev",
      name: "Afonso Dev",
    },
    aud: "authenticated",
    email: "afonso.dev@kingsworld.local",
    created_at: new Date(0).toISOString(),
  } as User;
}
