import {NextResponse} from "next/server";
import {requireAuthenticatedAppUser} from "@/lib/app-user";
import {supabaseSelect,supabaseRpc} from "@/lib/supabase-rest";
import {SOVEREIGN_APPEARANCES} from "@/lib/sovereign-appearances";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(){
 try{
  const user=await requireAuthenticatedAppUser();
  const rows=await supabaseSelect<{appearance_id:string;revision:number}>("kw_account_appearance",new URLSearchParams({select:"appearance_id,revision",user_id:`eq.${user.id}`}));
  return NextResponse.json(rows[0]??{appearance_id:"sovereign-01",revision:0},{headers});
 }catch(error){return NextResponse.json({error:"Não foi possível consultar sua aparência."},{status:String(error).includes('Unauthorized')?401:503,headers});}
}
export async function POST(request:Request){
 try{
  const origin=request.headers.get('origin');
  if(origin){let valid=false;try{const parsed=new URL(origin);valid=['http:','https:'].includes(parsed.protocol)&&parsed.host===(request.headers.get('host')??new URL(request.url).host);}catch{}if(!valid)return NextResponse.json({error:'Origem inválida.'},{status:403,headers});}
  const user=await requireAuthenticatedAppUser();const body=await request.json();
  if(!Number.isSafeInteger(body.revision)||body.revision<0||typeof body.appearance_id!=='string')return NextResponse.json({error:'Seleção inválida.'},{status:400,headers});
  if(!SOVEREIGN_APPEARANCES.some(item=>item.id===body.appearance_id))return NextResponse.json({error:'Esta aparência ainda não está disponível.'},{status:403,headers});
  const saved=await supabaseRpc('kw_account_appearance_save',{p_user_id:user.id,p_appearance_id:body.appearance_id,p_expected_revision:body.revision});
  return NextResponse.json(saved,{headers});
 }catch(error){if(String(error).includes('APPEARANCE_LOCKED'))return NextResponse.json({error:'Você ainda não possui este rei.'},{status:403,headers});const conflict=String(error).includes('APPEARANCE_REVISION_CONFLICT');return NextResponse.json({error:conflict?'A aparência mudou em outro dispositivo. Reabra para atualizar.':'Não foi possível salvar sua aparência.'},{status:String(error).includes('Unauthorized')?401:conflict?409:503,headers});}
}
