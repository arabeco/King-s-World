import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createCozyDatabase} from './lib/cozy-fixture.mjs';
const db=await createCozyDatabase();
try{
 for(const name of ['67_SQL_ACCOUNT_APPEARANCE.sql','68_SQL_COLLECTION_WALLET.sql','69_SQL_KING_GAMEPLAY_PROGRESSION.sql','70_SQL_COLLECTION_SEASON_REWARDS.sql','73_SQL_SEASON_POSITION_REWARDS.sql'])await db.exec(await readFile(new URL('../'+name,import.meta.url),'utf8'));
 const user=(await db.query("insert into users(username,email) values('migration-wallet','migration@test.invalid') returning id")).rows[0].id;
 await db.query('select kw_collection_read($1)',[user]);await db.query('update kw_player_wallet set gems=100 where user_id=$1',[user]);
 await db.query("select kw_collection_buy($1,'sovereign-05','before-75')",[user]);
 const tables=['users','worlds','world_players','kw_cozy_player_states','kw_cozy_world_states','kw_player_wallet','kw_player_inventory','kw_gem_transactions','kw_king_xp_events','kw_collection_season_rewards'];
 const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async table=>[table,(await db.query(`select md5(coalesce(string_agg((to_jsonb(t)-'gem_debt')::text,'' order by (to_jsonb(t)-'gem_debt')::text),'')) hash from public.${table} t`)).rows[0].hash])));
 const before=await snapshot(),sql=await readFile(new URL('../75_SQL_PLAY_GEM_PURCHASES.sql',import.meta.url),'utf8');
 await db.exec('begin;');await db.exec(sql.replace(/^begin;/,'').replace(/commit;\s*$/,''));
 await db.query("select kw_grant_play_gems($1,'gems_50','rollback-token','GPA.rollback','sandbox')",[user]);
 await db.query("select kw_refund_play_gems('rollback-token')");await db.exec('rollback;');
 assert.deepEqual(await snapshot(),before);assert.equal((await db.query("select to_regclass('public.kw_play_gem_purchases') table_name")).rows[0].table_name,null);
 await db.exec(sql);assert.deepEqual(await snapshot(),before);assert.equal((await db.query('select gem_debt from kw_player_wallet where user_id=$1',[user])).rows[0].gem_debt,0);
 await db.query("select kw_grant_play_gems($1,'gems_50','applied-token','GPA.applied','sandbox')",[user]);
 const after=await snapshot();await db.exec(sql);assert.deepEqual(await snapshot(),after);
 const report={status:'PASS',scope:'Local PostgreSQL/PGlite only, migration 75 trial/rollback/apply/replay with existing account, wallet, ownership and transaction; no production writes',preserved:tables};
 await writeFile(new URL('../reports/cozy/gem-migration-rollback.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await db.close();}
