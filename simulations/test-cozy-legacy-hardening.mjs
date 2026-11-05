import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

// Execute the original checked-in legacy bodies, not a second implementation.
const sources={
 '03_SUPABASE_SCHEMA.sql':['set_updated_at'],
 '10_SQL_ONLINE_JOGAVEL_PERSISTENTE.sql':['is_friendly_target_site','enforce_capital_home_troops','validate_donation_only_resource_movement'],
 '11_SQL_PREMIUM_ENTITLEMENTS_PLAYSTORE.sql':['touch_user_entitlements_updated_at'],
 '16_SQL_CIDADES_E_5_PREDIOS_REAIS.sql':['touch_village_structure_states_updated_at'],
 '17_SQL_ESTADO_VIVO_DA_CIDADE.sql':['touch_village_city_states_updated_at'],
 '19_SQL_REI_ESCOLHIDO_PERSISTENTE.sql':['touch_world_player_king_states_updated_at'],
 '20_SQL_EXPLORACAO_PERSISTENTE.sql':['touch_world_player_exploration_states_updated_at'],
 '23_SQL_JOIN_CODE.sql':['generate_world_join_code'],
 '27_SQL_NPC_CRESCIMENTO.sql':['kw_npc_profile_growth'],
 '54_SQL_WORLD_CAP_START_AND_POWER_CACHE.sql':['kw_player_power_score'],
};
const db=await PGlite.create();let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log('PASS',name);};
const one=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
const migration=await readFile(new URL('../59_SQL_LEGACY_FUNCTION_PATHS.sql',import.meta.url),'utf8');
try{
 await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create type public.village_type as enum ('capital','colony');
  create type public.movement_type as enum ('support','transport','supply','attack');
  create table public.worlds(id uuid primary key,join_code text,capital_troop_pool_mode boolean,support_donation_only boolean);
  create table public.world_players(id uuid primary key,tribe_id uuid);
  create table public.villages(site_id uuid primary key,world_id uuid,owner_world_player_id uuid,village_type public.village_type,destroyed_at timestamptz);
  create table public.tribe_citadels(site_id uuid primary key,tribe_id uuid,status text);
  create table public.movements(id uuid primary key,world_id uuid,actor_world_player_id uuid,target_site_id uuid,movement_type public.movement_type);
  create table public.site_troop_stacks(id serial primary key,site_id uuid,owner_world_player_id uuid,stationing_type text);
  create table public.movement_resources(id serial primary key,movement_id uuid);
 `);
 for(const [file,names] of Object.entries(sources)){
  const sql=await readFile(new URL(`../${file}`,import.meta.url),'utf8');
  for(const name of names){
   const start=sql.search(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`,'i'));
   assert(start>=0,`${name} must remain available in ${file}`);
   const end=sql.indexOf('$$;',start);assert(end>start);
   await db.exec(sql.slice(start,end+3));
  }
 }
 if(process.env.COZY_LEGACY_REVIEWED_VARIANT==='remote')await db.exec(await readFile(new URL('./fixtures/legacy-reviewed-live-2026-10-31.sql',import.meta.url),'utf8'));
 await db.exec(`
  revoke all on function public.kw_player_power_score(bigint,bigint,bigint,bigint) from public;
  grant execute on function public.kw_player_power_score(bigint,bigint,bigint,bigint) to service_role;
  create trigger home_guard before insert or update on public.site_troop_stacks for each row execute function public.enforce_capital_home_troops();
  create trigger donation_guard before insert or update on public.movement_resources for each row execute function public.validate_donation_only_resource_movement();
 `);
 const fingerprints=()=>db.query(`select p.proname,pg_get_function_identity_arguments(p.oid) args,md5(p.prosrc) body,
   p.proacl,p.prosecdef,p.provolatile,p.proowner,p.prorettype from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' order by p.proname,args`);
 const before=(await fingerprints()).rows;
 await check('Legacy hardening is repeatable and preserves all twelve bodies, signatures, owners and grants',async()=>{
  assert.equal(before.length,12);await db.exec(migration);await db.exec(migration);
  assert.deepEqual((await fingerprints()).rows,before);
  const configs=(await db.query(`select proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`)).rows;
  assert.equal(configs.length,12);for(const {proconfig} of configs)assert.deepEqual(proconfig,['search_path=""']);
  assert.equal((await one(`select has_function_privilege('anon','public.kw_player_power_score(bigint,bigint,bigint,bigint)','execute') allowed`)).allowed,false);
 });
 const world=crypto.randomUUID(),actor=crypto.randomUUID(),ally=crypto.randomUUID(),enemy=crypto.randomUUID(),tribe=crypto.randomUUID();
 const home=crypto.randomUUID(),colony=crypto.randomUUID(),hostile=crypto.randomUUID(),citadel=crypto.randomUUID();
 await db.query('insert into public.worlds values($1,$2,true,true)',[world,'KW-AAAAAA']);
 for(const [id,group] of [[actor,tribe],[ally,tribe],[enemy,crypto.randomUUID()]])await db.query('insert into public.world_players values($1,$2)',[id,group]);
 for(const [site,owner,kind] of [[home,actor,'capital'],[colony,ally,'colony'],[hostile,enemy,'capital']])await db.query('insert into public.villages values($1,$2,$3,$4,null)',[site,world,owner,kind]);
 await db.query("insert into public.tribe_citadels values($1,$2,'active')",[citadel,tribe]);
 await db.exec(`
  create schema misleading;
  create table misleading.world_players(id uuid,tribe_id uuid);
  create table misleading.villages(site_id uuid,owner_world_player_id uuid,tribe_id uuid,destroyed_at timestamptz);
  create function misleading.is_friendly_target_site(uuid,uuid) returns boolean language sql as $$select true$$;
  create function misleading.now() returns timestamptz language sql as $$select '1970-01-01'::timestamptz$$;
  set search_path=misleading,public,pg_catalog,pg_temp;
 `);
 await check('Friendly targets keep own, allied and citadel access without accepting a hostile city under a caller-controlled path',async()=>{
  for(const [site,expected] of [[home,true],[colony,true],[citadel,true],[hostile,false],[crypto.randomUUID(),false]])assert.equal((await one('select public.is_friendly_target_site($1,$2) ok',[actor,site])).ok,expected);
 });
 await check('Capital troop and donation triggers preserve their restrictions under a misleading search path',async()=>{
  await db.query("insert into public.site_troop_stacks(site_id,owner_world_player_id,stationing_type) values($1,$2,'home')",[home,actor]);
  await assert.rejects(()=>db.query("insert into public.site_troop_stacks(site_id,owner_world_player_id,stationing_type) values($1,$2,'home')",[colony,ally]),/apenas (aldeia )?capital/);
  await assert.rejects(()=>db.query("insert into public.site_troop_stacks(site_id,owner_world_player_id,stationing_type) values($1,$2,'home')",[home,enemy]),/owner da stack/i);
  for(const [target,allowed] of [[colony,true],[hostile,false]]){
   const movement=crypto.randomUUID();await db.query("insert into public.movements values($1,$2,$3,$4,'support')",[movement,world,actor,target]);
   const insert=()=>db.query('insert into public.movement_resources(movement_id) values($1)',[movement]);
   if(allowed)await insert();else await assert.rejects(insert,/alvo nao amigavel/);
  }
 });
 await check('All six timestamp triggers use the database clock instead of a caller-supplied now function',async()=>{
  const names=Object.values(sources).flat().filter(n=>n==='set_updated_at'||n.startsWith('touch_'));
  assert.equal(names.length,6);
  for(const [i,name] of names.entries()){
   await db.exec(`create table public.touch_probe_${i}(id int,updated_at timestamptz);create trigger touch before insert or update on public.touch_probe_${i} for each row execute function public.${name}();`);
   const row=await one(`insert into public.touch_probe_${i} values(1,'1970-01-01') returning updated_at`);
   assert(new Date(row.updated_at).getUTCFullYear()>2020,name);
  }
 });
 await check('Join codes, NPC growth and power computations retain their existing results and numeric bounds',async()=>{
  const code=(await one('select public.generate_world_join_code() code')).code;assert.match(code,/^KW-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);assert.notEqual(code,'KW-AAAAAA');
  for(const [profile,power] of [['metropole',.55],['posto_avancado',.5],['bastiao',.45],['celeiro',.5],['unknown',.48]])assert.equal(Number((await one('select public.kw_npc_profile_growth($1) power',[profile])).power),power);
  assert.equal(Number((await one('select public.kw_player_power_score(-10,null,3,4) power')).power),22);
 });
 await check('An unreviewed legacy body aborts before changing any function configuration',async()=>{
  const original=(await one("select pg_catalog.pg_get_functiondef('public.kw_npc_profile_growth(text)'::regprocedure) body")).body;
  await db.exec(original.replace('0.55','0.56'));await db.exec('alter function public.set_updated_at() reset search_path');
  await assert.rejects(()=>db.exec(migration),/body changed/);await db.exec('rollback');
  assert.equal((await one("select proconfig from pg_catalog.pg_proc where oid='public.set_updated_at()'::regprocedure")).proconfig,null);
  assert.equal(Number((await one("select public.kw_npc_profile_growth('metropole') power")).power),.56);
  await db.exec(original);await db.exec(migration);
 });
 await check('A missing legacy signature aborts the whole hardening transaction',async()=>{
  await db.exec('alter function public.set_updated_at() reset search_path;drop function public.kw_player_power_score(bigint,bigint,bigint,bigint)');
  await assert.rejects(()=>db.exec(migration),/does not exist/);await db.exec('rollback');
  assert.equal((await one("select proconfig from pg_proc where oid='public.set_updated_at()'::regprocedure")).proconfig,null);
 });
 console.log(`PASS ${checks} legacy hardening scenarios (local PostgreSQL/PGlite; not applied remotely).`);
}finally{await db.close();}
