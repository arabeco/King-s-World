import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCozyDatabase} from './lib/cozy-fixture.mjs';
const db=await createCozyDatabase();
try{
 for(const file of ['67_SQL_ACCOUNT_APPEARANCE.sql','68_SQL_COLLECTION_WALLET.sql','69_SQL_KING_GAMEPLAY_PROGRESSION.sql','70_SQL_COLLECTION_SEASON_REWARDS.sql'])await db.exec(await readFile(new URL('../'+file,import.meta.url),'utf8'));
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
 const user=(await one("insert into users(username,email) values('prize','prize@test.invalid') returning id")).id;
 const collection=async()=>(await one('select kw_collection_read($1) value',[user])).value;
 let sequence=0;
 async function season({mode='express',score=1500,seal=true,ai=false,days=121,humans=1,rank=1}={}){
  const world=(await one("insert into worlds(slug,name,rules_version,season_mode,status,starts_at,phase_2_starts_at,ends_at) values($1,'Prize world',2,$2,'running',now()-$3*interval '1 day',now()+interval '20 days',now()+interval '120 days') returning id",['prize-'+sequence++,mode,days])).id;
  const player=(await one('insert into world_players(world_id,user_id,is_ai) values($1,$2,$3) returning id',[world,user,ai])).id;
  for(let i=1;i<humans;i++){const u=(await one('insert into users(username,email) values($1,$2) returning id',['guest-'+sequence+'-'+i,'guest-'+sequence+'-'+i+'@test.invalid'])).id;const guest=(await one('insert into world_players(world_id,user_id,is_ai) values($1,$2,false) returning id',[world,u])).id;const position=i>=rank?i+1:i;await db.query("insert into kw_cozy_rewards(world_id,user_id,world_player_id,world_name,player_name,finished,final_rank,final_score) values($1,$2,$3,'Prize world','Guest',true,$4,1600)",[world,u,guest,position]);}
  await db.query("insert into kw_cozy_rewards(world_id,user_id,world_player_id,world_name,player_name,finished,final_rank,final_score,portal_crossed_at) values($1,$2,$3,'Prize world','Tester',true,$4,$5,$6)",[world,user,player,rank,score,seal?new Date():null]);
  return world;
 }
 async function close(world){await db.query("update worlds set status='finalized' where id=$1",[world]);}
 assert.equal((await collection()).gems,0);
 const w=await season();assert.equal((await collection()).gems,0,'A finished player result alone cannot grant a reward before world finalization');
 await close(w);let c=await collection();assert.equal(c.gems,15);assert.equal(c.seasonRewards[0].productIds.length,1);assert.equal(c.inventory.find(i=>i.id==='sovereign-01').xp,0);assert.equal(c.seasonRewards.length,1);
 await close(w);await db.query('update kw_cozy_rewards set finished=true where world_id=$1',[w]);assert.equal((await collection()).gems,15);
 const classic=await season({mode:'classic'});await close(classic);c=await collection();assert.equal(c.gems,75);assert.equal(c.seasonRewards[0].productIds.length,1);assert(c.inventory.some(i=>i.id==='item-master-hammer'));assert(c.inventory.some(i=>i.id==='item-seed-sack'));
 const rank=await season({humans:5});await close(rank);assert.equal((await collection()).gems,93,'Ranking bonus requires five humans');
 const participation=await season({score:500,seal:false});await close(participation);assert.equal((await collection()).gems,98);
 for(const options of [{score:499,seal:false},{days:1},{mode:'classic',days:30},{ai:true}])await close(await season(options));
 assert.equal((await collection()).gems,98,'Low progress, early closure and NPCs earn no currency');
 await db.exec(await readFile(new URL('../70_SQL_COLLECTION_SEASON_REWARDS.sql',import.meta.url),'utf8'));assert.equal((await collection()).gems,98);
 const second=await season();await close(second);assert.equal((await collection()).gems,115);assert.equal((await collection()).seasonRewards[0].productIds.length,0);
 const rarity=async world=>(await one('select c.rarity from kw_collection_season_rewards r join kw_collection_catalog c on c.product_id=r.product_ids[1] where r.world_id=$1 and r.user_id=$2',[world,user])).rarity;
 assert.equal(await rarity(rank),'rare');
 const epic=await season({humans:10});await close(epic);assert.equal(await rarity(epic),'epic');
 const uncommon=await season({humans:10,rank:4});await close(uncommon);assert.equal(await rarity(uncommon),'uncommon');
 assert.equal((await one('select max(cardinality(product_ids)) n from kw_collection_season_rewards')).n,1,'At most one item in either mode');
 const rollback=await season();const beforeRollback=(await collection()).gems;
 await db.exec('begin');await close(rollback);assert((await collection()).gems>beforeRollback);await db.exec('rollback');assert.equal((await collection()).gems,beforeRollback);
 // Complete inventory: repeat wins convert the otherwise duplicate item into Gemas.
 await db.query("insert into kw_player_inventory(user_id,product_id,source) select $1,product_id,'test' from kw_collection_catalog where kind='equipment' on conflict do nothing",[user]);
 const complete=await season();await close(complete);assert.equal((await collection()).gems,beforeRollback+17);
 await db.exec('set role authenticated');await assert.rejects(()=>db.query('select * from kw_collection_season_rewards'),/permission denied/);await assert.rejects(()=>db.query('select kw_collection_award_season($1,$2)',[w,user]),/permission denied/);await db.exec('reset role');
 console.log('PASS season rewards: real-time eligibility, completed world, solo/group prizes, Normal/Express normalization, progressive items, no end XP, no replay, NPC rejection and private permissions');
}finally{await db.close();}
