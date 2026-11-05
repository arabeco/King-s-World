import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCozyDatabase} from './lib/cozy-fixture.mjs';
const db=await createCozyDatabase();
try{
 await db.exec(await readFile(new URL('../66_SQL_ROYAL_ATTRIBUTES.sql',import.meta.url),'utf8'));
 const user=(await db.query("insert into users(username,email) values('royal','royal@test.invalid') returning id")).rows[0].id;
 const save=async(a,c,e,r)=>(await db.query('select kw_royal_attributes_save($1,$2,$3,$4,$5) as result',[user,a,c,e,r])).rows[0].result;
 let result=await save(6,5,5,0);assert.equal(result.revision,1);
 await assert.rejects(save(7,5,5,1),/ROYAL_INVALID_POINTS/);
 await assert.rejects(save(5,5,5,0),/ROYAL_REVISION_CONFLICT/);
 result=await save(10,1,5,1);assert.equal(result.revision,2);
 await assert.rejects(save(11,0,5,2),/ROYAL_INVALID_POINTS/);
 const world=(await db.query("insert into worlds(slug,name) values('royal','Royal') returning id")).rows[0].id;
 const player=(await db.query('insert into world_players(world_id,user_id) values($1,$2) returning id',[world,user])).rows[0].id;
 await db.query("insert into kw_cozy_rewards(world_id,user_id,world_player_id,world_name,player_name,finished,xp) values($1,$2,$3,'Royal','Royal',true,19600)",[world,user,player]);
 result=await save(10,10,10,2);assert.equal(result.revision,3);
 await db.exec('set role authenticated');try{await assert.rejects(db.query('select * from kw_royal_attributes'),/permission denied/i);}finally{await db.exec('reset role');}
 console.log('PASS Level 1 gets one point, cap 10, level 15 gets 30 total, stale saves and RLS');
}finally{await db.close();}
