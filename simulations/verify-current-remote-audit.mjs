// Consumes read-only CLI audits, compares deployed SQL to an ephemeral local DB.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {createCozyDatabase} from './lib/cozy-fixture.mjs';
const db=await createCozyDatabase();
try{
 await db.exec('create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;');
 // Supabase grants newly created functions to service_role by default. Mirror
 // that platform baseline rather than flagging trigger-only RPCs as drift.
 await db.exec('alter default privileges in schema public grant execute on functions to service_role;');
 for(const file of ['11_SQL_PREMIUM_ENTITLEMENTS_PLAYSTORE.sql','22_SQL_RPC_GRANT_ENTITLEMENT.sql','63_SQL_COZY_EXPRESS_ECONOMY.sql','64_SQL_COZY_LATE_JOIN.sql','65_SQL_COZY_LOBBY.sql','66_SQL_ROYAL_ATTRIBUTES.sql','67_SQL_ACCOUNT_APPEARANCE.sql','68_SQL_COLLECTION_WALLET.sql','69_SQL_KING_GAMEPLAY_PROGRESSION.sql','70_SQL_COLLECTION_SEASON_REWARDS.sql','71_SQL_COZY_PREMIUM_BENEFITS.sql','72_SQL_PLAY_ENTITLEMENT_HARDENING.sql','73_SQL_SEASON_POSITION_REWARDS.sql','74_SQL_COMPETITIVE_WORLD_MODE.sql'])await db.exec(await readFile(new URL('../'+file,import.meta.url),'utf8'));
 const local=(await db.query("select p.proname name,p.prosrc source,pg_get_function_identity_arguments(p.oid) signature,md5(p.prosrc) hash,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') authenticated,has_function_privilege('service_role',p.oid,'execute') service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'")).rows;
 const results=[];
 for(const label of ['collection','season-rewards','competitive']){
  const text=await readFile(new URL(`../reports/cozy/current-${label}-audit.json`,import.meta.url),'utf8');
  assert(text.includes("King's World Game10 (wdmrdovkkrgzalnpqdxe)"),'Wrong remote project');
  const audit=JSON.parse(text.slice(text.indexOf('{'))).rows[0].audit;
  for(const f of audit.functions){
   const match=local.find(p=>p.name===f.name&&(!f.signature||p.signature===f.signature));assert(match,f.name+' missing locally');
   const hash=text=>createHash('md5').update(text).digest('hex');
   // The deployed scripts were submitted with Windows CRLF. Accept only that
   // serialization difference, never arbitrary whitespace or semantic changes.
   assert([match.hash,hash(match.source.replace(/\r?\n/g,'\r\n')),hash(match.source.replace(/\r\n/g,'\n'))].includes(f.hash??f.body_hash),f.name+' remote body differs from current migration');
   for(const permission of ['anon','authenticated','service'])assert.equal(f[permission],match[permission],f.name+' '+permission);
   results.push({name:f.name,body:'MATCH',permissions:'MATCH'});
  }
  if(audit.tables)assert(audit.tables.every(t=>t.exists));
  if(label==='competitive')assert(audit.column_exists);
 }
 const report={status:'PASS',at:new Date().toISOString(),project:'wdmrdovkkrgzalnpqdxe',scope:'Read-only production SQL/PostgREST audit against current local migration definitions; no remote writes, users/worlds created or app deployment',functions:results,pendingSqlChanges:0};
 await writeFile(new URL('../reports/cozy/current-remote-readiness.json',import.meta.url),JSON.stringify(report,null,2));
 console.log('PASS remote SQL bodies and permissions:',results.length,'checks; no pending changes through migration 74');
}finally{await db.close();}
