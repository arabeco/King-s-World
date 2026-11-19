import {NextResponse} from 'next/server';
import {requireAuthenticatedAppUser} from '@/lib/app-user';
import {supabaseRpc} from '@/lib/supabase-rest';

export const dynamic='force-dynamic';
export async function POST(request:Request,{params}:{params:{worldId:string}}){
 try{
  const origin=request.headers.get('origin');
  if(origin){let valid=false;try{const parsed=new URL(origin);valid=['http:','https:'].includes(parsed.protocol)&&parsed.host===(request.headers.get('host')??new URL(request.url).host);}catch{}if(!valid)return NextResponse.json({error:'Origem inválida.'},{status:403});}
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(params.worldId))return NextResponse.json({error:'Mundo inválido.'},{status:400});
  const user=await requireAuthenticatedAppUser();
  await supabaseRpc('kw_delete_solo_cozy_world',{p_slug:params.worldId,p_user_id:user.id});
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const message=String(error);
  if(message.includes('Unauthorized'))return NextResponse.json({error:'Entre na sua conta para continuar.'},{status:401});
  if(message.includes('WORLD_DELETE_SHARED'))return NextResponse.json({error:'Este mundo tem outros jogadores e não pode ser excluído desta forma.'},{status:409});
  if(message.includes('WORLD_DELETE_OWNER_REQUIRED'))return NextResponse.json({error:'Somente quem criou o mundo pode excluí-lo.'},{status:403});
  if(message.includes('WORLD_DELETE_UNAVAILABLE'))return NextResponse.json({error:'Este mundo não está disponível para exclusão.'},{status:404});
  return NextResponse.json({error:'Não foi possível excluir agora. Tente novamente mais tarde.'},{status:503});
 }
}
