import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
import {createCozyDatabase} from './lib/cozy-fixture.mjs';
const {seasonRankXp}=loadCozyEngine('king-progression');
const db=await createCozyDatabase();let serial=0;
try{
 for(const f of ['67_SQL_ACCOUNT_APPEARANCE.sql','68_SQL_COLLECTION_WALLET.sql','69_SQL_KING_GAMEPLAY_PROGRESSION.sql','70_SQL_COLLECTION_SEASON_REWARDS.sql'])await db.exec(await readFile(new URL('../'+f,import.meta.url),'utf8'));
 const sql=await readFile(new URL('../73_SQL_SEASON_POSITION_REWARDS.sql',import.meta.url),'utf8');
 const one=async(q,args=[])=>(await db.query(q,args)).rows[0];
 async function setup({humans=5,rank=1,mode='express',score=1500,seal=true,days=121,partial=false,xp=[300,100]}={}){
  const n=++serial,w=(await one("insert into worlds(slug,name,rules_version,season_mode,status,starts_at,phase_2_starts_at,ends_at) values($1,'Rank prizes',2,$2,'running',now()-$3*interval '1 day',now()+interval '10 days',now()+interval '20 days') returning id",['rank-'+n,mode,days])).id;
  const people=[];
  for(let i=0;i<humans;i++){
   const u=(await one("insert into users(username,email) values($1,$2) returning id",['rank-'+n+'-'+i,'rank-'+n+'-'+i+'@test.invalid'])).id;
   const p=(await one('insert into world_players(world_id,user_id) values($1,$2) returning id',[w,u])).id;people.push({u,p});await db.query('select kw_collection_read($1)',[u]);
  }
  const {u,p}=people[0];
  for(const [i,earned] of xp.entries())if(earned){const id='sovereign-0'+(i+1);await db.query('insert into kw_king_xp_events(world_player_id,revision,product_id,xp) values($1,$2,$3,$4)',[p,i+1,id,earned]);await db.query('update kw_player_inventory set xp=xp+$1 where user_id=$2 and product_id=$3',[earned,u,id]);}
  async function result(i){const person=people[i],place=i===0?rank:i>=rank?i+1:i;await db.query("insert into kw_cozy_rewards(world_id,user_id,world_player_id,world_name,player_name,finished,final_rank,final_score,portal_crossed_at) values($1,$2,$3,'Rank prizes','Player',true,$4,$5,$6)",[w,person.u,person.p,place,i===0?score:1600,i===0&&seal?new Date():null]);}
  for(let i=0;i<people.length-(partial?1:0);i++)await result(i);
  return {w,u,p,people,result};
 }
 const prize=async f=>await one('select * from kw_collection_season_rewards where world_id=$1 and user_id=$2',[f.w,f.u]);
 const xp=async(f,id)=>(await one('select xp from kw_player_inventory where user_id=$1 and product_id=$2',[f.u,id])).xp;
 const close=async f=>db.query("update worlds set status='finalized' where id=$1",[f.w]);
 // Receipts already paid by v1 are never repaid or granted new XP.
 const old=await setup();await close(old);const oldXp=await xp(old,'sovereign-01');await db.exec(sql);await db.query('select kw_collection_award_season($1,$2)',[old.w,old.u]);assert.equal((await prize(old)).rules_version,1);assert.equal(await xp(old,'sovereign-01'),oldXp);
 for(const [humans,rank,percent,tier,gems] of [[5,1,10,'rare',18],[5,2,5,'uncommon',17],[5,3,0,'uncommon',16],[10,1,10,'epic',18],[20,5,10,'rare',15],[20,10,5,'uncommon',15],[20,13,0,'common',15],[4,1,0,'common',15]]){
  const f=await setup({humans,rank});await close(f);const r=await prize(f);
  assert.equal(r.rules_version,2);assert.equal(r.place,rank);assert.equal(r.participants,humans);assert.equal(r.xp_percent,percent);assert.equal(r.rarity,tier);assert.equal(r.gems,gems);assert.equal(r.product_ids.length,1);
  assert.equal(r.participation_gems+r.victory_gems+r.placement_gems+r.conversion_gems,r.gems);
  assert.equal(await xp(f,'sovereign-01'),300+seasonRankXp(300,rank,humans));assert.equal(await xp(f,'sovereign-02'),100+percent);assert.equal(await xp(f,'sovereign-03'),0,'Final account selection cannot divert the XP');
  const before=await xp(f,'sovereign-01');await db.query('select kw_collection_award_season($1,$2)',[f.w,f.u]);assert.equal(await xp(f,'sovereign-01'),before);assert.deepEqual(await prize(f),r);
 }
 const participant=await setup({seal:false,score:800});await close(participant);const participation=await prize(participant);assert.equal(participation.gems,5);assert.equal(participation.product_ids.length,0);assert.equal(participation.king_xp['sovereign-01'],30,'Earned ranking merit does not require a victory seal');
 const noProgress=await setup({xp:[]});await close(noProgress);assert.deepEqual((await prize(noProgress)).king_xp,{});
 const normal=await setup({mode:'classic',xp:[1200,400]});await close(normal);assert.equal((await prize(normal)).gems,72);assert.deepEqual((await prize(normal)).king_xp,{'sovereign-01':120,'sovereign-02':40});assert.equal((await prize(normal)).product_ids.length,1);
 for(const options of [{days:1},{mode:'classic',days:30},{seal:false,score:499}]){const f=await setup(options);await close(f);assert.equal(await prize(f),undefined);}
 const partial=await setup({partial:true});await close(partial);assert.equal(await prize(partial),undefined,'Incomplete ranking cannot freeze an award');await partial.result(4);assert.equal((await prize(partial)).participants,5);assert.equal((await prize(partial)).rarity,'rare');assert.equal((await prize(partial)).king_xp['sovereign-01'],30);

 const rounded=await setup({xp:[307,11]});await close(rounded);assert.deepEqual((await prize(rounded)).king_xp,{'sovereign-01':30,'sovereign-02':1});
 const complete=await setup();await db.query("insert into kw_player_inventory(user_id,product_id,source) select $1,product_id,'test' from kw_collection_catalog where kind='equipment' on conflict do nothing",[complete.u]);await close(complete);const converted=await prize(complete);assert.equal(converted.product_ids.length,0);assert.equal(converted.conversion_gems,2);assert.equal(converted.gems,20);assert.equal(converted.king_xp['sovereign-01'],30);
 const tied=await setup();await db.query('update kw_cozy_rewards set final_rank=1 where world_id=$1 and user_id=$2',[tied.w,tied.people[1].u]);await close(tied);assert.equal((await prize(tied)).place,1);assert.equal((await prize(tied)).xp_percent,10);
 const npc=await setup({humans:4});const fake=(await one("insert into users(username,email) values('rank-npc','rank-npc@test.invalid') returning id")).id;const fakeMember=(await one('insert into world_players(world_id,user_id,is_ai) values($1,$2,true) returning id',[npc.w,fake])).id;await db.query("insert into kw_cozy_rewards(world_id,user_id,world_player_id,world_name,player_name,finished,final_rank,final_score) values($1,$2,$3,'NPC','NPC',true,1,2500)",[npc.w,fake,fakeMember]);await close(npc);assert.equal((await prize(npc)).participants,4);assert.equal((await prize(npc)).xp_percent,0);assert.equal(await one('select 1 from kw_collection_season_rewards where world_id=$1 and user_id=$2',[npc.w,fake]),undefined);
 const rollback=await setup();await db.exec('begin');await close(rollback);assert(await prize(rollback));await db.exec('rollback');assert.equal(await prize(rollback),undefined);assert.equal(await xp(rollback,'sovereign-01'),300);
 await db.exec(sql);await db.query('select kw_collection_award_season($1,$2)',[normal.w,normal.u]);assert.equal(await xp(normal,'sovereign-01'),1320);
 await db.exec('set role authenticated');await assert.rejects(()=>db.query('select kw_collection_award_season($1,$2)',[normal.w,normal.u]),/permission denied/);await assert.rejects(()=>db.query('select * from kw_collection_season_rewards'),/permission denied/);await db.exec('reset role');
 console.log('PASS v2 rank prizes: thresholds, per-king actual XP, Normal/Express, no seal merit, no progress denial, one item, old receipt preservation, complete ranking, replay, rollback and permissions');
}catch(e){console.error(e.message,e.where??'');process.exitCode=1;}finally{await db.close();}
