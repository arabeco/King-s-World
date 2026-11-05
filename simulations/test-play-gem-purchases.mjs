import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
import {createCozyDatabase} from './lib/cozy-fixture.mjs';
const db=await createCozyDatabase(),compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const modules={};for(const name of ['play-subscription','play-gems']){const m={exports:{}};new Function('module','exports',compile(await readFile(new URL(`../supabase/functions/_shared/${name}.ts`,import.meta.url),'utf8')))(m,m.exports);modules[name]=m.exports;}
const {playAccountId}=modules['play-subscription'];
try{
 await db.exec('create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;');
 for(const name of ['11_SQL_PREMIUM_ENTITLEMENTS_PLAYSTORE.sql','67_SQL_ACCOUNT_APPEARANCE.sql','68_SQL_COLLECTION_WALLET.sql','69_SQL_KING_GAMEPLAY_PROGRESSION.sql','70_SQL_COLLECTION_SEASON_REWARDS.sql','73_SQL_SEASON_POSITION_REWARDS.sql','75_SQL_PLAY_GEM_PURCHASES.sql'])await db.exec(await readFile(new URL('../'+name,import.meta.url),'utf8'));
 const auth='00000000-0000-4000-8000-000000000001',otherAuth='00000000-0000-4000-8000-000000000002';
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
 const user=(await one("insert into users(username,email,auth_user_id) values('gem-buyer','gem@test.invalid',$1) returning id",[auth])).id;
 const other=(await one("insert into users(username,email,auth_user_id) values('gem-other','other@test.invalid',$1) returning id",[otherAuth])).id;
 let actor=auth,payload,handler,events=[],failSave=false,consumeStatus=204;
 const accountId=await playAccountId(auth),paid=id=>({productId:id,purchaseState:0,consumptionState:0,quantity:1,orderId:'GPA.'+id,obfuscatedExternalAccountId:accountId,purchaseType:0});
 const wallet=async()=>one('select gems,gem_debt from kw_player_wallet where user_id=$1',[user]);
 const client={auth:{getUser:async token=>({data:{user:token==='fixture-auth'?{id:actor}:null},error:token==='fixture-auth'?null:{}})},
  from(table){const filters={};const b={select(){return b},eq(k,v){filters[k]=v;return b},async maybeSingle(){try{return {data:(await db.query(table==='users'?'select id,account_status,deletion_requested_at from users where auth_user_id=$1':'select user_id,product_id,status from kw_play_gem_purchases where purchase_token=$1',[table==='users'?filters.auth_user_id:filters.purchase_token])).rows[0]??null,error:null}}catch(error){return {data:null,error}}}};return b;},
  async rpc(name,p){if(name==='kw_refund_play_gems'){events.push('refund');return {data:(await one('select kw_refund_play_gems($1) value',[p.p_purchase_token])).value,error:null};}assert.equal(name,'kw_grant_play_gems');events.push('grant');if(failSave)return {error:{message:'private detail'}};try{return {data:(await one('select kw_grant_play_gems($1,$2,$3,$4,$5) value',[p.p_user_id,p.p_product_id,p.p_purchase_token,p.p_order_id,p.p_store_environment])).value,error:null}}catch(error){return {data:null,error}}}
 };
 class FakeJWT{setProtectedHeader(){return this}setIssuer(){return this}setSubject(){return this}setAudience(){return this}setIssuedAt(){return this}setExpirationTime(){return this}async sign(){return 'fixture-jwt'}}
 const env={SUPABASE_URL:'https://fixture.supabase.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',GOOGLE_PLAY_PACKAGE_NAME:'com.kingsworld.app',GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:'fixture@test.invalid',private_key:'fixture-key'})};
 const m={exports:{}};
 new Function('require','module','exports','Deno','fetch','console',compile(await readFile(new URL('../supabase/functions/verify-google-play-purchase/index.ts',import.meta.url),'utf8')))(name=>{
  if(name.includes('std@'))return {serve:fn=>{handler=fn}};
  if(name.includes('supabase-js'))return {createClient:()=>client};
  if(name.startsWith('npm:jose'))return {SignJWT:FakeJWT,importPKCS8:async()=>({})};
  for(const key of Object.keys(modules))if(name.includes(key))return modules[key];throw Error(name);
 },m,m.exports,{env:{get:key=>env[key]}},async(url,init)=>{
  if(url.includes('oauth2.googleapis.com'))return Response.json({access_token:'fixture-oauth',expires_in:3600});
  if(url.endsWith(':consume')){events.push('consume');assert.equal(init.method,'POST');assert.equal(init.body,undefined);if(consumeStatus===204)payload.consumptionState=1;return new Response(null,{status:consumeStatus});}
  assert(url.includes('/purchases/products/'));return Response.json(payload);
 },{error(){},warn(){}});
 const request=async(id='gems_50',token=id,extra={})=>{events=[];const r=await handler(new Request('https://fixture.supabase.invalid/functions/v1/verify-google-play-purchase',{method:'POST',headers:{origin:'http://localhost',authorization:'Bearer fixture-auth','Content-Type':'application/json'},body:JSON.stringify({productId:id,purchaseToken:token,packageName:'com.kingsworld.app',gems:999999,...extra})}));return {status:r.status,body:await r.json()}};
 for(const [id,amount] of Object.entries(modules['play-gems'].PLAY_GEM_PRODUCTS)){
  payload=paid(id);const first=await request(id);assert.equal(first.status,200);assert.equal(first.body.credited,amount);assert.deepEqual(events,['grant','consume']);
  const again=await request(id);assert.equal(again.body.duplicate,true);assert.equal(again.body.credited,0);assert.deepEqual(events,['grant']);
 }
 assert.equal((await wallet()).gems,900);
 actor=otherAuth;assert.equal((await request('gems_50')).status,403);assert.deepEqual(events,[]);actor=auth;
 for(const patch of [{purchaseState:2},{purchaseState:1},{quantity:2},{quantity:0},{productId:'gems_500'},{consumptionState:2}]){
  payload={...paid('gems_50'),...patch};const result=await request('gems_50','invalid-'+JSON.stringify(patch));assert.equal(result.status,400);assert.deepEqual(events,[]);
 }
 payload={...paid('gems_50'),obfuscatedExternalAccountId:await playAccountId(otherAuth)};assert.equal((await request('gems_50','wrong-account')).status,403);
 payload={...paid('gems_50'),consumptionState:1};assert.equal((await request('gems_50','unknown-consumed')).status,400);assert.deepEqual(events,[]);
 payload={...paid('gems_50'),orderId:'GPA.failure'};failSave=true;assert.equal((await request('gems_50','failed-save')).status,503);assert.deepEqual(events,['grant']);failSave=false;
 payload={...paid('gems_50'),orderId:'GPA.retry'};consumeStatus=503;let result=await request('gems_50','consume-retry');assert.equal(result.body.consumptionPending,true);assert.deepEqual(events,['grant','consume']);
 consumeStatus=204;result=await request('gems_50','consume-retry');assert.equal(result.body.duplicate,true);assert.equal(result.body.consumptionPending,false);assert.equal((await wallet()).gems,950);
 const grant=(token,id='gems_100',owner=user,order=token)=>db.query('select kw_grant_play_gems($1,$2,$3,$4,$5) value',[owner,id,token,order,'sandbox']);
 const refund=async token=>(await one('select kw_refund_play_gems($1) value',[token])).value;
 await Promise.all([grant('parallel'),grant('parallel')]);assert.equal((await wallet()).gems,1050);
 await assert.rejects(()=>grant('parallel','gems_100',other),/ACCOUNT_MISMATCH/);
 await assert.rejects(()=>grant('parallel','gems_50'),/CONFLICT/);
 await assert.rejects(()=>grant('same-order','gems_100',user,'parallel'),/unique/);
 let revoked=await refund('parallel');assert.equal(revoked.reclaimed,100);assert.equal((await wallet()).gems,950);assert.equal((await refund('parallel')).duplicate,true);
 await assert.rejects(()=>grant('parallel'),/REVOKED/);
 await refund('refund-before-grant');await assert.rejects(()=>grant('refund-before-grant'),/REVOKED/);
 await grant('spent-refund');
 for(const id of ['sovereign-05','sovereign-13','sovereign-19','sovereign-21','sovereign-22','sovereign-14','sovereign-06'])await db.query('select kw_collection_buy($1,$2,$3)',[user,id,'spend-'+id]);
 assert.equal((await wallet()).gems,50);
 const ownedBefore=(await db.query('select product_id,xp from kw_player_inventory where user_id=$1 order by product_id',[user])).rows;
 revoked=await refund('spent-refund');assert.equal(revoked.reclaimed,50);assert.equal(revoked.gemDebt,50);assert.deepEqual(await wallet(),{gems:0,gem_debt:50});
 assert.deepEqual((await db.query('select product_id,xp from kw_player_inventory where user_id=$1 order by product_id',[user])).rows,ownedBefore);
 assert.equal((await one('select kw_collection_read($1) value',[user])).value.gemDebt,50);
 await assert.rejects(()=>db.query('select kw_collection_buy($1,$2,$3)',[user,'sovereign-07','no-balance']),/INSUFFICIENT_GEMS/);
 await db.query('update kw_player_wallet set gems=gems+30 where user_id=$1',[user]);assert.deepEqual(await wallet(),{gems:0,gem_debt:20});
 result=(await grant('after-refund','gems_100')).rows[0].value;assert.equal(result.refundOffset,20);assert.deepEqual(await wallet(),{gems:80,gem_debt:0});
 assert.equal((await one('select kw_collection_read($1) value',[user])).value.gemDebt,0);
 payload={...paid('gems_50'),purchaseState:1};assert.equal((await request('gems_50')).status,400);assert.deepEqual(events,['refund']);assert.equal((await wallet()).gems,30);
 assert.equal((await request('gems_50')).status,400);assert.equal((await wallet()).gems,30);
 await db.exec(await readFile(new URL('../75_SQL_PLAY_GEM_PURCHASES.sql',import.meta.url),'utf8'));assert.equal((await wallet()).gems,30);
 await db.exec('set role authenticated');await assert.rejects(()=>grant('forbidden'),/permission denied/);await assert.rejects(()=>refund('parallel'),/permission denied/);await assert.rejects(()=>db.query('select * from kw_play_gem_purchases'),/permission denied/);await db.exec('reset role');
 const report={status:'PASS',scope:'Real Edge handler and PostgreSQL/PGlite; Google/Auth/consume responses mocked; no remote billing, real money or migration application',checks:['four server-defined Gem quantities','single grant and retry after consumption failure','account/product/quantity/state validation','no consumption before durable credit','order conflict','refund once and before grant','spent refund offset on future credits','migration replay','private tables/RPCs']};
 await writeFile(new URL('../reports/cozy/play-gem-purchases.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await db.close();}
