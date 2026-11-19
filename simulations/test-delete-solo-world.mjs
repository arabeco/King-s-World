import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCozyFoundingDatabase} from './lib/cozy-founding-fixture.mjs';
const db=await createCozyFoundingDatabase({persistent:true});
try{
 // The local fixture uses a restrictive FK; the application schema has ON DELETE CASCADE.
 await db.exec('alter table world_players drop constraint world_players_world_id_fkey; alter table world_players add constraint world_players_world_id_fkey foreign key(world_id) references worlds(id) on delete cascade');
 await db.exec(await readFile(new URL('../82_SQL_DELETE_SOLO_WORLD.sql',import.meta.url),'utf8'));
 const a=(await db.query("insert into users(username,email) values('owner','owner@example.test') returning id")).rows[0].id;
 const b=(await db.query("insert into users(username,email) values('visitor','visitor@example.test') returning id")).rows[0].id;
 const create=async(name,owner)=>{const row=(await db.query("insert into worlds(slug,name,created_by_user_id,rules_version) values($1,$1,$2,2) returning id",[name,owner])).rows[0];await db.query("insert into world_players(world_id,user_id) values($1,$2)",[row.id,owner]);return row.id;};
 const solo=await create('solo',a);
 await assert.rejects(()=>db.query('select kw_delete_solo_cozy_world($1,$2)',['solo',b]),/WORLD_DELETE_OWNER_REQUIRED/);
 assert.equal((await db.query('select count(*)::int n from worlds where id=$1',[solo])).rows[0].n,1);
 await db.query('select kw_delete_solo_cozy_world($1,$2)',['solo',a]);
 assert.equal((await db.query('select count(*)::int n from worlds where id=$1',[solo])).rows[0].n,0);
 const shared=await create('shared',a);await db.query('insert into world_players(world_id,user_id) values($1,$2)',[shared,b]);
 await assert.rejects(()=>db.query('select kw_delete_solo_cozy_world($1,$2)',['shared',a]),/WORLD_DELETE_SHARED/);
 await db.query('update world_players set is_ai=null where world_id=$1 and user_id=$2',[shared,b]);
 await assert.rejects(()=>db.query('select kw_delete_solo_cozy_world($1,$2)',['shared',a]),/WORLD_DELETE_SHARED/);
 assert.equal((await db.query('select count(*)::int n from world_players where world_id=$1',[shared])).rows[0].n,2);
 assert.equal((await db.query("select has_function_privilege('authenticated','public.kw_delete_solo_cozy_world(text,uuid)','execute') allowed")).rows[0].allowed,false);
 console.log('PASS exclusão solo: só criador, sem outros jogadores, preserva mundo compartilhado e RPC privada.');
}finally{await db.close();}
