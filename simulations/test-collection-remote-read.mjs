import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
nextEnv.loadEnvConfig(process.cwd(),false,{info(){},error(){}});
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(url).hostname,'wdmrdovkkrgzalnpqdxe.supabase.co','Wrong project');
const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(publicKey&&secret&&publicKey!==secret);
const options={auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(20000)})}};
const anon=createClient(url,publicKey,options),server=createClient(url,secret,options);
const {data,error}=await server.from('kw_collection_catalog').select('product_id,kind,gem_price,starter,rarity');assert.equal(error,null,error?.message);
const local=JSON.parse(await readFile('lib/collection-catalog.json','utf8'));
assert.equal(data.length,local.length);for(const p of local){const row=data.find(r=>r.product_id===p.id);assert(row,p.id);assert.equal(row.kind,p.kind);assert.equal(row.gem_price,p.price,p.id);assert.equal(row.starter,Boolean(p.starter),p.id);if(p.kind==='equipment')assert.equal(row.rarity,p.rarity,p.id);}
for(const table of ['kw_collection_catalog','kw_player_wallet','kw_player_inventory','kw_gem_transactions','kw_king_xp_progress','kw_collection_season_rewards']){const result=await anon.from(table).select('*').limit(1);assert.equal(result.error?.code,'42501',table+' public SELECT must be denied');}
const nobody='00000000-0000-4000-8000-000000000000';
for(const name of ['kw_collection_read','kw_premium_benefits']){const result=await anon.rpc(name,{p_user_id:nobody});assert.equal(result.error?.code,'42501',name+' public EXECUTE must be denied');}
const benefits=await server.rpc('kw_premium_benefits',{p_user_id:nobody});assert.equal(benefits.error,null,benefits.error?.message);assert.equal(benefits.data.worldLimit,1);assert.equal(benefits.data.active,false);
const invalid=await server.rpc('kw_collection_read',{p_user_id:nobody});assert.equal(invalid.error?.code,'P0001');assert.match(invalid.error.message,/COZY_ACCOUNT_UNAVAILABLE/);
const result={status:'PASS',project:'wdmrdovkkrgzalnpqdxe',scope:'Real PostgREST, no account/world creation',products:data.length,checks:['deployed catalog matches local prices/starters/rarities','private tables and RPC denied publicly','server Premium RPC available','nonexistent account rejected before bootstrap']};
await writeFile('reports/cozy/remote-collection-rest.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
