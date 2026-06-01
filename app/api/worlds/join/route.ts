import { NextResponse } from "next/server";

import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { supabaseSelect } from "@/lib/supabase-rest";

type WorldRow = {
  slug: string;
  name: string;
  status: string;
  day_number: number;
  join_code: string;
};

export async function POST(request: Request) {
  try {
    await requireAuthenticatedAppUser();

    const body = await request.json().catch(() => ({})) as { code?: unknown };
    const raw = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

    if (!raw) {
      return NextResponse.json({ error: "Código obrigatório." }, { status: 400 });
    }

    const params = new URLSearchParams();
    params.set("select", "slug,name,status,day_number,join_code");
    params.set("join_code", `eq.${raw}`);
    params.set("limit", "1");

    const rows = await supabaseSelect<WorldRow>("worlds", params);
    const world = rows[0] ?? null;

    if (!world) {
      return NextResponse.json({ error: "Código inválido ou mundo não encontrado." }, { status: 404 });
    }

    if (world.status === "finalized") {
      return NextResponse.json({ error: "Este mundo já foi finalizado." }, { status: 410 });
    }

    const href = world.status === "finalized"
      ? `/world/${world.slug}/report`
      : `/world/${world.slug}/intelligence`;

    return NextResponse.json({
      ok: true,
      world: { slug: world.slug, name: world.name, href },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao buscar mundo.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
