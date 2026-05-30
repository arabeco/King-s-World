import "server-only";

import { buildDevUser, isDevAuthEnabled } from "@/lib/dev-auth";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { shouldUseLocalSupabaseFallback, supabaseInsertReturning, supabaseSelect } from "@/lib/supabase-rest";

export type AppUserRecord = {
  id: string;
  username: string;
  email?: string;
  auth_user_id?: string | null;
};

function normalizeUsername(seed: string): string {
  const cleaned = seed.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned.length >= 3 ? cleaned.slice(0, 18) : `player_${cleaned || "coroa"}`;
}

function localAppUserFromAuth(authUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): AppUserRecord {
  const rawUsername =
    typeof authUser.user_metadata?.username === "string"
      ? authUser.user_metadata.username
      : typeof authUser.user_metadata?.name === "string"
        ? authUser.user_metadata.name
        : authUser.email?.split("@")[0] ?? "player";

  return {
    id: authUser.id,
    username: normalizeUsername(rawUsername),
    email: authUser.email ?? undefined,
    auth_user_id: authUser.id,
  };
}

export async function fetchOrCreateAppUser(authUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): Promise<AppUserRecord> {
  const byAuthParams = new URLSearchParams();
  byAuthParams.set("select", "id,username,email,auth_user_id");
  byAuthParams.set("auth_user_id", `eq.${authUser.id}`);
  const existingByAuth = await supabaseSelect<AppUserRecord>("users", byAuthParams);
  if (existingByAuth[0]) {
    return existingByAuth[0];
  }

  const email = authUser.email ?? `${authUser.id.slice(0, 8)}@users.kingsworld.local`;
  const byEmailParams = new URLSearchParams();
  byEmailParams.set("select", "id,username,email,auth_user_id");
  byEmailParams.set("email", `eq.${email}`);
  const existingByEmail = await supabaseSelect<AppUserRecord>("users", byEmailParams);
  if (existingByEmail[0]) {
    if (!existingByEmail[0].auth_user_id) {
      const patched = await supabaseInsertReturning<{ id: string; auth_user_id: string }, AppUserRecord>(
        "users",
        { id: existingByEmail[0].id, auth_user_id: authUser.id },
        "id",
      );
      return patched[0] ?? existingByEmail[0];
    }

    return existingByEmail[0];
  }

  const rawUsername =
    typeof authUser.user_metadata?.username === "string"
      ? authUser.user_metadata.username
      : typeof authUser.user_metadata?.name === "string"
        ? authUser.user_metadata.name
        : email.split("@")[0] ?? "player";
  const username = `${normalizeUsername(rawUsername)}_${authUser.id.slice(0, 6)}`;
  const created = await supabaseInsertReturning<
    { auth_user_id: string; username: string; email: string },
    AppUserRecord
  >("users", {
    auth_user_id: authUser.id,
    username,
    email,
  });

  if (!created[0]) {
    throw new Error("Failed to create app user profile in Supabase.");
  }

  return created[0];
}

export async function requireAuthenticatedAppUser(): Promise<AppUserRecord> {
  const authUser = await getAuthenticatedUser() ?? (isDevAuthEnabled() ? buildDevUser("1") : null);
  if (!authUser) {
    throw new Error("Unauthorized");
  }

  try {
    return await fetchOrCreateAppUser(authUser);
  } catch (error) {
    if (shouldUseLocalSupabaseFallback(error)) {
      return localAppUserFromAuth(authUser);
    }
    throw error;
  }
}
