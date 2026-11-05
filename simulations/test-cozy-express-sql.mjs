import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCozyDatabase} from './lib/cozy-fixture.mjs';
const db=await createCozyDatabase();
try {
 const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
 const user=(await one("insert into users(username,email) values('rhythm','rhythm@test.invalid') returning id")).id;
 const old=(await one("select kw_cozy_create($1,'Old express','express') result",[user])).result.id;
 const acl=async()=>await one("select md5(string_agg((to_jsonb(p)-'prosrc')::text,'' order by p.oid)) hash from pg_proc p where proname in ('kw_cozy_create','kw_cozy_start','kw_cozy_commit')");
 const before=await acl();const sql=await readFile(new URL('../62_SQL_COZY_EXPRESS_RHYTHM.sql',import.meta.url),'utf8');
 await db.exec(sql);assert.deepEqual(await acl(),before);await db.exec(sql);assert.deepEqual(await acl(),before);
 const fresh=(await one("select kw_cozy_create($1,'New express','express') result",[user])).result.id;
 for(const [id,speed,days] of [[old,4,30],[fresh,2,60]]) {
  await db.query('select kw_cozy_start($1,$2)',[id,user]);
  const r=await one('select speed_multiplier,extract(epoch from ends_at-starts_at)/86400 days from worlds where id=$1',[id]);
  assert.equal(r.speed_multiplier,speed);assert.equal(Number(r.days),days);
 }
 console.log('PASS: SQL candidate idempotence, metadata/ACL preserved, old Express 30 days and new Express 60 days');
} finally {await db.close();}
