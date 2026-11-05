// Real Edge handler + real entitlement SQL; Google/auth/ack network is fixture-only.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {createCozyDatabase} from './lib/cozy-fixture.mjs';
const db=await createCozyDatabase();
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const parser={exports:{}};new Function('module','exports',compile(await readFile(new URL('../supabase/functions/_shared/play-subscription.ts',import.meta.url),'utf8')))(parser,parser.exports);
const {parsePlaySubscription,playAccountId}=parser.exports;
try{
 await db.exec('create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;');
 for(const file of ['11_SQL_PREMIUM_ENTITLEMENTS_PLAYSTORE.sql','22_SQL_RPC_GRANT_ENTITLEMENT.sql','72_SQL_PLAY_ENTITLEMENT_HARDENING.sql'])await db.exec(await readFile(new URL('../'+file,import.meta.url),'utf8'));
 const auth='00000000-0000-4000-8000-000000000001',foreignAuth='00000000-0000-4000-8000-000000000002';
 const user=(await db.query("insert into users(username,email,auth_user_id) values('play-user','play@test.invalid',$1) returning id",[auth])).rows[0].id;
 await db.query("insert into users(username,email,auth_user_id) values('play-foreign','play-other@test.invalid',$1)",[foreignAuth]);
 assert.notEqual(auth,user,'Authentication and game profile IDs are deliberately different');
 let actor=auth,events=[],payload,failSave=false,ackStatus=200,googleStatus=200,handler;
 const expiry=new Date(Date.now()+86400000).toISOString();const accountId=await playAccountId(auth);assert.equal(accountId.length,64);
 const active=()=>({subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',externalAccountIdentifiers:{obfuscatedExternalAccountId:accountId},lineItems:[{productId:'premium_monthly',expiryTime:expiry,autoRenewingPlan:{autoRenewEnabled:true}}]});
 payload=active();
 const rpcArgs=p=>[p.p_user_id,p.p_provider,p.p_product_id,p.p_purchase_token,p.p_order_id,p.p_status,p.p_store_environment,p.p_started_at,p.p_expires_at,p.p_auto_renewing,p.p_will_renew,p.p_raw_payload];
 const sql='select grant_kw_entitlement($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) value';
 const client={auth:{getUser:async token=>({data:{user:token==='fixture-auth'?{id:actor}:null},error:token==='fixture-auth'?null:{}})},
  from(table){const filters={};const builder={select(){return builder;},eq(key,value){filters[key]=value;return builder;},async maybeSingle(){
   try{const result=table==='users'?await db.query('select id,account_status,deletion_requested_at from users where auth_user_id=$1',[filters.auth_user_id]):await db.query('select user_id from user_entitlements where provider=$1 and purchase_token=$2',[filters.provider,filters.purchase_token]);return {data:result.rows[0]??null,error:null};}catch(e){return {data:null,error:{message:e.message}};}
  }};return builder;},
  async rpc(name,p){assert.equal(name,'grant_kw_entitlement');events.push('grant');if(failSave)return {data:null,error:{message:'private database details'}};try{return {data:(await db.query(sql,rpcArgs(p))).rows[0].value,error:null};}catch(e){return {data:null,error:{message:e.message}};}}
 };
 class FakeJWT{setProtectedHeader(){return this;}setIssuer(){return this;}setSubject(){return this;}setAudience(){return this;}setIssuedAt(){return this;}setExpirationTime(){return this;}async sign(){return 'fixture-signed-jwt';}}
 const env={SUPABASE_URL:'https://fixture.supabase.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',GOOGLE_PLAY_PACKAGE_NAME:'com.kingsworld.app',GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:'fixture@test.invalid',private_key:'fixture-key'})};
 const gemSource=await readFile(new URL('../supabase/functions/_shared/play-gems.ts',import.meta.url),'utf8');
 const edge={exports:{}};
 new Function('require','module','exports','Deno','fetch','console',compile(await readFile(new URL('../supabase/functions/verify-google-play-purchase/index.ts',import.meta.url),'utf8')))(name=>{
  if(name.includes('std@'))return {serve:fn=>{handler=fn;}};
  if(name.includes('supabase-js'))return {createClient:()=>client};
  if(name.startsWith('npm:jose'))return {SignJWT:FakeJWT,importPKCS8:async()=>({})};
  if(name.includes('play-subscription'))return parser.exports;
  if(name.includes('play-gems')){const module={exports:{}};new Function('module','exports',compile(gemSource))(module,module.exports);return module.exports;}
  throw Error('Unexpected Edge import '+name);
 },edge,edge.exports,{env:{get:key=>env[key]}},async url=>{
  if(url.includes('oauth2.googleapis.com'))return Response.json({access_token:'fixture-google-token',expires_in:3600});
  if(url.endsWith(':acknowledge')){events.push('ack');return new Response(null,{status:ackStatus});}
  assert(url.includes('/purchases/subscriptionsv2/'));return Response.json(payload,{status:googleStatus});
 },{error(){},warn(){},log(){}});
 const request=async({token='fixture-purchase-token',origin='http://localhost',authorization='Bearer fixture-auth',body}={})=>{
  events=[];const response=await handler(new Request('https://fixture.supabase.invalid/functions/v1/verify-google-play-purchase',{method:'POST',headers:{origin,authorization,'Content-Type':'application/json'},body:JSON.stringify(body??{productId:'premium_monthly',purchaseToken:token,packageName:'com.kingsworld.app'})}));return {status:response.status,body:await response.json()};
 };
 let result=await request();assert.equal(result.status,200);assert.equal(result.body.premiumActive,true);assert.deepEqual(events,['grant','ack']);
 assert.equal((await db.query('select user_id from user_entitlements')).rows[0].user_id,user);
 result=await request();assert.equal(result.body.duplicate,true);assert.equal((await db.query('select count(*) n from user_entitlements')).rows[0].n,1);
 actor=foreignAuth;assert.equal((await request()).status,403);assert.deepEqual(events,[]);actor=auth;
 failSave=true;result=await request({token:'failed-credit'});assert.equal(result.status,503);assert.deepEqual(events,['grant']);assert(!JSON.stringify(result).includes('private database'));failSave=false;
 payload={...active(),subscriptionState:'SUBSCRIPTION_STATE_CANCELED'};result=await request();assert.equal(result.body.premiumActive,true);assert.equal(result.body.status,'canceled');
 payload={...active(),subscriptionState:'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'};assert.equal((await request()).body.premiumActive,true);
 payload={...active(),subscriptionState:'SUBSCRIPTION_STATE_ON_HOLD'};assert.equal((await request()).body.premiumActive,false);assert.deepEqual(events,['grant']);
 payload={...active(),lineItems:[{productId:'premium_monthly',expiryTime:new Date(Date.now()-1).toISOString()}]};assert.equal((await request()).body.premiumActive,false);assert.deepEqual(events,['grant']);
 payload={...active(),lineItems:[{productId:'another_product',expiryTime:expiry}]};assert.equal((await request()).status,400);assert.deepEqual(events,[]);
 payload={...active(),lineItems:[{productId:'premium_monthly'}]};assert.equal((await request()).status,400);
 payload=active();delete payload.externalAccountIdentifiers;assert.equal((await request({token:'unbound-purchase'})).status,403);assert.equal((await request()).status,200,'Legacy restore requires a matching existing owner');
 payload=active();ackStatus=500;assert.equal((await request()).status,200,'Credit survives acknowledgement retry');ackStatus=200;
 assert.equal((await request({origin:'https://king-s-world.vercel.app.attacker.invalid'})).status,403);
 assert.equal((await request({authorization:'Bearer invalid'})).status,401);
 assert.equal((await request({body:{productId:'premium_monthly',purchaseToken:{fake:true}}})).status,400);
 const now=Date.now();for(const state of ['SUBSCRIPTION_STATE_PENDING','SUBSCRIPTION_STATE_PAUSED','SUBSCRIPTION_STATE_EXPIRED','SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED'])assert.equal(parsePlaySubscription({...active(),subscriptionState:state},'premium_monthly',now).active,false);
 assert.throws(()=>parsePlaySubscription({...active(),subscriptionState:'UNKNOWN'},'premium_monthly'),/UNKNOWN_SUBSCRIPTION_STATE/);
 const direct={p_user_id:user,p_provider:'google_play',p_product_id:'premium_monthly',p_purchase_token:'parallel-first-token',p_order_id:null,p_status:'active',p_store_environment:'sandbox',p_started_at:null,p_expires_at:expiry,p_auto_renewing:true,p_will_renew:true,p_raw_payload:{}};
 const pair=await Promise.all([db.query(sql,rpcArgs(direct)),db.query(sql,rpcArgs(direct))]);assert.deepEqual(pair.map(r=>r.rows[0].value.duplicate),[false,true]);
 await assert.rejects(()=>db.query(sql,rpcArgs({...direct,p_user_id:auth})),/APP_USER_REQUIRED/);
 await assert.rejects(()=>db.query(sql,rpcArgs({...direct,p_expires_at:null})),/EXPIRY_REQUIRED/);
 await db.exec('set role authenticated');await assert.rejects(()=>db.query(sql,rpcArgs(direct)),/permission denied/);await db.exec('reset role');
 console.log('PASS Play verifier + real SQL: distinct auth/profile IDs, account binding, exact product/expiry, canceled/grace/hold, credit before ack, retries, failed credit, old owned restore, CORS and private RPC. No Google/Play/production calls.');
}finally{await db.close();}
