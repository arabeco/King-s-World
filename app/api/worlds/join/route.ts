import { verifyLobbyPassword } from "@/lib/cozy/lobby-password";
import { NextResponse } from "next/server";

import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { ensureWorldFilled } from "@/lib/npc-fill";
import { supabaseSelect } from "@/lib/supabase-rest";
import { cozyErrorResponse, ensureCozyMembership, isCozyWorld } from "@/lib/cozy/server";

type WorldRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  day_number: number;
  join_code: string;
  joins_closed_at: string | null;
};

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedAppUser();

    const body = await request.json().catch(() => ({})) as { code?: unknown; slug?: unknown; password?: unknown };
    const raw = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

    const slug = typeof body.slug === "string" && /^[a-z0-9_-]{1,100}$/i.test(body.slug) ? body.slug : "";
    const password = typeof body.password === "string" && body.password.length <= 64 ? body.password : "";
    if (!raw && !slug) {
      return NextResponse.json({ error: "Código obrigatório." }, { status: 400 });
    }

    const params = new URLSearchParams();
    params.set("select", "id,slug,name,status,day_number,join_code,joins_closed_at");
    params.set(slug ? "slug" : "join_code", `eq.${slug || raw}`);
    params.set("limit", "1");

    const rows = await supabaseSelect<WorldRow>("worlds", params);
    const world = rows[0] ?? null;

    if (!world) {
      return NextResponse.json({ error: "Código inválido ou mundo não encontrado." }, { status: 404 });
    }

    if (await isCozyWorld(world.id)) {
      let setting: {password_hash:string|null} | undefined;
      try { [setting] = await supabaseSelect<{password_hash:string|null}>("kw_cozy_lobby_settings",new URLSearchParams({select:"password_hash",world_id:`eq.${world.id}`})); }
      catch(error) {
        if (!/kw_cozy_lobby_settings/.test(String(error)) || !/does not exist|schema cache|Could not find/i.test(String(error))) throw error;
      }
      if (setting?.password_hash && !verifyLobbyPassword(password,setting.password_hash))
        return NextResponse.json({error:"Senha incorreta.",code:"PASSWORD_REQUIRED"},{status:403});
      if (slug && !setting) return NextResponse.json({error:"Este mundo exige código de convite."},{status:403});
      await ensureCozyMembership(world.id, user, setting ? world.join_code : raw);
      return NextResponse.json({ ok: true, world: { slug: world.slug, name: world.name, href: `/world/${world.slug}/intelligence` } });
    }

    if (world.status === "finalized") {
      return NextResponse.json({ error: "Este mundo já foi finalizado." }, { status: 410 });
    }

    if (world.status !== "open") {
      return NextResponse.json({ error: "A entrada deste mundo ja foi encerrada - o reino comecou." }, { status: 403 });
    }

    if (world.joins_closed_at) {
      return NextResponse.json({ error: "A entrada deste mundo já foi encerrada — o reino começou." }, { status: 403 });
    }

    // Auto-fill: garante que o mundo tem NPCs ativos quando um humano entra.
    // Não-fatal — se falhar, o jogador entra na mesma.
    void ensureWorldFilled(world.id, world.slug).catch(() => undefined);

    const href = `/world/${world.slug}/intelligence`;

    return NextResponse.json({
      ok: true,
      world: { slug: world.slug, name: world.name, href },
    });
  } catch (error) {
    const result = cozyErrorResponse(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
