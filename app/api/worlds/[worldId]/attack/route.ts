import { NextResponse } from "next/server";

import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { supabaseInsertReturning, supabaseSelect } from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

type TroopSel = { militia?: number; shooters?: number; scouts?: number; machinery?: number };

// POST /api/worlds/[worldId]/attack
// body: { targetSiteId, troops:{militia,shooters,scouts,machinery}, withHero }
// Cria uma ordem real (world_player_map_orders) que o tick resolve via kw_resolve_attack.
export async function POST(request: Request, { params }: { params: { worldId: string } }) {
  try {
    const appUser = await requireAuthenticatedAppUser();
    const worldId = params.worldId;
    const body = (await request.json()) as { targetSiteId?: string; troops?: TroopSel; withHero?: boolean };
    const targetSiteId = String(body.targetSiteId ?? "").trim();
    if (!targetSiteId) {
      return NextResponse.json({ error: "targetSiteId obrigatório." }, { status: 400 });
    }

    // 1. jogador (world_player) neste mundo
    const wpParams = new URLSearchParams();
    wpParams.set("select", "id,current_capital_site_id,status");
    wpParams.set("world_id", `eq.${worldId}`);
    wpParams.set("user_id", `eq.${appUser.id}`);
    const me = (await supabaseSelect<{ id: string; current_capital_site_id: string | null; status: string }>(
      "world_players",
      wpParams,
    ))[0];
    if (!me) return NextResponse.json({ error: "Você não está neste mundo." }, { status: 403 });
    if (me.status !== "alive") return NextResponse.json({ error: "Você não está vivo neste mundo." }, { status: 403 });
    if (!me.current_capital_site_id) return NextResponse.json({ error: "Sem capital de origem." }, { status: 400 });

    // 2. alvo (villages) — tem que ser de OUTRO dono
    const vParams = new URLSearchParams();
    vParams.set("select", "site_id,owner_world_player_id");
    vParams.set("site_id", `eq.${targetSiteId}`);
    vParams.set("world_id", `eq.${worldId}`);
    const target = (await supabaseSelect<{ site_id: string; owner_world_player_id: string | null }>("villages", vParams))[0];
    if (!target) return NextResponse.json({ error: "Alvo inválido." }, { status: 400 });
    if (target.owner_world_player_id === me.id) {
      return NextResponse.json({ error: "Não dá pra atacar a si mesmo." }, { status: 400 });
    }

    // 3. coord do alvo (map_sites -> map_tiles)
    const sParams = new URLSearchParams();
    sParams.set("select", "id,tile_id");
    sParams.set("id", `eq.${targetSiteId}`);
    const tileId = (await supabaseSelect<{ id: string; tile_id: string }>("map_sites", sParams))[0]?.tile_id ?? null;
    let coord = "0:0";
    if (tileId) {
      const tParams = new URLSearchParams();
      tParams.set("select", "id,q,r");
      tParams.set("id", `eq.${tileId}`);
      const tile = (await supabaseSelect<{ id: string; q: number; r: number }>("map_tiles", tParams))[0];
      if (tile) coord = `${tile.q}:${tile.r}`;
    }

    // 4. tropas: clamp ao disponível na capital
    const isParams = new URLSearchParams();
    isParams.set("select", "militia_count,shooters_count,scouts_count,machinery_count");
    isParams.set("world_player_id", `eq.${me.id}`);
    const army = (await supabaseSelect<{
      militia_count: number; shooters_count: number; scouts_count: number; machinery_count: number;
    }>("world_player_imperial_states", isParams))[0] ?? { militia_count: 0, shooters_count: 0, scouts_count: 0, machinery_count: 0 };
    const t = body.troops ?? {};
    const send = {
      militia: Math.max(0, Math.min(Math.floor(Number(t.militia ?? 0)), army.militia_count)),
      shooters: Math.max(0, Math.min(Math.floor(Number(t.shooters ?? 0)), army.shooters_count)),
      scouts: Math.max(0, Math.min(Math.floor(Number(t.scouts ?? 0)), army.scouts_count)),
      machinery: Math.max(0, Math.min(Math.floor(Number(t.machinery ?? 0)), army.machinery_count)),
    };
    if (send.militia + send.shooters + send.scouts + send.machinery <= 0) {
      return NextResponse.json({ error: "Sem tropas suficientes pra enviar." }, { status: 400 });
    }

    // 5. cria a ordem real
    const etaMinutes = 2;
    const order = {
      world_id: worldId,
      world_player_id: me.id,
      origin_site_id: me.current_capital_site_id,
      target_site_id: targetSiteId,
      target_tile_id: tileId,
      target_coord: coord,
      movement_type: "attack",
      command_action: "attack",
      troop_dispatch_json: send,
      eta_minutes: etaMinutes,
      arrival_at: new Date(Date.now() + etaMinutes * 60 * 1000).toISOString(),
      meta_json: { with_hero: Boolean(body.withHero) },
    };
    const created = await supabaseInsertReturning<typeof order, { id: string }>("world_player_map_orders", order);

    return NextResponse.json({ ok: true, orderId: created[0]?.id ?? null, sent: send, etaMinutes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 500 });
  }
}
