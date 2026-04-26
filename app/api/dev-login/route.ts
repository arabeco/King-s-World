import { NextResponse } from "next/server";

import { DEV_AUTH_COOKIE, isDevAuthEnabled } from "@/lib/dev-auth";

export async function POST() {
  if (!isDevAuthEnabled()) {
    return NextResponse.json({ error: "Dev login is disabled in production." }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEV_AUTH_COOKIE, "1", {
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
