import { NextResponse } from "next/server";

import { requireAuthenticatedAppUser, type AppUserRecord } from "@/lib/app-user";
import { supabasePatchReturning } from "@/lib/supabase-rest";

type ProfilePatchPayload = {
  username?: unknown;
};

function normalizeUsername(input: unknown): string {
  const raw = String(input ?? "").trim();
  if (raw.length < 3) {
    throw new Error("O nick precisa ter pelo menos 3 caracteres.");
  }
  if (raw.length > 24) {
    throw new Error("O nick pode ter no maximo 24 caracteres.");
  }
  if (!/^[a-zA-Z0-9_]+$/.test(raw)) {
    throw new Error("Use apenas letras, numeros e underline no nick.");
  }
  return raw;
}

export async function GET() {
  try {
    const appUser = await requireAuthenticatedAppUser();
    return NextResponse.json({ profile: appUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load profile.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const appUser = await requireAuthenticatedAppUser();
    const body = (await request.json()) as ProfilePatchPayload;
    const username = normalizeUsername(body.username);
    const params = new URLSearchParams();
    params.set("id", `eq.${appUser.id}`);
    params.set("select", "id,username,email,auth_user_id");
    const rows = await supabasePatchReturning<{ username: string }, AppUserRecord>("users", params, { username });
    return NextResponse.json({ profile: rows[0] ?? { ...appUser, username } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile.";
    const duplicate = /duplicate key|unique/i.test(message);
    return NextResponse.json({ error: duplicate ? "Esse nick ja esta em uso." : message }, { status: message === "Unauthorized" ? 401 : duplicate ? 409 : 400 });
  }
}
