import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCozyDatabase} from './lib/cozy-fixture.mjs';
const db=await createCozyDatabase();
try{
 for(const name of ['63_SQL_COZY_EXPRESS_ECONOMY.sql','65_SQL_COZY_LOBBY.sql'])await db.exec(await readFile(new URL('../'+name,import.meta.url),'utf8'));
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
 const user=(await one("insert into users(username,email) values('unified','unified@test.invalid') returning id")).id;
 const old=(await one("select kw_cozy_create_economic($1,'Old','express') result",[user])).result.id;
 const sql=await readFile(new URL('../76_SQL_COZY_UNIFIED_RHYTHM.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 for(const mode of ['normal','express']){
  const id=(await one("select kw_cozy_create_lobby($1,'Unified',$2,null) result",[user,mode])).result.id;
  await db.query('select kw_cozy_start($1,$2)',[id,user]);
  const r=await one('select economy_version,speed_multiplier,extract(epoch from ends_at-starts_at)/86400 days from worlds where id=$1',[id]);
  assert.equal(r.economy_version,3);assert.equal(r.speed_multiplier,mode==='express'?4:1);assert.equal(Number(r.days),mode==='express'?30:120);
  await assert.rejects(db.query('update worlds set economy_version=2 where id=$1',[id]),/IMMUTABLE/);
 }
 assert.equal((await one('select economy_version from worlds where id=$1',[old])).economy_version,2);
 const acl=await one("select has_function_privilege('anon','kw_cozy_create_unified(uuid,text,text)','execute') anon,has_function_privilege('service_role','kw_cozy_create_unified(uuid,text,text)','execute') service");assert.equal(acl.anon,false);assert.equal(acl.service,true);
 console.log('PASS unified v3 creation through lobby, Normal 120 days / Express 30 at x4, immutable existing worlds, replay and private RPC permissions.');
}finally{await db.close();}
