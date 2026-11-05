import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCozyDatabase} from './lib/cozy-fixture.mjs';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const db=await createCozyDatabase();
try{
 await db.exec('create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;');
 for(const file of ['11_SQL_PREMIUM_ENTITLEMENTS_PLAYSTORE.sql','63_SQL_COZY_EXPRESS_ECONOMY.sql','64_SQL_COZY_LATE_JOIN.sql','65_SQL_COZY_LOBBY.sql','71_SQL_COZY_PREMIUM_BENEFITS.sql'])await db.exec(await readFile(new URL('../'+file,import.meta.url),'utf8'));
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];let sequence=0;
 const user=async()=>{const n=sequence++;return (await one('insert into users(username,email) values($1,$2) returning id',['premium-'+n,'premium-'+n+'@test.invalid'])).id;};
 const create=async(u,password=null)=>(await one("select kw_cozy_create_lobby($1,'Premium test','express',$2) value",[u,password])).value;
 const benefits=async u=>(await one('select kw_premium_benefits($1) value',[u])).value;
 const grant=async(u,status='active',expires='1 day',product='premium_monthly')=>db.query("insert into user_entitlements(user_id,provider,product_id,purchase_token,status,expires_at) values($1,'google_play',$2,$3,$4,now()+$5::interval)",[u,product,'fixture-'+sequence++,status,expires]);
 const free=await user(),premium=await user();
 assert.deepEqual(await benefits(free),{active:false,worldLimit:1,activeWorlds:0,canCreate:true,canPasswordWorld:false,adFree:false});
 await assert.rejects(()=>create(free,'fixture-password'),/PASSWORD_PREMIUM_REQUIRED/);assert.equal((await benefits(free)).activeWorlds,0);
 const first=await create(free);const worldCount=(await one('select count(*) n from worlds')).n;
 await assert.rejects(()=>create(free),/ACTIVE_WORLD_LIMIT/);assert.equal((await one('select count(*) n from worlds')).n,worldCount,'Failed create leaves no orphan');
 assert(await one('select kw_cozy_join($1,$2,null) id',[first.id,free]));
 await grant(premium,'canceled');assert.equal((await benefits(premium)).active,true,'Cancellation retains access until expiry');
 const worlds=[];for(let i=0;i<5;i++)worlds.push(await create(premium,i===0?'fixture-password':null));
 assert.equal((await benefits(premium)).activeWorlds,5);await assert.rejects(()=>create(premium),/ACTIVE_WORLD_LIMIT/);
 await db.query("update user_entitlements set expires_at=now()-interval '1 second' where user_id=$1",[premium]);
 assert.equal((await benefits(premium)).worldLimit,1);assert(await one('select kw_cozy_join($1,$2,null) id',[worlds[0].id,premium]));
 await db.query('update kw_cozy_lobby_settings set password_hash=password_hash where world_id=$1',[worlds[0].id]);
 await assert.rejects(()=>db.query('update kw_cozy_lobby_settings set password_hash=$1 where world_id=$2',['new-hash',worlds[0].id]),/PASSWORD_PREMIUM_REQUIRED/);
 await assert.rejects(()=>create(premium),/ACTIVE_WORLD_LIMIT/);
 await db.query("update worlds set status='finalized' where id=$1",[first.id]);assert.equal((await benefits(free)).activeWorlds,0);
 const race=await Promise.allSettled([create(free),create(free)]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal((await benefits(free)).activeWorlds,1);
 const owner=await user(),late=await create(owner),npc=await user();
 const slot=(await one('insert into world_players(world_id,user_id,is_ai) values($1,$2,true) returning id',[late.id,npc])).id;
 await db.query('select kw_cozy_reserve_late_slot($1,$2,0,0)',[late.id,slot]);await db.query('select kw_cozy_start($1,$2)',[late.id,owner]);
 await db.query("insert into kw_cozy_late_join_config(world_id,deadline) values($1,now()+interval '1 day')",[late.id]);
 await assert.rejects(()=>db.query('select kw_cozy_join($1,$2,$3)',[late.id,free,late.join_code]),/ACTIVE_WORLD_LIMIT/);
 assert.equal((await one('select is_ai from world_players where id=$1',[slot])).is_ai,true);assert.equal((await one('select claimed_by from kw_cozy_late_join_slots where world_player_id=$1',[slot])).claimed_by,null);
 for(const [status,expires,product,expected] of [['active','-1 day','premium_monthly',false],['active','1 day','gem_50',false],['revoked','1 day','premium_monthly',false],['grace_period','1 day','premium_monthly',true]]){
  const u=await user();await grant(u,status,expires,product);assert.equal((await benefits(u)).active,expected);
 }
 const policy=loadCozyEngine('premium-policy');const now=Date.now();
 for(const status of ['active','grace_period','canceled','pending','paused','expired','on_hold','revoked'])for(const expiry of [null,'invalid',new Date(now-1).toISOString(),new Date(now+10000).toISOString()]){
  const expected=['active','grace_period','canceled'].includes(status)&&expiry!==null&&Date.parse(expiry)>now;
  assert.equal(policy.premiumIsActive(status,expiry,now),expected);
 }
 await db.exec('set role authenticated');await assert.rejects(()=>benefits(free),/permission denied/);await db.exec('reset role');
 console.log('PASS Premium: 1/5 worlds, no orphan creation, serialized double request, canceled expiry, invalid products, password ownership, retained worlds, late-slot rollback, SQL/client policy and private RPC');
}finally{await db.close();}
