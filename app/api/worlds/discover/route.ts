import { NextResponse } from "next/server";
import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { supabaseSelect } from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireAuthenticatedAppUser();
    const settings = await supabaseSelect<{world_id:string;password_hash:string|null}>("kw_cozy_lobby_settings",new URLSearchParams({select:"world_id,password_hash",listed:"eq.true"}));
    if (!settings.length) return NextResponse.json({worlds:[]});
    const ids = settings.map(s=>s.world_id);
    const worlds = await supabaseSelect<{id:string;slug:string;name:string;status:string;season_mode:string;combat_mode?:string;persistent_cozy?:boolean;player_cap:number;starts_at:string;runtime_anchor_started_at:string|null}>("worlds",new URLSearchParams({select:"*",id:`in.(${ids.join(",")})`,rules_version:"eq.2"}));
    const members = await supabaseSelect<{world_id:string;is_ai:boolean;status:string}>("world_players",new URLSearchParams({select:"world_id,is_ai,status",world_id:`in.(${ids.join(",")})`}));
    return NextResponse.json({worlds:worlds.filter(w=>w.status!=="finalized").map(w=>({slug:w.slug,name:w.name,status:w.status,mode:w.season_mode,combatMode:w.combat_mode==='competitive'?'competitive':'cozy',persistent:w.persistent_cozy,capacity:w.player_cap,players:members.filter(p=>p.world_id===w.id&&!p.is_ai&&(!w.persistent_cozy||p.status!=="archived")).length,startsAt:w.runtime_anchor_started_at??w.starts_at,locked:!!settings.find(s=>s.world_id===w.id)?.password_hash}))},{headers:{"Cache-Control":"private, no-store"}});
  } catch { return NextResponse.json({error:"Não foi possível buscar mundos."},{status:503}); }
}
