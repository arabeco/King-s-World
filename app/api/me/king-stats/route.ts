import {NextResponse} from "next/server";
import {requireAuthenticatedAppUser} from "@/lib/app-user";
import {supabaseRpc} from "@/lib/supabase-rest";
export const dynamic='force-dynamic';const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request){try{
 const origin=request.headers.get('origin');if(origin){const url=new URL(origin);if(!['http:','https:'].includes(url.protocol)||url.host!==(request.headers.get('host')??new URL(request.url).host))return NextResponse.json({error:'Origem inválida.'},{status:403,headers});}
 const user=await requireAuthenticatedAppUser();const body=await request.json();if(typeof body.kingId!=='string'||!['administration','command','exploration'].includes(body.stat)||!Number.isSafeInteger(body.revision))return NextResponse.json({error:'Distribuição inválida.'},{status:400,headers});
 return NextResponse.json(await supabaseRpc('kw_king_add_stat',{p_user_id:user.id,p_king_id:body.kingId,p_stat:body.stat,p_expected_revision:body.revision}),{headers});
 }catch(error){const message=String(error);return NextResponse.json({error:message.includes('REVISION_CONFLICT')?'Este rei mudou em outra aba. Atualize a coleção.':message.includes('NO_POINTS')?'Não há pontos disponíveis ou este atributo já está no máximo.':'Não foi possível adicionar o ponto.'},{status:message.includes('Unauthorized')?401:message.includes('KING_')?409:503,headers});}}
