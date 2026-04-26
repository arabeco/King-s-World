import { NextResponse } from "next/server";

import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { supabaseInsertReturning, supabaseSelect } from "@/lib/supabase-rest";

type WorldRow = {
  slug: string;
  status: "open" | "running" | "finalized";
  day_number: number;
};

type SeasonMode = "classic" | "express";

function normalizeMode(value: unknown): SeasonMode {
  return value === "express" ? "express" : "classic";
}

function alphaSlug(mode: SeasonMode) {
  return mode === "express" ? "alpha-expresso" : "alpha-classico";
}

function buildAlphaWorldPayload(mode: SeasonMode, includeModeColumns: boolean) {
  const now = new Date();
  const startsAt = new Date(now.getTime() + 10 * 60 * 1000);
  const durationDays = mode === "express" ? 30 : 120;
  const speedMultiplier = mode === "express" ? 4 : 1;
  const phase2At = new Date(startsAt.getTime() + Math.ceil(durationDays / 6) * 24 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

  const payload: Record<string, unknown> = {
    slug: alphaSlug(mode),
    name: mode === "express" ? "Alpha Expresso" : "Alpha Classico",
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
    base_move_time_minutes: Math.max(1, Math.round(45 / speedMultiplier)),
    road_move_time_minutes: Math.max(1, Math.round(15 / speedMultiplier)),
    runtime_started: false,
    runtime_real_time_enabled: false,
    runtime_anchor_day: 0,
    runtime_anchor_started_at: null,
    sandbox_enabled: false,
    updated_at: now.toISOString(),
  };

  if (includeModeColumns) {
    payload.season_mode = mode;
    payload.speed_multiplier = speedMultiplier;
  }

  return payload;
}

async function findAlphaWorld(mode: SeasonMode) {
  const params = new URLSearchParams();
  params.set("select", "slug,status,day_number");
  params.set("slug", `eq.${alphaSlug(mode)}`);
  params.set("limit", "1");
  const rows = await supabaseSelect<WorldRow>("worlds", params);
  return rows[0] ?? null;
}

async function insertAlphaWorld(mode: SeasonMode) {
  try {
    return await supabaseInsertReturning<Record<string, unknown>, WorldRow>(
      "worlds",
      buildAlphaWorldPayload(mode, true),
      "slug",
    );
  } catch (error) {
    // Until the season-mode SQL is run, keep the world creation button usable.
    return supabaseInsertReturning<Record<string, unknown>, WorldRow>(
      "worlds",
      buildAlphaWorldPayload(mode, false),
      "slug",
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAuthenticatedAppUser();
    const body = await request.json().catch(() => ({}));
    const mode = normalizeMode((body as { mode?: unknown }).mode);
    const durationDays = mode === "express" ? 30 : 120;

    const existing = await findAlphaWorld(mode);
    if (existing && existing.status !== "finalized" && existing.day_number < durationDays) {
      return NextResponse.json({
        ok: true,
        reused: true,
        world: { slug: existing.slug, href: `/world/${existing.slug}/empire` },
      });
    }

    const rows = await insertAlphaWorld(mode);
    const slug = rows[0]?.slug ?? alphaSlug(mode);

    return NextResponse.json({
      ok: true,
      reused: false,
      mode,
      world: { slug, href: `/world/${slug}/empire` },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create alpha world." },
      { status: 500 },
    );
  }
}
