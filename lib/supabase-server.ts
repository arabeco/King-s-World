import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type User } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

import { buildDevUser, DEV_AUTH_COOKIE, isDevAuthEnabled } from "@/lib/dev-auth";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, hasPublicSupabaseEnv } from "@/lib/supabase-env";

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(nextCookies) {
        try {
          for (const cookie of nextCookies) {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          }
        } catch {
          // Server Components may be read-only. Middleware keeps auth cookies refreshed.
        }
      },
    },
  });
}

/** Token sent by the installed app (Authorization: Bearer <access token>). */
function bearerToken(): string | null {
  const value = headers().get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(value.trim());
  return match ? match[1] : null;
}

export async function getAuthenticatedUser(): Promise<User | null> {
  const token = bearerToken();
  if (token) {
    if (token.startsWith("dev:")) {
      return isDevAuthEnabled() ? buildDevUser(token.slice(4)) : null;
    }
    if (!hasPublicSupabaseEnv()) {
      return null;
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    return error ? null : data.user ?? null;
  }

  const devAuthCookie = cookies().get(DEV_AUTH_COOKIE)?.value;
  if (isDevAuthEnabled() && devAuthCookie) {
    return buildDevUser(devAuthCookie);
  }

  if (!hasPublicSupabaseEnv()) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return null;
  }
  return data.user ?? null;
}
