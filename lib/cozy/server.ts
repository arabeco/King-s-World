import {incomingPlayerAttacks} from './player-combat';
import "server-only";
import {EQUIPMENT_EFFECTS} from "./equipment";
import {isCrestId} from "./heraldry";
import {bindWorldBalance} from '@/lib/cozy/progression';
import {settleWorld} from '@/lib/cozy/settlement';
import {sanctuaryAt} from '@/lib/cozy/landmarks';

import { createHash } from "node:crypto";
import type { AppUserRecord } from "@/lib/app-user";
import {
  inFilter,
  looksLikeUuid,
  supabaseRpc,
  supabaseSelect,
} from "@/lib/supabase-rest";
import {
  applyCozyAction,
  createCozyShared,
  createCozyState,
  getCozyComputed,
  getCozyTiles,
} from "@/lib/cozy/engine";
import type {
  CozyAccount,
  CozyAction,
  CozyPayload,
  CozyShared,
  CozyState,
  CozyWorld,
} from "@/lib/cozy/types";

type WorldRow = {
  id: string;
  slug: string;
  name: string;
  rules_version: number;
  combat_mode?:"cozy"|"competitive";
  influence_version: 1|2;
  status: CozyWorld["status"];
  season_mode: string;
  speed_multiplier?: number;
  economy_version?: number;
  starts_at: string | null;
  runtime_anchor_started_at: string | null;
  created_by_user_id: string | null;
};
type MemberRow = {
  id: string;
  user_id: string;
  status: string;
  is_ai?: boolean;
  joined_at: string;
};
type SavedPlayer = {
  influence: number;
  world_player_id: string;
  user_id: string;
  revision: number;
  state_json: CozyState;
};
type SavedShared = { revision: number; state_json: CozyShared };
type CommitPlayer = {
  playerId: string;
  expectedRevision: number;
  state: CozyState;
  influence: number;
};
type AccountData = {
  account: CozyAccount;
  history: {
    worldId: string;
    worldName: string;
    rank: number | null;
    score: number | null;
    xp: number;
    seal: boolean;
    trophy: boolean;
    finished: boolean;
    awardedAt: string;
  }[];
  hallOfFame: {
    worldId: string;
    worldName: string;
    playerName: string;
    score: number;
    awardedAt: string;
  }[];
};
export type CozyServerPayload = CozyPayload & { canStart: boolean };

export class CozyHttpError extends Error {
  constructor(
    message: string,
    public status = 422,
    public code = "INVALID_ACTION",
  ) {
    super(message);
    this.name = "CozyHttpError";
  }
}

function query(
  select: string,
  filters: Record<string, string> = {},
): URLSearchParams {
  return new URLSearchParams({ select, ...filters });
}

function missingRulesColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /rules_version/i.test(message) &&
    /does not exist|schema cache|could not find.*column/i.test(message)
  );
}

async function fetchWorld(worldRouteId: string): Promise<WorldRow> {
  if (
    typeof worldRouteId !== "string" ||
    worldRouteId.length > 100 ||
    !/^[a-zA-Z0-9_-]+$/.test(worldRouteId)
  ) {
    throw new CozyHttpError("Mundo inválido.", 404, "WORLD_NOT_FOUND");
  }
  const rows = await supabaseSelect<WorldRow>(
    "worlds",
    query(
      "*",
      {
        [looksLikeUuid(worldRouteId) ? "id" : "slug"]: `eq.${worldRouteId}`,
        limit: "1",
      },
    ),
  );
  if (!rows[0])
    throw new CozyHttpError("Mundo não encontrado.", 404, "WORLD_NOT_FOUND");
  return rows[0];
}

function toWorld(row: WorldRow): CozyWorld {
  const start = Date.parse(
    row.runtime_anchor_started_at ?? row.starts_at ?? "",
  );
  return {
    id: row.id,
    combatMode:row.combat_mode==='competitive'?'competitive':'cozy',
    name: row.name,
    mode: row.season_mode === "express" ? "express" : "classic",
    speedMultiplier: row.season_mode==='express'?(row.economy_version===2?1:row.economy_version===3?4:row.speed_multiplier===2?2:4):1,
    ...([2,3].includes(row.economy_version)?{economyVersion:row.economy_version as 2|3}:{}),
    status: row.status,
    startsAt: row.status === "open" || !Number.isFinite(start) ? null : start,
    influenceVersion:row.influence_version,
  };
}

export async function isCozyWorld(worldRouteId: string): Promise<boolean> {
  try {
    return (await fetchWorld(worldRouteId)).rules_version === 2;
  } catch (error) {
    // Only a known pre-migration schema gets the legacy path. Connectivity and
    // authorization failures must never silently select a different ruleset.
    if (missingRulesColumn(error)) return false;
    throw error;
  }
}

export async function readCozyWorld(worldRouteId: string): Promise<CozyWorld> {
  const row = await fetchWorld(worldRouteId);
  if (row.rules_version !== 2)
    throw new CozyHttpError(
      "Este mundo usa as regras anteriores.",
      409,
      "LEGACY_WORLD",
    );
  return toWorld(row);
}

export async function ensureCozyMembership(
  worldRouteId: string,
  user: AppUserRecord,
  joinCode?: string,
): Promise<{ worldId: string; playerId: string }> {
  const row = await fetchWorld(worldRouteId);
  if (row.rules_version !== 2)
    throw new CozyHttpError(
      "Este mundo usa as regras anteriores.",
      409,
      "LEGACY_WORLD",
    );
  const playerId = await supabaseRpc<string>("kw_cozy_join", {
    p_world_id: row.id,
    p_user_id: user.id,
    p_join_code: joinCode ?? null,
  });
  return { worldId: row.id, playerId };
}

/** Reserve the engine's actual starting cell for an explicitly provisioned NPC slot. */
export async function reserveCozyLateSlot(worldRouteId: string, playerId: string): Promise<void> {
  const row = await fetchWorld(worldRouteId);
  if (row.rules_version !== 2 || row.status !== "open")
    throw new CozyHttpError("Este mundo não aceita novas reservas.", 409, "WORLD_CLOSED");
  const city = createCozyState(toWorld(row), playerId, "Reino disponível", Date.now()).cities[0];
  if (sanctuaryAt(city) || (city.q === 0 && city.r === 0))
    throw new CozyHttpError("A posição da vaga está ocupada por uma torre.", 409, "SLOT_OCCUPIED");
  await supabaseRpc("kw_cozy_reserve_late_slot", {
    p_world_id: row.id,
    p_player_id: playerId,
    p_q: city.q,
    p_r: city.r,
  });
}

export async function startCozyWorld(
  worldRouteId: string,
  user: AppUserRecord,
): Promise<void> {
  const row = await fetchWorld(worldRouteId);
  if (row.rules_version !== 2)
    throw new CozyHttpError(
      "Este mundo usa as regras anteriores.",
      409,
      "LEGACY_WORLD",
    );
  if (row.created_by_user_id !== user.id)
    throw new CozyHttpError(
      "Só quem criou o mundo pode iniciar a temporada.",
      403,
      "OWNER_REQUIRED",
    );
  await supabaseRpc("kw_cozy_start", {
    p_world_id: row.id,
    p_user_id: user.id,
  });
}

export async function getCozyAccount(
  user: AppUserRecord,
): Promise<AccountData> {
  return supabaseRpc<AccountData>("kw_cozy_account", { p_user_id: user.id });
}

function sameState(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}


function actionFingerprint(action: unknown): string {
  // Canonical object key order permits harmless transport retries of the same command.
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, canonical(entry)]),
      );
    return value;
  };
  return createHash("sha256")
    .update(JSON.stringify(canonical(action)))
    .digest("hex");
}

export async function getCozyPayload(
  worldRouteId: string,
  user: AppUserRecord,
  command?: { action: CozyAction; requestId: string },
): Promise<CozyServerPayload> {
  const hash = command ? actionFingerprint(command.action) : null;
  if (command?.action.type === "read_reports") {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      // Initialize/settle through the normal read path before marking the visible history.
      // The dedicated receipt RPC can only change readAt, never a finished season's economy.
      const snapshot = await getCozyPayload(worldRouteId, user);
      const saved = (
        await supabaseSelect<SavedPlayer>(
          "kw_cozy_player_states",
          query("world_player_id,user_id,revision,state_json,influence", {
            world_player_id: `eq.${snapshot.state.playerId}`,
          }),
        )
      )[0];
      if (!saved) continue;
      const result = await supabaseRpc<{
        status: "committed" | "duplicate" | "conflict";
      }>("kw_cozy_read_reports", {
        p_world_id: snapshot.world.id,
        p_user_id: user.id,
        p_actor_player_id: snapshot.state.playerId,
        p_expected_shared_revision: snapshot.revision,
        p_expected_player_revision: saved.revision,
        p_read_at: snapshot.serverNow,
        p_request_id: command.requestId,
        p_action_hash: hash,
      });
      if (result.status !== "conflict")
        return getCozyPayload(worldRouteId, user);
    }
    throw new CozyHttpError(
      "O reino recebeu outras ações ao mesmo tempo. Tente novamente.",
      409,
      "CONCURRENT_UPDATE",
    );
  }
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const row = await fetchWorld(worldRouteId);
    if (row.rules_version !== 2)
      throw new CozyHttpError(
        "Este mundo usa as regras anteriores.",
        409,
        "LEGACY_WORLD",
      );
    const world = toWorld(row);
    const members = (
      await supabaseSelect<MemberRow>(
        "world_players",
        query("id,user_id,status,is_ai,joined_at", {
          world_id: `eq.${world.id}`,
        }),
      )
    ).filter((member) => !member.is_ai);
    const actor = members.find((member) => member.user_id === user.id);
    if (!actor)
      throw new CozyHttpError(
        "Entre neste mundo pelo código de convite.",
        403,
        "MEMBERSHIP_REQUIRED",
      );
    if (command && actor.status !== "alive")
      throw new CozyHttpError(
        "Este reino não pode realizar novas ações.",
        403,
        "PLAYER_INACTIVE",
      );
    if (command) {
      const completed = (
        await supabaseSelect<{ action_hash: string }>(
          "kw_cozy_commands",
          query("action_hash", {
            world_player_id: `eq.${actor.id}`,
            request_id: `eq.${command.requestId}`,
          }),
        )
      )[0];
      if (completed) {
        if (completed.action_hash !== hash)
          throw new CozyHttpError(
            "Este identificador já foi usado para outra ação.",
            409,
            "REQUEST_REUSED",
          );
        return getCozyPayload(worldRouteId, user);
      }
    }
    const [sharedRows, saved, usernames] = await Promise.all([
      supabaseSelect<SavedShared>(
        "kw_cozy_world_states",
        query("revision,state_json", { world_id: `eq.${world.id}` }),
      ),
      supabaseSelect<SavedPlayer>(
        "kw_cozy_player_states",
        query("world_player_id,user_id,revision,state_json,influence", {
          world_id: `eq.${world.id}`,
        }),
      ),
      supabaseSelect<{ id: string; username: string }>(
        "users",
        query("id,username", {
          id: inFilter(members.map((member) => member.user_id)),
        }),
      ),
    ]);
    const now = Date.now();
    const originalShared = sharedRows[0];
    let shared = structuredClone(originalShared?.state_json ?? createCozyShared(world));
    const balance=world.influenceVersion===2?bindWorldBalance(shared,saved.map(s=>s.state_json),world.economyVersion===2,world.economyVersion===3):null;
    const players: CommitPlayer[] = members.map((member) => {
      const previous = saved.find(
        (entry) => entry.world_player_id === member.id,
      );
      if(previous&&((world.influenceVersion===2)!==(previous.state_json.progression?.version===2)))
        throw new CozyHttpError('Esta temporada precisa revisar a versão de influência antes de continuar.',409,'INFLUENCE_VERSION_MISMATCH');
      const joinedAt = Date.parse(member.joined_at);
      const name =
        usernames.find((entry) => entry.id === member.user_id)?.username ??
        "Soberano";
      const initial=previous?.state_json??createCozyState(world,member.id,name,Number.isFinite(joinedAt)?Math.min(now,joinedAt):now);
      if(world.status!=='finalized'){initial.playerName=name;if(initial.king?.alive)initial.king.nickname=name;}
      if(!previous&&initial.progression){if(balance===null)delete initial.progression.balance;else initial.progression.balance=structuredClone(balance);}
      return {
        playerId: member.id,
        expectedRevision: previous?.revision ?? -1,
        state:initial,
        influence: 0,
      };
    });
    const actorState = players.find((entry) => entry.playerId === actor.id)!;
    // Finished worlds use the saved final results; they cannot create a new season.
    if (
      world.status === "finalized" &&
      !saved.some((entry) => entry.world_player_id === actor.id)
    ) {
      throw new CozyHttpError(
        "Esta temporada terminou antes da entrada deste reino.",
        409,
        "WORLD_CLOSED",
      );
    }
    shared = settleWorld(players, shared, world, now);
    const season = getCozyComputed(actorState.state, shared, world, now);
    const finalize =
      world.status === "running" &&
      season.endsAt !== null &&
      now >= season.endsAt;
    if (command && !finalize) {
      const next = applyCozyAction(
        actorState.state,
        shared,
        world,
        command.action.type==='king_choose'?{...command.action,nickname:user.username}:command.action,
        now,
      );
      if (command.action.type === "king_choose" && next.state.king) {
        try {
          const collection = await supabaseRpc<{selectedId:string;inventory:{id:string}[]}>('kw_collection_read',{p_user_id:user.id});
          const kingStats=await supabaseRpc<{revision:number;attributes:{administration:number;command:number;exploration:number}}>('kw_king_stats',{p_user_id:user.id,p_king_id:collection.selectedId});
          if((command.action.kingId!==undefined&&command.action.kingId!==collection.selectedId)||(command.action.statRevision!==undefined&&command.action.statRevision!==kingStats.revision))throw new CozyHttpError('O rei ou os stats mudaram. Feche e reabra a confirmação do reinado.',409,'KING_SELECTION_CONFLICT');
          next.state.king.sovereignId=collection.selectedId;
          const requested=command.action.equipment??[];
          if(!Array.isArray(requested)||requested.length>3||!requested.every(id=>typeof id==='string'))throw new CozyHttpError('Seleção de equipamentos inválida.',400,'LOADOUT_INVALID');
          const filled=requested.filter(Boolean);
          if(new Set(filled).size!==filled.length||filled.some(id=>!Object.hasOwn(EQUIPMENT_EFFECTS,id)||!collection.inventory.some(item=>item.id===id)))throw new CozyHttpError('Escolha até três equipamentos diferentes que você possui.',400,'LOADOUT_NOT_OWNED');
          next.state.king.equipment=[...requested,...Array(3-requested.length).fill('')];
          next.state.king.attributes=kingStats.attributes;
          const originalCrest=actorState.state.crestId;
          const crestId=command.action.crestId??originalCrest??'empire-crest-01';
          const finish=command.action.crestFinish??actorState.state.crestFinish??'plain';
          if(!isCrestId(crestId)||!collection.inventory.some(item=>item.id===crestId))throw new CozyHttpError('Escolha um brasão do seu inventário.',400,'CREST_NOT_OWNED');
          if(finish!=='plain'&&finish!=='imperial')throw new CozyHttpError('Acabamento inválido.',400,'CREST_INVALID');
          if(originalCrest&&(originalCrest!==crestId||finish!==(actorState.state.crestFinish??'plain')))throw new CozyHttpError('O brasão está fixado neste mundo.',409,'CREST_FIXED');
          if(!originalCrest&&finish==='imperial'){
            const benefits=await supabaseRpc<{active:boolean}>('kw_premium_benefits',{p_user_id:user.id});
            if(!benefits.active)throw new CozyHttpError('O acabamento imperial é exclusivo do Premium.',403,'PREMIUM_REQUIRED');
          }
          next.state.crestId=crestId;next.state.crestFinish=finish;
          (next.shared.realmCrests??={})[actor.id]={id:crestId,finish};
        } catch(error) {
          // Compatibility for environments that have not introduced collections yet.
          if(!/kw_collection_read.*(does not exist|schema cache|Could not find)/i.test(String(error)))throw error;
          const [attributes]=await supabaseSelect<{administration:number;command:number;exploration:number}>("kw_royal_attributes",query("administration,command,exploration",{user_id:`eq.${user.id}`}));
          next.state.king.attributes=attributes??{administration:5,command:5,exploration:5};
        }
      }
      actorState.state = next.state;
      shared = next.shared;
      if(command.action.type.startsWith("alliance_")||command.action.type.startsWith("sanctuary_pact_"))shared=settleWorld(players,shared,world,now);
    }
    for (const player of players)
      player.influence = getCozyComputed(
        player.state,
        shared,
        world,
        now,
      ).influence.total;
    const dirty =
      !originalShared ||
      !sameState(originalShared.state_json, shared) ||
      players.some((player) => {
        const previous = saved.find(
          (entry) => entry.world_player_id === player.playerId,
        );
        return !previous || previous.influence !== player.influence || !sameState(previous.state_json, player.state);
      });
    let revision = originalShared?.revision ?? -1;
    if (world.status !== "finalized" && (dirty || command || finalize)) {
      const result = await supabaseRpc<{
        status: "committed" | "conflict" | "duplicate" | "closed";
        revision?: number;
      }>(row.status === "open" && command?.action.type === "king_choose" ? "kw_cozy_commit_royal_before_start" : "kw_cozy_commit", {
        p_world_id: world.id,
        p_user_id: user.id,
        p_actor_player_id: actor.id,
        p_expected_shared_revision: revision,
        p_expected_world_status: row.status,
        p_shared: shared,
        p_players: players,
        p_request_id: finalize ? null : (command?.requestId ?? null),
        p_action_hash: finalize ? null : hash,
        p_finalize: finalize,
      });
      if (result.status === "conflict" || result.status === "closed") continue;
      if (result.status === "duplicate")
        return getCozyPayload(worldRouteId, user);
      revision = result.revision ?? revision + 1;
      if (finalize) world.status = "finalized";
    }
    if (command && finalize)
      throw new CozyHttpError(
        "A temporada terminou. O resultado final já foi salvo.",
        409,
        "WORLD_CLOSED",
      );
    const account = await getCozyAccount(user);
    const computed = getCozyComputed(actorState.state, shared, world, now);
    if(world.combatMode==='competitive')computed.playerThreats=incomingPlayerAttacks(players,actorState.state,now);
    return {
      world,
      state: actorState.state,
      shared,
      computed,
      tiles: getCozyTiles(actorState.state, shared, world),
      players: players
        .map(({ playerId, state, influence }) => ({
          playerId,
          playerName: state.playerName,
          influence,
          cities: state.cities.length,
          portalCrossedAt: state.portalCrossedAt,
          allianceId: state.allianceId,
          finalized: state.finalizedAt !== null||Boolean(state.defeat),
        }))
        .sort(
          (a, b) =>
            b.influence - a.influence ||
            (a.portalCrossedAt ?? Infinity) - (b.portalCrossedAt ?? Infinity) ||
            a.playerId.localeCompare(b.playerId),
        ),
      account: account.account,
      revision,
      serverNow: now,
      canStart:
        row.status === "open" &&
        row.created_by_user_id === user.id &&
        actor.status === "alive",
    };
  }
  throw new CozyHttpError(
    "O reino recebeu outras ações ao mesmo tempo. Tente novamente.",
    409,
    "CONCURRENT_UPDATE",
  );
}

export function cozyErrorResponse(error: unknown): {
  status: number;
  body: { error: string; code: string };
} {
  if (error instanceof CozyHttpError)
    return {
      status: error.status,
      body: { error: error.message, code: error.code },
    };
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized")
    return {
      status: 401,
      body: {
        error: "Entre na sua conta para continuar.",
        code: "UNAUTHORIZED",
      },
    };
  const mappings: [RegExp, number, string, string][] = [
    [/COZY_ACTIVE_WORLD_LIMIT/,409,"ACTIVE_WORLD_LIMIT","Você atingiu seu limite de mundos ativos. Termine uma temporada ou veja o Premium."],
    [/COZY_PASSWORD_PREMIUM_REQUIRED/,403,"PASSWORD_PREMIUM_REQUIRED","Criar um mundo com senha é um benefício Premium. Você pode criar um mundo sem senha."],
    [
      /COZY_OWNER_REQUIRED/,
      403,
      "OWNER_REQUIRED",
      "Só quem criou o mundo pode iniciar a temporada.",
    ],
    [
      /COZY_MEMBERSHIP_REQUIRED|COZY_INVITE_REQUIRED/,
      403,
      "MEMBERSHIP_REQUIRED",
      "Entre neste mundo pelo código de convite.",
    ],
    [
      /COZY_JOINS_CLOSED|COZY_WORLD_CLOSED|COZY_PLAYER_INACTIVE/,
      409,
      "WORLD_CLOSED",
      "Este mundo não aceita novas ações ou entradas.",
    ],
    [/COZY_NO_LATE_SLOT/, 409, "NO_LATE_SLOT", "Não há reinos disponíveis para assumir neste mundo."],
    [/COZY_WORLD_FULL/, 409, "WORLD_FULL", "Este mundo já está completo."],
    [
      /COZY_REQUEST_REUSED/,
      409,
      "REQUEST_REUSED",
      "Este identificador já foi usado para outra ação.",
    ],
    [/COZY_WORLD_NOT_FOUND/, 404, "WORLD_NOT_FOUND", "Mundo não encontrado."],
    [
      /COZY_ACCOUNT_UNAVAILABLE/,
      403,
      "ACCOUNT_UNAVAILABLE",
      "Esta conta não pode entrar no mundo.",
    ],
  ];
  for (const [pattern, status, code, text] of mappings)
    if (pattern.test(message)) return { status, body: { error: text, code } };
  if (error instanceof Error && error.name === "CozyRuleError")
    return {
      status: 422,
      body: { error: error.message, code: "INVALID_ACTION" },
    };
  if (
    /kw_cozy_|rules_version|influence_version/.test(message) &&
    /schema cache|does not exist|could not find/i.test(message)
  ) {
    return {
      status: 503,
      body: {
        error:
          "A atualização das regras ainda precisa ser aplicada ao banco deste projeto.",
        code: "MIGRATION_REQUIRED",
      },
    };
  }
  // Detailed database/network messages are kept server-side, never exposed to players.
  console.error(
    "[cozy]",
    error instanceof Error ? error.name : "UnknownError",
    message.replace(/https?:\/\/\S+/g, "[endpoint]"),
  );
  return {
    status: 503,
    body: {
      error:
        "Não foi possível sincronizar o reino. Tente novamente em instantes.",
      code: "SERVICE_UNAVAILABLE",
    },
  };
}
