import { NextResponse } from "next/server";

import { requireAuthenticatedAppUser, type AppUserRecord } from "@/lib/app-user";
import { supabasePatchReturning } from "@/lib/supabase-rest";

type DeleteRequestPayload = {
  reason?: unknown;
};

export async function POST(request: Request) {
  try {
    const appUser = await requireAuthenticatedAppUser();
    const body = (await request.json().catch(() => ({}))) as DeleteRequestPayload;
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;
    const params = new URLSearchParams();
    params.set("id", `eq.${appUser.id}`);
    params.set("select", "id,username,email,auth_user_id");
    const rows = await supabasePatchReturning<
      { deletion_requested_at: string; deletion_reason: string | null },
      AppUserRecord
    >("users", params, {
      deletion_requested_at: new Date().toISOString(),
      deletion_reason: reason,
    });

    return NextResponse.json({ ok: true, profile: rows[0] ?? appUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to request account deletion.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
