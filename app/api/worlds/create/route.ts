import { hashLobbyPassword } from "@/lib/cozy/lobby-password";
import { NextResponse } from "next/server";
import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { supabaseRpc } from "@/lib/supabase-rest";
import { cozyErrorResponse } from "@/lib/cozy/server";

export async function POST(request: Request) {
  try {
    const origin=request.headers.get('origin');if(origin){let valid=false;try{const parsed=new URL(origin);valid=['http:','https:'].includes(parsed.protocol)&&parsed.host===(request.headers.get('host')??new URL(request.url).host);}catch{}if(!valid)return NextResponse.json({error:'Origem inválida.'},{status:403});}
    const user = await requireAuthenticatedAppUser();
    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      mode?: unknown;
      password?: unknown;
      combatMode?:unknown;
    };
    const name =
      typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
    if (name.length < 2)
      return NextResponse.json(
        { error: "Dê um nome ao mundo (mín. 2 letras)." },
        { status: 400 },
      );
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length > 64 || (password.length > 0 && password.length < 4))
      return NextResponse.json({error:"A senha deve ter de 4 a 64 caracteres."},{status:400});
    if(body.combatMode!==undefined&&(typeof body.combatMode!=='string'||!['cozy','competitive'].includes(body.combatMode)))return NextResponse.json({error:'Escolha Cozy ou competitivo.'},{status:400});
    const combatMode=body.combatMode==='competitive'?'competitive':'cozy';
    const mode = body.mode === "express" ? "express" : "normal";
    type CreatedWorld = {
      id: string;
      slug: string;
      join_code: string;
    };
    const params={
      p_user_id: user.id,
      p_name: name,
      p_mode: mode,
    };
    let world:CreatedWorld;
    try {world=await supabaseRpc<CreatedWorld>(combatMode==='competitive'?'kw_cozy_create_with_rules':'kw_cozy_create_lobby',{...params,...(combatMode==='competitive'?{p_combat_mode:combatMode}:{}),p_password_hash:password ? hashLobbyPassword(password) : null});}
    catch(error){
      const message=error instanceof Error?error.message:'';
      if(combatMode==='competitive'||password || !(/Could not find the function public\.kw_cozy_create_lobby|function (?:public\.)?kw_cozy_create_lobby[^\n]*does not exist/i.test(message)))throw error;
      try {world=await supabaseRpc<CreatedWorld>(mode==='express'?'kw_cozy_create_economic':'kw_cozy_create',params);}
      catch(e){if(mode!=='express'||!(/kw_cozy_create_economic/.test(String(e))&&/does not exist|Could not find/.test(String(e))))throw e;world=await supabaseRpc<CreatedWorld>('kw_cozy_create',params);}
    }
    return NextResponse.json({
      ok: true,
      world: {
        combatMode,
        slug: world.slug,
        joinCode: world.join_code,
        href: `/world/${world.slug}/intelligence`,
      },
    });
  } catch (error) {
    const result = cozyErrorResponse(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
