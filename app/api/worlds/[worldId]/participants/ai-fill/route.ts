import { NextResponse } from "next/server";

import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { looksLikeUuid, supabaseInsertReturning, supabaseSelect } from "@/lib/supabase-rest";

type WorldRow = {
  id: string;
  slug: string;
  status: "open" | "running" | "finalized";
};

type WorldPlayerRow = {
  id: string;
  world_id: string;
  user_id: string;
};

type UserRow = {
  id: string;
  username: string;
  email: string;
};

const TARGET_PARTICIPANTS = 50;
const AI_HOUSES = [
  "cinza",
  "bruma",
  "ferro",
  "ambar",
  "vidro",
  "corvo",
  "lanca",
  "aurora",
  "sal",
  "cedro",
  "marfim",
  "obsidiana",
  "vento",
  "ponte",
  "farol",
  "muralha",
];

function aiUsername(worldSlug: string, index: number) {
  const house = AI_HOUSES[index % AI_HOUSES.length];
  return `reino_ia_${house}_${String(index + 1).padStart(2, "0")}_${worldSlug.replace(/[^a-z0-9]/gi, "_").slice(0, 18)}`;
}

async function fetchWorld(worldId: string): Promise<WorldRow | null> {
  const params = new URLSearchParams();
  params.set("select", "id,slug,status");
  params.set(looksLikeUuid(worldId) ? "id" : "slug", `eq.${worldId}`);
  params.set("limit", "1");
  const rows = await supabaseSelect<WorldRow>("worlds", params);
  return rows[0] ?? null;
}

async function fetchWorldPlayers(worldId: string): Promise<WorldPlayerRow[]> {
  const params = new URLSearchParams();
  params.set("select", "id,world_id,user_id");
  params.set("world_id", `eq.${worldId}`);
  return supabaseSelect<WorldPlayerRow>("world_players", params);
}

export async function POST(
  _request: Request,
  { params }: { params: { worldId: string } },
) {
  try {
    await requireAuthenticatedAppUser();
    const world = await fetchWorld(params.worldId);
    if (!world) {
      return NextResponse.json({ error: "Mundo nao encontrado." }, { status: 404 });
    }

    if (world.status === "finalized") {
      return NextResponse.json({ error: "Mundo finalizado nao recebe IA." }, { status: 409 });
    }

    const currentPlayers = await fetchWorldPlayers(world.id);
    const missing = Math.max(0, TARGET_PARTICIPANTS - currentPlayers.length);
    if (!missing) {
      return NextResponse.json({
        ok: true,
        target: TARGET_PARTICIPANTS,
        before: currentPlayers.length,
        created: 0,
        after: currentPlayers.length,
      });
    }

    const userPayload = Array.from({ length: missing }, (_, offset) => {
      const index = currentPlayers.length + offset;
      const username = aiUsername(world.slug, index);
      return {
        username,
        email: `${username}@ai.kingsworld.local`,
      };
    });

    const aiUsers = await supabaseInsertReturning<typeof userPayload[number], UserRow>("users", userPayload, "email");
    const playerPayload = aiUsers.map((user, offset) => ({
      world_id: world.id,
      user_id: user.id,
      status: "alive" as const,
      power_score_cached: Math.max(0, 620 - offset * 7),
    }));

    await supabaseInsertReturning<typeof playerPayload[number], WorldPlayerRow>("world_players", playerPayload, "world_id,user_id");
    const afterPlayers = await fetchWorldPlayers(world.id);

    return NextResponse.json({
      ok: true,
      target: TARGET_PARTICIPANTS,
      before: currentPlayers.length,
      created: aiUsers.length,
      after: afterPlayers.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao preencher IA." },
      { status: 500 },
    );
  }
}
