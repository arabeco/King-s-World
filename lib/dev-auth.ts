import type { User } from "@supabase/supabase-js";

export const DEV_AUTH_COOKIE = "kw_dev_auth";

export function isDevAuthEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.KW_SMOKE === "1";
}

export function normalizeDevAuthKey(value: unknown): string {
  const key = String(value ?? "1").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
  return key || "1";
}

function devUserIdFromKey(key: string): string {
  if (key === "1") {
    return "00000000-0000-4000-8000-000000000001";
  }

  let hash = 0;
  for (const char of key) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const suffix = Math.max(2, hash).toString(16).padStart(12, "0").slice(-12);
  return `00000000-0000-4000-8000-${suffix}`;
}

export function buildDevUser(rawKey: unknown = "1"): User {
  const key = normalizeDevAuthKey(rawKey);
  const id = devUserIdFromKey(key);
  const username = key === "1" ? "afonso_dev" : `smoke_${key}`;

  return {
    id,
    app_metadata: { provider: "dev", providers: ["dev"] },
    user_metadata: {
      username,
      name: key === "1" ? "Afonso Dev" : `Smoke ${key.toUpperCase()}`,
    },
    aud: "authenticated",
    email: key === "1" ? "afonso.dev@kingsworld.local" : `${username}@kingsworld.local`,
    created_at: new Date(0).toISOString(),
  } as User;
}
