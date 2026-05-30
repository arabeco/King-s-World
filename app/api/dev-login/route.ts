import { NextResponse } from "next/server";

import { DEV_AUTH_COOKIE, isDevAuthEnabled, normalizeDevAuthKey } from "@/lib/dev-auth";

export async function POST(request: Request) {
  if (!isDevAuthEnabled()) {
    return NextResponse.json({ error: "Dev login is disabled in production." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const userKey = normalizeDevAuthKey((body as { user?: unknown; key?: unknown }).user ?? (body as { key?: unknown }).key ?? "1");
  const response = NextResponse.json({ ok: true, userKey });
  response.cookies.set(DEV_AUTH_COOKIE, userKey, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEV_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
