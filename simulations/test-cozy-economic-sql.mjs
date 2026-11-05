import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCozyDatabase} from './lib/cozy-fixture.mjs';
for(const with62 of [false,true]){
 const db=await createCozyDatabase();try{
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
 const id=(await one("insert into users(username,email) values('economic','eco@test.invalid') returning id")).id;
 const create=async(name,mode='express')=>(await one('select kw_cozy_create($1,$2,$3) result',[id,name,mode])).result.id;
 const old=await create('Old');let middle;
 if(with62){await db.exec(await readFile(new URL('../62_SQL_COZY_EXPRESS_RHYTHM.sql',import.meta.url),'utf8'));middle=await create('Middle');}
 const snapshot=async()=>await one("select md5(string_agg((to_jsonb(p)-'prosrc')::text,'' order by p.oid)) hash from pg_proc p where proname in ('kw_cozy_create','kw_cozy_start','kw_cozy_commit')");
 const before=await snapshot(),sql=await readFile(new URL('../63_SQL_COZY_EXPRESS_ECONOMY.sql',import.meta.url),'utf8');
 await db.exec(sql);assert.deepEqual(await snapshot(),before);await db.exec(sql);assert.deepEqual(await snapshot(),before);
 const legacyAfter=await create('Legacy after upgrade');
 const fresh=(await one("select kw_cozy_create_economic($1,'New','express') result",[id])).result.id;
 const legacyContract=await one('select economy_version,speed_multiplier from worlds where id=$1',[legacyAfter]);assert.equal(legacyContract.economy_version,1);assert.equal(legacyContract.speed_multiplier,with62?2:4);const classic=await create('Classic','normal');
 for(const [world,eco,speed,days] of [[old,1,4,30],...(middle?[[middle,1,2,60]]:[]),[fresh,2,1,30],[classic,1,1,120]]){
  await db.query('select kw_cozy_start($1,$2)',[world,id]);
  const r=await one('select economy_version,speed_multiplier,extract(epoch from ends_at-starts_at)/86400 days from worlds where id=$1',[world]);
  assert.equal(r.economy_version,eco);assert.equal(r.speed_multiplier,speed);assert.equal(Number(r.days),days);
 }
 const permission=await one("select has_function_privilege('anon','kw_cozy_create_economic(uuid,text,text)','execute') anon,has_function_privilege('service_role','kw_cozy_create_economic(uuid,text,text)','execute') service");assert.equal(permission.anon,false);assert.equal(permission.service,true);
 await assert.rejects(db.query('update worlds set economy_version=1 where id=$1',[fresh]),/IMMUTABLE/);
 console.log('PASS economy SQL, with 62:',with62,'old clocks preserved, new Express 30 days, classic 120, idempotence, ACL and version guard');
 }finally{await db.close();}
}
