import {NextResponse} from "next/server";
import {requireAuthenticatedAppUser} from "@/lib/app-user";
import {supabaseRpc,supabaseSelect} from "@/lib/supabase-rest";
import type {CollectionState} from '@/lib/collection';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){try{
 const user=await requireAuthenticatedAppUser(),season=new URL(request.url).searchParams.get('season');
 if(season&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(season))return NextResponse.json({error:'Temporada inválida.'},{status:400,headers});
 const data=await supabaseRpc<CollectionState>('kw_collection_read',{p_user_id:user.id});
 // Normal inventory stays limited to recent receipts. A historical link reads
 // only this account's exact award, never another player's receipt or world name.
 if(season&&!data.seasonRewards?.some(r=>r.worldId===season)){
  type Award={world_id:string;gems:number;product_ids:string[];awarded_at:string;place:number;participants:number;rarity:string;participation_gems:number;victory_gems:number;placement_gems:number;conversion_gems:number;king_xp:Record<string,number>;xp_percent:number;rules_version:number};
  const rows=await supabaseSelect<Award>('kw_collection_season_rewards',new URLSearchParams({select:'world_id,gems,product_ids,awarded_at,place,participants,rarity,participation_gems,victory_gems,placement_gems,conversion_gems,king_xp,xp_percent,rules_version',world_id:`eq.${season}`,user_id:`eq.${user.id}`,limit:'1'}));
  if(rows[0]){const r=rows[0],world=await supabaseSelect<{name:string}>('worlds',new URLSearchParams({select:'name',id:`eq.${season}`,limit:'1'}));data.seasonRewards=[{worldId:r.world_id,worldName:world[0]?.name??'Temporada',gems:r.gems,productIds:r.product_ids,awardedAt:r.awarded_at,place:r.place,participants:r.participants,rarity:r.rarity,participationGems:r.participation_gems,victoryGems:r.victory_gems,placementGems:r.placement_gems,conversionGems:r.conversion_gems,kingXp:r.king_xp,xpPercent:r.xp_percent,rulesVersion:r.rules_version},...(data.seasonRewards??[])];}
 }
 for(const receipt of data.seasonRewards??[])receipt.awardedAt=new Date(receipt.awardedAt).toISOString();
 return NextResponse.json(data,{headers});
}catch(error){return NextResponse.json({error:'Coleção indisponível. Tente novamente.'},{status:String(error).includes('Unauthorized')?401:503,headers});}}
export async function POST(request:Request){try{
 const origin=request.headers.get('origin');if(origin){let valid=false;try{const url=new URL(origin);valid=['http:','https:'].includes(url.protocol)&&url.host===(request.headers.get('host')??new URL(request.url).host);}catch{}if(!valid)return NextResponse.json({error:'Origem inválida.'},{status:403,headers});}
 const user=await requireAuthenticatedAppUser();const body=await request.json();
 if(typeof body.productId!=='string'||typeof body.requestId!=='string')return NextResponse.json({error:'Compra inválida.'},{status:400,headers});
 return NextResponse.json(await supabaseRpc('kw_collection_buy',{p_user_id:user.id,p_product_id:body.productId,p_request_id:body.requestId}),{headers});
 }catch(error){const msg=String(error);const reason=msg.includes('INSUFFICIENT_GEMS')?'Gemas insuficientes.':msg.includes('ALREADY_OWNED')?'Você já possui este produto.':msg.includes('REQUEST_REUSED')?'Identificador de compra já utilizado.':'Não foi possível concluir a compra.';return NextResponse.json({error:reason},{status:msg.includes('Unauthorized')?401:msg.includes('COLLECTION_')?409:503,headers});}}
