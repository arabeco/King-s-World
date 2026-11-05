import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCozyDatabase} from './lib/cozy-fixture.mjs';
const db=await createCozyDatabase();
try{
 for(const file of ['67_SQL_ACCOUNT_APPEARANCE.sql','68_SQL_COLLECTION_WALLET.sql','69_SQL_KING_GAMEPLAY_PROGRESSION.sql'])await db.exec(await readFile(new URL('../'+file,import.meta.url),'utf8'));
 const user=(await db.query("insert into users(username,email) values('kingxp','kingxp@test.invalid') returning id")).rows[0].id;
 const world=(await db.query("insert into worlds(slug,name,rules_version,season_mode) values('kingxp-world','King XP',2,'express') returning id")).rows[0].id;
 const player=(await db.query('insert into world_players(world_id,user_id) values($1,$2) returning id',[world,user])).rows[0].id;
 const read=async()=>(await db.query('select kw_collection_read($1) value',[user])).rows[0].value;
 const stats=async king=>(await db.query('select kw_king_stats($1,$2) value',[user,king])).rows[0].value;
 await read();
 const state={king:{profileId:'builder',sovereignId:'sovereign-02',alive:true,attributes:{administration:8,command:4,exploration:3}}};
 await db.query('insert into kw_cozy_player_states(world_player_id,world_id,user_id,state_json,influence,revision) values($1,$2,$3,$4,0,1)',[player,world,user,JSON.stringify(state)]);
 async function advance(value,king='sovereign-02'){state.king.sovereignId=king;await db.query('update kw_cozy_player_states set influence=$1,state_json=$2,revision=revision+1 where world_player_id=$3',[value,JSON.stringify(state),player]);}
 await advance(125);assert.equal((await stats('sovereign-02')).xp,25);assert.equal((await stats('sovereign-02')).level,2);assert.equal((await stats('sovereign-01')).xp,0);
 await advance(125);await advance(25);await advance(125);assert.equal((await stats('sovereign-02')).xp,25);
 await advance(130);assert.equal((await stats('sovereign-02')).xp,26);
 await advance(135,'sovereign-03');assert.equal((await stats('sovereign-03')).xp,1);assert.equal((await stats('sovereign-02')).xp,26);
 await assert.rejects(()=>advance(140,'sovereign-21'),/KING_NOT_OWNED/);

 // Progress made with a vacant throne or dead king belongs to no later king.
 const vacancyUser=(await db.query("insert into users(username,email) values('vacantxp','vacantxp@test.invalid') returning id")).rows[0].id;
 const vacancyWorld=(await db.query("insert into worlds(slug,name,rules_version,season_mode) values('vacant-xp','Vacant throne',2,'express') returning id")).rows[0].id;
 const vacancyPlayer=(await db.query('insert into world_players(world_id,user_id) values($1,$2) returning id',[vacancyWorld,vacancyUser])).rows[0].id;
 const vacancyState={king:{profileId:null,sovereignId:'sovereign-01',alive:true,attributes:{administration:5,command:5,exploration:5}}};
 await db.query('insert into kw_cozy_player_states(world_player_id,world_id,user_id,state_json,influence,revision) values($1,$2,$3,$4,0,1)',[vacancyPlayer,vacancyWorld,vacancyUser,JSON.stringify(vacancyState)]);
 const vacancyStats=async(id='sovereign-01')=>(await db.query('select kw_king_stats($1,$2) value',[vacancyUser,id])).rows[0].value;
 async function vacancyAdvance(score){await db.query('update kw_cozy_player_states set influence=$1,state_json=$2,revision=revision+1 where world_player_id=$3',[score,JSON.stringify(vacancyState),vacancyPlayer]);}
 await vacancyAdvance(125);await vacancyAdvance(150);await vacancyAdvance(125);vacancyState.king.profileId='builder';await vacancyAdvance(125);assert.equal((await vacancyStats()).xp,0,'A newly selected king cannot collect pre-coronation influence');
 await vacancyAdvance(130);assert.equal((await vacancyStats()).xp,0);await vacancyAdvance(155);assert.equal((await vacancyStats()).xp,1);vacancyState.king.alive=false;await vacancyAdvance(200);assert.equal((await vacancyStats()).xp,1);
 vacancyState.king.alive=true;vacancyState.king.sovereignId='sovereign-02';await vacancyAdvance(200);assert.equal((await vacancyStats('sovereign-02')).xp,0,'A successor cannot collect influence earned while the predecessor was dead');
 await vacancyAdvance(205);assert.equal((await vacancyStats('sovereign-02')).xp,1);await vacancyAdvance(100);await vacancyAdvance(205);assert.equal((await vacancyStats('sovereign-02')).xp,1);
 console.log('PASS vacant/dead throne progression advances the world high-water mark without awarding retroactive XP to the first king or successor');
 const before=await stats('sovereign-02');assert.equal(before.available,1);
 await db.query('select kw_king_add_stat($1,$2,$3,$4)',[user,'sovereign-02','administration',0]);
 assert.equal((await stats('sovereign-02')).attributes.administration,9);assert.equal((await stats('sovereign-02')).available,0);
 await assert.rejects(()=>db.query('select kw_king_add_stat($1,$2,$3,$4)',[user,'sovereign-02','command',0]),/REVISION_CONFLICT/);
 await assert.rejects(()=>db.query('select kw_king_add_stat($1,$2,$3,$4)',[user,'sovereign-02','command',1]),/NO_POINTS/);
 await assert.rejects(()=>db.query('select kw_king_add_stat($1,$2,$3,$4)',[user,'sovereign-02','reset',1]),/INVALID_STAT/);
 assert.equal((await db.query('select state_json from kw_cozy_player_states where world_player_id=$1',[player])).rows[0].state_json.king.attributes.administration,8);
 await db.query("insert into kw_cozy_rewards(world_id,user_id,world_player_id,world_name,player_name,finished,xp) values($1,$2,$3,'King XP','Tester',true,999)",[world,user,player]);assert.equal((await stats('sovereign-02')).xp,26);
 await db.exec(await readFile(new URL('../69_SQL_KING_GAMEPLAY_PROGRESSION.sql',import.meta.url),'utf8'));await advance(135,'sovereign-03');assert.equal((await stats('sovereign-03')).xp,1);
 // A Normal world spans four Express seasons: equal XP per calendar time.
 await db.query("update worlds set season_mode='classic' where id=$1",[world]);
 await advance(140,'sovereign-03');assert.equal((await stats('sovereign-03')).xp,5);
 for(const [xp,level] of [[0,1],[25,2],[2025,10],[999999,10]]){await db.query('update kw_player_inventory set xp=$1 where user_id=$2 and product_id=$3',[xp,user,'sovereign-01']);assert.equal((await stats('sovereign-01')).level,level);}

 // Five allowed worlds accrue to the selected king, never stack reign bonuses or replay XP.
 const multiUser=(await db.query("insert into users(username,email) values('multiworldxp','multiworldxp@test.invalid') returning id")).rows[0].id;
 await db.query('select kw_collection_read($1)',[multiUser]);const worlds=[];
 for(let index=0;index<5;index++){
  const wid=(await db.query("insert into worlds(slug,name,rules_version,season_mode) values($1,'Multi-world XP',2,'express') returning id",['multi-xp-'+index])).rows[0].id;
  const pid=(await db.query('insert into world_players(world_id,user_id) values($1,$2) returning id',[wid,multiUser])).rows[0].id;
  const snapshot={king:{profileId:'builder',sovereignId:'sovereign-01',alive:true,attributes:{administration:5,command:5,exploration:5}}};
  await db.query('insert into kw_cozy_player_states(world_player_id,world_id,user_id,state_json,influence,revision) values($1,$2,$3,$4,0,1)',[pid,wid,multiUser,JSON.stringify(snapshot)]);worlds.push({pid,snapshot});
 }
 const multiStats=async(id='sovereign-01')=>(await db.query('select kw_king_stats($1,$2) value',[multiUser,id])).rows[0].value;
 for(const score of [500,1000,1500])for(const {pid} of worlds)await db.query('update kw_cozy_player_states set influence=$1,revision=revision+1 where world_player_id=$2',[score,pid]);
 assert.equal((await multiStats()).xp,1500);assert.equal((await multiStats()).level,8);
 for(const score of [0,1500])for(const {pid} of worlds)await db.query('update kw_cozy_player_states set influence=$1,revision=revision+1 where world_player_id=$2',[score,pid]);assert.equal((await multiStats()).xp,1500);
 const successor=structuredClone(worlds[0].snapshot);successor.king.sovereignId='sovereign-02';
 await db.query('update kw_cozy_player_states set influence=1505,state_json=$1,revision=revision+1 where world_player_id=$2',[JSON.stringify(successor),worlds[0].pid]);assert.equal((await multiStats('sovereign-02')).xp,1);assert.equal((await multiStats()).xp,1500);
 for(const {pid,snapshot} of worlds)await db.query('update kw_cozy_player_states set influence=2500,state_json=$1,revision=revision+1 where world_player_id=$2',[JSON.stringify(snapshot),pid]);
 assert.equal((await multiStats()).xp,2499);assert.equal((await multiStats()).level,10);
 for(let point=0;point<9;point++)await db.query('select kw_king_add_stat($1,$2,$3,$4)',[multiUser,'sovereign-01',point<5?'administration':'command',point]);
 const capped=await multiStats();assert.deepEqual(capped.attributes,{administration:10,command:9,exploration:5});assert.equal(capped.available,0);
 await assert.rejects(()=>db.query('select kw_king_add_stat($1,$2,$3,$4)',[multiUser,'sovereign-01','exploration',9]),/NO_POINTS/);
 for(const {pid} of worlds){const frozen=(await db.query('select state_json from kw_cozy_player_states where world_player_id=$1',[pid])).rows[0].state_json;assert.deepEqual(frozen.king.attributes,{administration:5,command:5,exploration:5});}
 console.log('PASS five-world progression: 1500 XP/level 8 at five 1500-score Express worlds, per-king succession isolation, no regain farming, level 10/24-point cap and all existing reign snapshots frozen');
 await db.exec('set role authenticated');await assert.rejects(()=>stats('sovereign-02'),/permission denied/);await assert.rejects(()=>db.query('select * from kw_king_xp_events'),/permission denied/);await db.exec('reset role');
 console.log('PASS live gameplay XP: selected king, no replay/regain farming, succession, unowned denial, permanent points, CAS, no overspend/reset, frozen reign stats, no season XP, migration replay and permissions');
}finally{await db.close();}
