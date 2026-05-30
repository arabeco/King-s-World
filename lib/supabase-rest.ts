import "server-only";

import { createClient } from "@supabase/supabase-js";

import { SUPABASE_SERVER_KEY, SUPABASE_URL } from "@/lib/supabase-env";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVER_KEY);
}

export function isSupabaseConnectivityError(error: unknown): boolean {
  const message = error instanceof Error
    ? `${error.name}: ${error.message}${error.cause ? ` ${String(error.cause)}` : ""}`
    : String(error);

  return /fetch failed|getaddrinfo|enotfound|eai_again|dns|network/i.test(message);
}

export function shouldUseLocalSupabaseFallback(error: unknown): boolean {
  return process.env.NODE_ENV !== "production" && isSupabaseConnectivityError(error);
}

function requireSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVER_KEY) {
    throw new Error(
      "Supabase environment is not configured. Set NEXT_PUBLIC_SUPABASE_URL and one of: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return {
    url: SUPABASE_URL.replace(/\/$/, ""),
    key: SUPABASE_SERVER_KEY,
  };
}

function createServerClient() {
  const { url, key } = requireSupabaseEnv();
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function parseInFilter(value: string): string[] {
  const raw = value.replace(/^in\.\(/, "").replace(/\)$/, "");
  if (!raw.trim()) return [];
  return raw.split(",").map((entry) => entry.trim().replace(/^"|"$/g, ""));
}

function applyParams(query: any, params: URLSearchParams) {
  let next = query;
  for (const [key, value] of params.entries()) {
    if (key === "select") continue;
    if (key === "limit") {
      next = next.limit(Number(value));
      continue;
    }
    if (value.startsWith("eq.")) {
      next = next.eq(key, value.slice(3));
      continue;
    }
    if (value.startsWith("in.(")) {
      next = next.in(key, parseInFilter(value));
    }
  }
  return next;
}

export async function supabaseSelect<T>(table: string, params: URLSearchParams, init?: RequestInit): Promise<T[]> {
  const signal = init?.signal;
  let query = createServerClient().from(table).select(params.get("select") ?? "*");
  query = applyParams(query, params);
  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Supabase select failed for ${table}: ${error.message}`);
  }
  return (data ?? []) as T[];
}

export async function supabaseUpsert<T>(table: string, payload: T | T[], onConflict?: string): Promise<void> {
  const { error } = await createServerClient()
    .from(table)
    .upsert(payload as any, onConflict ? { onConflict } : undefined);
  if (error) {
    throw new Error(`Supabase upsert failed for ${table}: ${error.message}`);
  }
}

export async function supabaseInsertReturning<TIn, TOut>(table: string, payload: TIn | TIn[], onConflict?: string): Promise<TOut[]> {
  const { data, error } = await createServerClient()
    .from(table)
    .upsert(payload as any, onConflict ? { onConflict } : undefined)
    .select();
  if (error) {
    throw new Error(`Supabase insert failed for ${table}: ${error.message}`);
  }
  return (data ?? []) as TOut[];
}

export async function supabasePatchReturning<TIn, TOut>(table: string, params: URLSearchParams, payload: TIn): Promise<TOut[]> {
  let query = createServerClient().from(table).update(payload as any).select();
  query = applyParams(query, params);
  const { data, error } = await query;
  if (error) {
    throw new Error(`Supabase patch failed for ${table}: ${error.message}`);
  }
  return (data ?? []) as TOut[];
}

export async function supabaseDelete(table: string, params: URLSearchParams): Promise<void> {
  let query = createServerClient().from(table).delete();
  query = applyParams(query, params);
  const { error } = await query;
  if (error) {
    throw new Error(`Supabase delete failed for ${table}: ${error.message}`);
  }
}

export function inFilter(values: string[]): string {
  return `in.(${values.map((value) => `"${value}"`).join(",")})`;
}

export function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function supabaseRpc<TOut>(fn: string, params: Record<string, unknown>): Promise<TOut> {
  const { data, error } = await createServerClient().rpc(fn, params);
  if (error) {
    throw new Error(`Supabase RPC ${fn} failed: ${error.message}`);
  }
  return data as TOut;
}
