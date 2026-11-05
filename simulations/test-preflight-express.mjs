import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCozyDatabase} from './lib/cozy-fixture.mjs';
const db=await createCozyDatabase();
try {
 for(const file of ['63_SQL_COZY_EXPRESS_ECONOMY.sql','64_SQL_COZY_LATE_JOIN.sql','65_SQL_COZY_LOBBY.sql','66_SQL_ROYAL_ATTRIBUTES.sql']) await db.exec(await readFile(new URL('../'+file,import.meta.url),'utf8'));
 const one=async(sql,args=[]) => (await db.query(sql,args)).rows[0];
 const user=(await one("insert into users(username,email) values('preflight','preflight@test.invalid') returning id")).id;
 const created=(await one("select kw_cozy_create_lobby($1,'Expresso de teste','express',null) result",[user])).result;
 const mode=await one('select season_mode,economy_version from worlds where id=$1',[created.id]);assert.equal(mode.season_mode,'express');assert.equal(mode.economy_version,2);
 const slot=(await one('select id from world_players where world_id=$1 and user_id=$2',[created.id,user])).id;
 const attrs=(await one('select kw_royal_attributes_save($1,6,5,5,0) result',[user])).result;assert.equal(attrs.administration,6);
 await db.query('select kw_cozy_start($1,$2)',[created.id,user]);
 const world=await one('select extract(epoch from ends_at-starts_at)/86400 days,status from worlds where id=$1',[created.id]);assert.equal(Number(world.days),30);assert.equal(world.status,'running');assert.ok(slot);
 for(const fn of ['kw_royal_attributes_save(uuid,integer,integer,integer,bigint)','kw_cozy_create_lobby(uuid,text,text,text)','kw_cozy_join(uuid,uuid,text)']){const acl=await one("select has_function_privilege('anon',$1,'execute') anon,has_function_privilege('service_role',$1,'execute') service",[fn]);assert.equal(acl.anon,false);assert.equal(acl.service,true);}
 console.log('PASS Fresh local schema 63–66: Express creation, royal points, start, 30-day clock and RPC privileges');
} finally {await db.close();}
