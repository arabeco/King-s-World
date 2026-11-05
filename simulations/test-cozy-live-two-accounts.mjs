// Explicitly authorized live QA: real Auth + production-mode local Next + real Supabase.
// Creates only tagged throwaway users/worlds, then deletes exactly those records.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('..',import.meta.url));
nextEnv.loadEnvConfig(root,false,{info(){},error(){}});
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(url).hostname,'wdmrdovkkrgzalnpqdxe.supabase.co','Refusing another project');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;assert(key);
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(30000)})}});
const reports=path.join(root,'reports/cozy');await mkdir(reports,{recursive:true});
const tag=`cozyqa_${randomUUID().slice(0,8)}`,base='http://127.0.0.1:3320';
const users=[0,1].map(i=>({email:`${tag}_${i}@example.invalid`,password:`A9!${randomUUID()}`,name:`${tag}_${i}`}));
const manifest={tag,project:'wdmrdovkkrgzalnpqdxe',authUsers:[],appUsers:[],worlds:[],cleaned:false};
const result={status:'RUNNING',scope:'Local production-mode web app + real Supabase Auth/REST/SQL persistence; not a published app or Android',project:manifest.project,checks:[],cleanup:null};
const saveManifest=()=>writeFile(path.join(reports,'live-two-accounts-cleanup.json'),JSON.stringify(manifest,null,2));
const redact=message=>users.reduce((text,u)=>text.replaceAll(u.password,'[REDACTED]'),String(message)).replaceAll(key,'[REDACTED]');
const ok=(value,message)=>{if(value?.error)throw Error(`${message}: ${value.error.code??'ERROR'} ${value.error.message??''}`);return value.data;};
const tables=['worlds','world_players','kw_cozy_world_states','kw_cozy_player_states','kw_cozy_commands','kw_cozy_rewards','users'];
async function fingerprints(){
 const all={};
 for(const table of tables){
  const rows=ok(await admin.from(table).select('*'),`Read ${table}`);
  const canonical=rows.map(row=>JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))))).sort();
  all[table]={count:rows.length,sha256:createHash('sha256').update(JSON.stringify(canonical)).digest('hex')};
 }
 return all;
}
const before=await fingerprints();await saveManifest();
let server,browser,log='',failure;
try{
 for(const user of users){
  // Admin createUser does not send mail; email_confirm avoids a confirmation flow.
  const data=ok(await admin.auth.admin.createUser({email:user.email,password:user.password,email_confirm:true,user_metadata:{username:user.name}}),'Create QA Auth user');
  user.authId=data.user.id;manifest.authUsers.push(user.authId);await saveManifest();
 }
 server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3320'],{cwd:root,windowsHide:true,env:{...process.env,NODE_ENV:'production',NEXT_DIST_DIR:'.next-build'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',b=>{log=(log+b).slice(-100000);});server.stderr.on('data',b=>{log=(log+b).slice(-100000);});
 for(let i=0;i<60;i++){try{const r=await fetch(base+'/login',{signal:AbortSignal.timeout(2000)});if(r.ok&&log.includes('Ready in'))break;}catch{}if(i===59)throw Error('Production QA server did not start');await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({headless:true});
 const login=async(user)=>{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.setDefaultTimeout(30000);
  await page.goto(base+'/login',{waitUntil:'networkidle'});assert.equal(await page.getByRole('button',{name:'Entrar como dev',exact:true}).count(),0,'Dev auth must be absent');
  await page.getByPlaceholder('Email',{exact:true}).fill(user.email);await page.getByPlaceholder('Senha',{exact:true}).fill(user.password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL('**/lobby',{timeout:60000,waitUntil:'domcontentloaded'});
  assert.equal((await context.cookies()).some(c=>c.name==='kw_dev_auth'),false);
  const profile=ok(await admin.from('users').select('id,auth_user_id').eq('auth_user_id',user.authId).single(),'Profile after real login');
  user.appId=profile.id;if(!manifest.appUsers.includes(profile.id)){manifest.appUsers.push(profile.id);await saveManifest();}
  return {context,page};
 };
 let a=await login(users[0]),b=await login(users[1]);
 assert.notEqual(users[0].authId,users[1].authId);assert.notEqual(users[0].appId,users[1].appId);result.checks.push('Two distinct real Auth logins and app profiles, no dev auth');
 const api=async(session,route,body)=>{
  const response=body?await session.context.request.post(base+route,{data:body}):await session.context.request.get(base+route);
  return {status:response.status(),data:await response.json()};
 };
 const made=await api(a,'/api/worlds/create',{name:`QA ${tag}`,mode:'express'});assert.equal(made.status,200,'World creation');
 const slug=made.data.world.slug,world=ok(await admin.from('worlds').select('id,created_by_user_id').eq('slug',slug).single(),'Find QA world');
 assert.equal(world.created_by_user_id,users[0].appId);manifest.worlds.push(world.id);await saveManifest();
 const route=`/api/worlds/${slug}/cozy`,command=(s,action,requestId=randomUUID())=>api(s,route,{action,requestId});
 assert.equal((await api(b,route)).status,403,'Non-member cannot read world state');
 assert.equal((await api(b,'/api/worlds/join',{code:made.data.world.joinCode})).status,200);
 assert.equal((await command(b,{type:'start_world'})).status,403,'Guest cannot start owner world');
 assert.equal((await command(a,{type:'start_world'})).status,200);
 const av=(await api(a,route)).data,bv=(await api(b,route)).data;assert.notEqual(av.state.playerId,bv.state.playerId);assert.equal(av.world.id,bv.world.id);
 result.checks.push('Invite membership, foreign read denial, owner-only start and isolated actor IDs');
 const group=await command(a,{type:'alliance_create',name:'Guarda QA'});assert.equal(group.status,200);
 assert.equal((await command(b,{type:'alliance_join',allianceId:group.data.state.allianceId})).status,200);
 const action={type:'recruit',troop:'militia',amount:5},receipt=randomUUID();
 const pair=await Promise.all([command(a,action,receipt),command(a,action,receipt)]);for(const r of pair)assert.equal(r.status,200);
 const recruited=(await api(a,route)).data;assert.equal(recruited.state.army.militia,av.state.army.militia+5,'Concurrent duplicate must recruit once');
 assert.equal((await api(b,route)).data.state.army.militia,bv.state.army.militia,'Army must belong to its account');
 assert.equal((await command(b,{type:'upgrade',cityId:av.state.cities[0].id,sector:'economy'})).status,422,'Guest cannot upgrade another city');
 result.checks.push('Concurrent duplicate receipt spends once; armies and city commands stay account-scoped');
 const project=await command(a,{type:'alliance_project_start',kind:'provisions'});assert.equal(project.status,200);
 const projectId=project.data.shared.allianceProjects.at(-1).id;
 const contributions=await Promise.all([command(a,{type:'alliance_project_contribute',projectId,resource:'materials',amount:50}),command(b,{type:'alliance_project_contribute',projectId,resource:'materials',amount:50})]);
 for(const r of contributions)assert.equal(r.status,200);
 const persisted=(await api(a,route)).data,p=persisted.shared.allianceProjects.find(p=>p.id===projectId);
 assert.equal(p.contributions[persisted.state.playerId].materials,50);assert.equal(p.contributions[bv.state.playerId].materials,50);
 result.checks.push('Both real sessions contribute to one persistent shared alliance project without lost writes');
 const supportRequest=await command(a,{type:'support_request'});assert.equal(supportRequest.status,200);
 const request=supportRequest.data.shared.support.at(-1),offer=(await api(b,route)).data.computed.supportOffer;
 const supportSent=await command(b,{type:'support_send',requestId:request.id});assert.equal(supportSent.status,200);
 assert.equal(supportSent.data.shared.support.find(s=>s.id===request.id).power,offer);
 const towerView=(await api(b,route)).data,tower=[...towerView.computed.sanctuaries].sort((a,b)=>a.supplyCost-b.supplyCost)[0];
 assert(tower.supplyCost<=towerView.state.resources.supplies,'Normal starting balance should fund one nearby tower recognition');
 const expedition=await command(b,{type:'sanctuary_explore',sanctuaryId:tower.id});assert.equal(expedition.status,200);
 assert(expedition.data.state.orders.some(o=>o.sanctuaryId===tower.id));assert.equal((await api(a,route)).data.state.orders.some(o=>o.sanctuaryId===tower.id),false);
 result.checks.push('Real ally support confirmation and a paid tower expedition persist without exposing another player orders');

 await a.context.close();a=await login(users[0]);await a.page.goto(`${base}/world/${slug}/intelligence`,{waitUntil:'networkidle'});
 await a.page.getByRole('navigation',{name:'Áreas do reino'}).waitFor();const reopened=(await api(a,route)).data;
 assert.equal(reopened.state.playerId,av.state.playerId);assert.equal(reopened.state.army.militia,av.state.army.militia+5);assert.equal(reopened.state.allianceId,group.data.state.allianceId);
 assert.equal(reopened.shared.allianceProjects.find(p=>p.id===projectId).contributions[bv.state.playerId].materials,50);
 assert.equal(reopened.shared.support.find(s=>s.id===request.id).power,offer);
 await b.context.close();b=await login(users[1]);const reopenedGuest=(await api(b,route)).data;
 assert(reopenedGuest.state.orders.some(o=>o.sanctuaryId===tower.id));assert.equal(reopenedGuest.state.playerId,bv.state.playerId);
 result.checks.push('Fresh real logins preserve accepted support and the second player pending tower expedition');

 assert.equal(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await a.page.screenshot({path:path.join(reports,'live-two-accounts-reopened-390.png')});
 result.checks.push('Closing the full browser context and logging in again restores world, army, alliance and other player contribution');
 await b.context.close();await a.context.close();assert(!log.includes('users_auth_user_id_key'),'First-login requests must not crash on duplicate profile creation');result.status='PASS';
}catch(error){failure=error;result.status='FAIL';result.error=redact(error.message);}
finally{
 if(browser)await browser.close().catch(()=>{});if(server)server.kill();
 const errors=[];
 try{
  // Recover created app profiles even if login/world response failed after committing.
  if(manifest.authUsers.length){
   const profiles=ok(await admin.from('users').select('id,auth_user_id').in('auth_user_id',manifest.authUsers),'Find QA profiles for cleanup');
   assert(profiles.every(p=>manifest.authUsers.includes(p.auth_user_id)));
   manifest.appUsers=[...new Set([...manifest.appUsers,...profiles.map(p=>p.id)])];
  }
  if(manifest.appUsers.length){
   const owned=ok(await admin.from('worlds').select('id,created_by_user_id').in('created_by_user_id',manifest.appUsers),'Find QA worlds for cleanup');
   for(const w of owned){assert(manifest.appUsers.includes(w.created_by_user_id));ok(await admin.from('worlds').delete().eq('id',w.id).eq('created_by_user_id',w.created_by_user_id),'Delete QA world');}
   for(const id of manifest.appUsers)ok(await admin.from('users').delete().eq('id',id).in('auth_user_id',manifest.authUsers),'Delete QA profile');
  }
  for(const id of manifest.authUsers)ok(await admin.auth.admin.deleteUser(id),'Delete QA Auth user');
  const after=await fingerprints();result.dataBefore=before;result.dataAfter=after;assert.deepEqual(after,before,'Pre-existing game data must stay unchanged after QA cleanup');
  manifest.cleaned=true;result.cleanup='PASS: only QA users/worlds removed; pre-existing table fingerprints preserved';
 }catch(error){errors.push(redact(error.message));result.status='FAIL';result.cleanup=errors;}
 await saveManifest();await writeFile(path.join(reports,'live-two-accounts.json'),JSON.stringify({...result,at:new Date().toISOString()},null,2));
 await writeFile(path.join(reports,'live-two-accounts-server.log'),redact(log));
 console.log(JSON.stringify({status:result.status,scope:result.scope,checks:result.checks,cleanup:result.cleanup,...(result.error?{error:result.error}:{})},null,2));
 if(failure||errors.length)process.exitCode=1;
}
