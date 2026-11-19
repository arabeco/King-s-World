import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

import { appRouter, getLocation } from "./router";

/** Server that validates and saves the game (the same API the site uses). */
export const API_BASE = (process.env.KW_APP_API_URL ?? "").replace(/\/$/, "");
const DEV_AUTH_KEY = process.env.KW_APP_DEV_AUTH ?? "";

async function accessToken(): Promise<string | null> {
  if (DEV_AUTH_KEY) return `dev:${DEV_AUTH_KEY}`;
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  return data.session?.access_token ?? null;
}

export async function hasSession(): Promise<boolean> {
  return Boolean(await accessToken());
}

function isAuthScreen(pathname: string) {
  return pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/forgot-password");
}

/**
 * Screens call fetch("/api/...") exactly like on the site. Inside the app those calls go
 * to the game server with the player's token instead of site cookies.
 */
export function installApiBridge() {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith("/api/")) return nativeFetch(input, init);
    const request = typeof input === "object" && !(input instanceof URL) ? input : null;
    const headers = new Headers(init?.headers ?? request?.headers);
    const token = await accessToken();
    if (token) headers.set("authorization", `Bearer ${token}`);
    const response = await nativeFetch(API_BASE + url, {
      method: init?.method ?? request?.method,
      body: init?.body ?? (request ? await request.clone().arrayBuffer() : undefined),
      signal: init?.signal ?? request?.signal,
      cache: init?.cache,
      headers,
      credentials: "omit",
    });
    if (response.status === 401 && !url.startsWith("/api/dev-login")) {
      const { pathname, search } = getLocation();
      if (!isAuthScreen(pathname)) appRouter.replace(`/login?next=${encodeURIComponent(pathname + search)}`);
    }
    return response;
  };
}
