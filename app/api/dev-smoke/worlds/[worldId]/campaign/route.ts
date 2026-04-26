import { NextRequest, NextResponse } from "next/server";

import { isDevAuthEnabled } from "@/lib/dev-auth";
import { getAuthenticatedUser } from "@/lib/supabase-server";
import { isSupabaseConfigured, supabasePatchReturning, supabaseSelect } from "@/lib/supabase-rest";
import { getWorldPayload } from "@/lib/world-data";

type DbWorldRow = {
  id: string;
  status: "open" | "running" | "finalized";
  phase: "phase_1" | "phase_2" | "phase_3" | "phase_4" | "closed";
  day_number: number;
  runtime_started: boolean | null;
  runtime_real_time_enabled: boolean | null;
  runtime_anchor_day: number | null;
  runtime_anchor_started_at: string | null;
};

type DbWorldPlayerRow = {
  id: string;
  world_id: string;
  user_id: string;
  status: string;
  power_score_cached: number;
  current_capital_site_id: string | null;
  tribe_id: string | null;
};

type CampaignSnapshot = {
  world: DbWorldRow;
  player: DbWorldPlayerRow;
};

type CampaignStage = "opening" | "mid" | "late" | "final";

const STAGE_PRESETS: Record<
  CampaignStage,
  {
    world: Omit<DbWorldRow, "id">;
    player: Pick<DbWorldPlayerRow, "status" | "power_score_cached">;
  }
> = {
  opening: {
    world: {
      status: "running",
      phase: "phase_1",
      day_number: 0,
      runtime_started: true,
      runtime_real_time_enabled: false,
      runtime_anchor_day: 0,
      runtime_anchor_started_at: null,
    },
    player: {
      status: "alive",
      power_score_cached: 60,
    },
  },
  mid: {
    world: {
      status: "running",
      phase: "phase_2",
      day_number: 38,
      runtime_started: true,
      runtime_real_time_enabled: false,
      runtime_anchor_day: 38,
      runtime_anchor_started_at: null,
    },
    player: {
      status: "alive",
      power_score_cached: 520,
    },
  },
  late: {
    world: {
      status: "running",
      phase: "phase_4",
      day_number: 94,
      runtime_started: true,
      runtime_real_time_enabled: false,
      runtime_anchor_day: 94,
      runtime_anchor_started_at: null,
    },
    player: {
      status: "alive",
      power_score_cached: 1180,
    },
  },
  final: {
    world: {
      status: "finalized",
      phase: "closed",
      day_number: 120,
      runtime_started: false,
      runtime_real_time_enabled: false,
      runtime_anchor_day: 120,
      runtime_anchor_started_at: null,
    },
    player: {
      status: "alive",
      power_score_cached: 1680,
    },
  },
};

async function requireDevSession(request: NextRequest) {
  if (!isDevAuthEnabled()) {
    return NextResponse.json({ error: "Smoke dev route disabled in production." }, { status: 404 });
  }

  if (request.headers.get("x-kw-smoke") === "1") {
    return { id: "kw-smoke" };
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured for smoke route." }, { status: 503 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return user;
}

async function loadSnapshot(worldId: string) {
  const payload = await getWorldPayload(worldId);
  if (!payload.worldPlayerId) {
    throw new Error("World player not found for smoke route.");
  }

  const worldParams = new URLSearchParams();
  worldParams.set(
    "select",
    "id,status,phase,day_number,runtime_started,runtime_real_time_enabled,runtime_anchor_day,runtime_anchor_started_at",
  );
  worldParams.set("id", `eq.${payload.world.id}`);
  worldParams.set("limit", "1");

  const playerParams = new URLSearchParams();
  playerParams.set("select", "id,world_id,user_id,status,power_score_cached,current_capital_site_id,tribe_id");
  playerParams.set("id", `eq.${payload.worldPlayerId}`);
  playerParams.set("limit", "1");

  const [worldRows, playerRows] = await Promise.all([
    supabaseSelect<DbWorldRow>("worlds", worldParams),
    supabaseSelect<DbWorldPlayerRow>("world_players", playerParams),
  ]);

  if (!worldRows[0] || !playerRows[0]) {
    throw new Error("Unable to load smoke snapshot.");
  }

  return {
    snapshot: {
      world: worldRows[0],
      player: playerRows[0],
    } satisfies CampaignSnapshot,
    routeWorldId: payload.world.id,
    worldPlayerId: payload.worldPlayerId,
  };
}

export async function GET(_: NextRequest, { params }: { params: { worldId: string } }) {
  const auth = await requireDevSession(_);
  if (auth instanceof NextResponse) return auth;

  try {
    const { snapshot, routeWorldId, worldPlayerId } = await loadSnapshot(params.worldId);
    return NextResponse.json({ ok: true, snapshot, routeWorldId, worldPlayerId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load smoke snapshot." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: { worldId: string } }) {
  const auth = await requireDevSession(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as
      | { action: "stage"; stage: CampaignStage }
      | { action: "restore"; snapshot: CampaignSnapshot };

    const { routeWorldId, worldPlayerId } = await loadSnapshot(params.worldId);

    if (body.action === "stage") {
      const preset = STAGE_PRESETS[body.stage];
      if (!preset) {
        return NextResponse.json({ error: "Unknown smoke stage." }, { status: 400 });
      }

      const worldParams = new URLSearchParams();
      worldParams.set("id", `eq.${routeWorldId}`);
      const playerParams = new URLSearchParams();
      playerParams.set("id", `eq.${worldPlayerId}`);

      await Promise.all([
        supabasePatchReturning("worlds", worldParams, preset.world),
        supabasePatchReturning("world_players", playerParams, preset.player),
      ]);

      return NextResponse.json({ ok: true, stage: body.stage });
    }

    if (body.action === "restore") {
      const worldParams = new URLSearchParams();
      worldParams.set("id", `eq.${routeWorldId}`);
      const playerParams = new URLSearchParams();
      playerParams.set("id", `eq.${worldPlayerId}`);

      await Promise.all([
        supabasePatchReturning("worlds", worldParams, {
          status: body.snapshot.world.status,
          phase: body.snapshot.world.phase,
          day_number: body.snapshot.world.day_number,
          runtime_started: body.snapshot.world.runtime_started,
          runtime_real_time_enabled: body.snapshot.world.runtime_real_time_enabled,
          runtime_anchor_day: body.snapshot.world.runtime_anchor_day,
          runtime_anchor_started_at: body.snapshot.world.runtime_anchor_started_at,
        }),
        supabasePatchReturning("world_players", playerParams, {
          status: body.snapshot.player.status,
          power_score_cached: body.snapshot.player.power_score_cached,
          current_capital_site_id: body.snapshot.player.current_capital_site_id,
          tribe_id: body.snapshot.player.tribe_id,
        }),
      ]);

      return NextResponse.json({ ok: true, restored: true });
    }

    return NextResponse.json({ error: "Unsupported smoke action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update smoke campaign." },
      { status: 500 },
    );
  }
}
