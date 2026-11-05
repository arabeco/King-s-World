import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../lib/app-user.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const auth={id:'11111111-1111-4111-8111-111111111111',email:'qa@example.invalid',user_metadata:{username:'qa'}};
function load(select,insert){
 const module={exports:{}};
 new Function('require','module','exports',code)(name=>{
  if(name==='server-only')return {};
  if(name==='@/lib/dev-auth')return {isDevAuthEnabled:()=>false};
  if(name==='@/lib/supabase-server')return {};
  if(name==='@/lib/supabase-rest')return {supabaseSelect:select,supabaseInsertReturning:insert};
  throw Error(`Unexpected dependency ${name}`);
 },module,module.exports);return module.exports.fetchOrCreateAppUser;
}
let checks=0;const test=async(name,fn)=>{await fn();checks++;console.log('PASS',name);};
await test('Concurrent first login requests return the one canonical profile after the unique-key race',async()=>{
 let row,inserts=0;
 const fetchUser=load(async(_,params)=>params.has('auth_user_id')&&row?[row]:[],async(_,value)=>{
  inserts++;if(row)throw Error('duplicate auth_user_id');row={...value,id:'app-profile'};return [row];
 });
 const users=await Promise.all([fetchUser(auth),fetchUser(auth)]);
 assert.equal(inserts,2);assert.equal(users[0].id,'app-profile');assert.deepEqual(users[0],users[1]);assert.equal(users[1].auth_user_id,auth.id);
});
await test('An existing exact Auth profile does not cause another insert',async()=>{
 const profile={id:'existing',auth_user_id:auth.id,username:'qa'},fetchUser=load(async()=>[profile],async()=>{throw Error('Unexpected insert');});assert.equal(await fetchUser(auth),profile);
});
await test('Recovery never returns a different Auth identity or suppresses an unrelated insert failure',async()=>{
 for(const foreign of [false,true]){
  let reads=0;const error=Error('Original insert failure');
  const fetchUser=load(async(_,params)=>{if(!params.has('auth_user_id'))return [];return ++reads>1&&foreign?[{id:'foreign',auth_user_id:'other'}]:[];},async()=>{throw error;});
  await assert.rejects(()=>fetchUser(auth),e=>e===error);
 }
});
await test('Recovery bypasses a memoized empty GET after another request committed the profile',async()=>{
 let fresh=false;
 const row={id:'committed',auth_user_id:auth.id,username:'qa'};
 const fetchUser=load(async(_,params,options)=>{if(params.has('auth_user_id')&&options?.signal){fresh=true;return [row];}return [];},async()=>{throw Error('duplicate auth_user_id');});
 assert.equal((await fetchUser(auth)).id,'committed');assert.equal(fresh,true);
});
await test('A failed authoritative reread preserves the original error',async()=>{
 let reads=0;const error=Error('Original insert failure');
 const fetchUser=load(async(_,params)=>{if(params.has('auth_user_id')&&++reads>1)throw Error('Reread failed');return [];},async()=>{throw error;});
 await assert.rejects(()=>fetchUser(auth),e=>e===error);
});
await test('Different Auth identities with the same shortened username receive distinct profiles',async()=>{
 const other={...auth,id:'11111111-1111-4111-8111-222222222222',email:'other@example.invalid'};
 const original={id:'first-profile',auth_user_id:auth.id,username:'qa_111111',email:auth.email};let inserted;
 const fetchUser=load(async(_,params)=>params.get('auth_user_id')===`eq.${auth.id}`?[original]:[],async(_,value)=>{
  if(value.username===original.username)throw Error('duplicate key value violates unique constraint "users_username_key"');inserted={...value,id:'other-profile'};return [inserted];
 });
 const result=await fetchUser(other);assert.equal(result.auth_user_id,other.id);assert.equal(result.email,other.email);assert.notEqual(result.username,original.username);assert.equal(original.auth_user_id,auth.id);
});
await test('Concurrent creation of a collision fallback still returns only the same Auth identity',async()=>{
 let row;
 const fetchUser=load(async(_,params,options)=>params.has('auth_user_id')&&options?.signal&&row?[row]:[],async(_,value)=>{
  if(value.username==='qa_111111')throw Error('duplicate key value violates unique constraint "users_username_key"');if(row)throw Error('duplicate auth_user_id');row={...value,id:'fallback-profile'};return [row];
 });
 const users=await Promise.all([fetchUser(auth),fetchUser(auth)]);assert.equal(users[0].id,'fallback-profile');assert.deepEqual(users[0],users[1]);assert.equal(users[1].auth_user_id,auth.id);
});
await test('Generated and collision fallback nicknames respect the account 3–24 character policy',async()=>{
 for(const collide of [false,true]){
  let tries=0;
  const fetchUser=load(async()=>[],async(_,value)=>{if(collide&&++tries===1)throw Error('duplicate key value violates unique constraint "users_username_key"');return [{...value,id:'bounded-name'}];});
  const user=await fetchUser({...auth,user_metadata:{username:'A_very_long_new_player_display_name'}});assert.match(user.username,/^[A-Za-z0-9_]{3,24}$/);
 }
});
console.log(`PASS ${checks} app-user concurrency scenarios (local module, no remote writes).`);
