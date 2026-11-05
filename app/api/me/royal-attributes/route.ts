import {NextResponse} from "next/server";
import {requireAuthenticatedAppUser} from "@/lib/app-user";
import {supabaseRpc} from "@/lib/supabase-rest";
export const dynamic='force-dynamic';const headers={'Cache-Control':'private, no-store'};
export async function GET(){try{
 const user=await requireAuthenticatedAppUser();const collection=await supabaseRpc<{selectedId:string}>('kw_collection_read',{p_user_id:user.id});
 const stats=await supabaseRpc<{attributes:Record<string,number>;revision:number;level:number;available:number;kingId:string}>('kw_king_stats',{p_user_id:user.id,p_king_id:collection.selectedId});
 return NextResponse.json({...stats,attributes:{...stats.attributes,revision:stats.revision}},{headers});
 }catch(error){return NextResponse.json({error:'Não foi possível carregar os stats do rei.'},{status:String(error).includes('Unauthorized')?401:503,headers});}}
export async function POST(){return NextResponse.json({error:'A base do rei é fixa. Adicione pontos na coleção; realocação não está disponível.'},{status:410,headers});}
