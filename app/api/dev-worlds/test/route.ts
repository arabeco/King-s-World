import { NextResponse } from "next/server";

import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { supabaseInsertReturning } from "@/lib/supabase-rest";

type TestWorldRow = {
  slug: string;
};

function isDevWorldEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.KW_SMOKE === "1";
}

export async function POST() {
  if (!isDevWorldEnabled()) {
    return NextResponse.json({ error: "Dev world creation is disabled in production." }, { status: 403 });
  }

  try {
    await requireAuthenticatedAppUser();

    const now = new Date();
    const startsAt = new Date(now.getTime() + 10 * 60 * 1000);
    const phase2At = new Date(startsAt.getTime() + 20 * 24 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 120 * 24 * 60 * 60 * 1000);

    const rows = await supabaseInsertReturning<Record<string, unknown>, TestWorldRow>(
      "worlds",
      {
        slug: "teste-local",
        name: "Teste Local",
        status: "open",
        phase: "phase_1",
        day_number: 0,
        registration_opens_at: now.toISOString(),
        starts_at: startsAt.toISOString(),
        phase_2_starts_at: phase2At.toISOString(),
        ends_at: endsAt.toISOString(),
        finalized_at: null,
        player_cap: 50,
        tribe_member_cap: 10,
        map_width: 81,
        map_height: 81,
        map_hex_radius: 40,
        base_move_time_minutes: 45,
        road_move_time_minutes: 15,
        runtime_started: false,
        runtime_real_time_enabled: false,
        runtime_anchor_day: 0,
        runtime_anchor_started_at: null,
        sandbox_enabled: false,
        updated_at: now.toISOString(),
      },
      "slug",
    );

    const slug = rows[0]?.slug ?? "teste-local";
    return NextResponse.json({ ok: true, world: { slug, href: `/world/${slug}/empire` } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create test world." },
      { status: 500 },
    );
  }
}
