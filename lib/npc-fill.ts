import "server-only";

import { supabaseInsertReturning, supabaseSelect } from "@/lib/supabase-rest";

const NPC_HOUSES = [
  "cinza", "bruma", "ferro", "ambar", "vidro", "corvo", "lanca", "aurora",
  "sal", "cedro", "marfim", "obsidiana", "vento", "ponte", "farol", "muralha",
];

const NPC_PROFILES = ["metropole", "posto_avancado", "bastiao", "celeiro", "balanced"];

type WorldPlayerRow = { id: string; world_id: string; user_id: string };
type UserRow = { id: string; username: string; email: string };

function npcUsername(worldSlug: string, index: number): string {
  const house = NPC_HOUSES[index % NPC_HOUSES.length];
  const safeSlug = worldSlug.replace(/[^a-z0-9]/gi, "_").slice(0, 18);
  return `reino_ia_${house}_${String(index + 1).padStart(2, "0")}_${safeSlug}`;
}

function pickProfile(index: number): string {
  return NPC_PROFILES[index % NPC_PROFILES.length];
}

/**
 * Garante que o mundo tem pelo menos `target` jogadores preenchendo com NPCs.
 * Idempotente: só cria a diferença. Seguro para chamar a cada entrada.
 */
export async function ensureWorldFilled(
  worldId: string,
  worldSlug: string,
  target = 25,
): Promise<{ before: number; created: number; after: number }> {
  const playerParams = new URLSearchParams();
  playerParams.set("select", "id,world_id,user_id");
  playerParams.set("world_id", `eq.${worldId}`);
  const currentPlayers = await supabaseSelect<WorldPlayerRow>("world_players", playerParams);

  const missing = Math.max(0, target - currentPlayers.length);
  if (missing === 0) {
    return { before: currentPlayers.length, created: 0, after: currentPlayers.length };
  }

  const userPayload = Array.from({ length: missing }, (_, offset) => {
    const index = currentPlayers.length + offset;
    const username = npcUsername(worldSlug, index);
    return { username, email: `${username}@ai.kingsworld.local` };
  });

  const npcUsers = await supabaseInsertReturning<typeof userPayload[number], UserRow>(
    "users",
    userPayload,
    "email",
  );

  const playerPayload = npcUsers.map((user, offset) => ({
    world_id: worldId,
    user_id: user.id,
    status: "alive" as const,
    is_ai: true,
    npc_profile: pickProfile(currentPlayers.length + offset),
    power_score_cached: Math.max(0, 620 - offset * 7),
  }));

  await supabaseInsertReturning<typeof playerPayload[number], WorldPlayerRow>(
    "world_players",
    playerPayload,
    "world_id,user_id",
  );

  const afterParams = new URLSearchParams();
  afterParams.set("select", "id");
  afterParams.set("world_id", `eq.${worldId}`);
  const afterPlayers = await supabaseSelect<{ id: string }>("world_players", afterParams);

  return { before: currentPlayers.length, created: npcUsers.length, after: afterPlayers.length };
}
