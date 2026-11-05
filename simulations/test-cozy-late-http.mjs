import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createCozyDatabase,startCozyRest} from './lib/cozy-fixture.mjs';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),db=await createCozyDatabase();
await db.exec(await readFile(path.join(root,'64_SQL_COZY_LATE_JOIN.sql'),'utf8'));
const rest=await startCozyRest(db),port=3327,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{cwd:root,windowsHide:true,env:{...process.env,NEXT_DIST_DIR:'.next-late-test',NEXT_PUBLIC_SUPABASE_URL:rest.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-public',SUPABASE_SECRET_KEY:'fixture-service',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'},stdio:'ignore'});
const request=async(url,who,body)=>{const res=await fetch(base+url,{method:body?'POST':'GET',headers:{cookie:`kw_dev_auth=${who}`,'x-kw-smoke':'1','content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()};};
try{
 for(let i=0;i<90;i++){try{await fetch(base+'/login');break}catch{if(i===89)throw Error('Startup timeout');await new Promise(r=>setTimeout(r,1000));}}
 const created=await request('/api/worlds/create','1',{name:'Entrada no reino',mode:'normal'});assert.equal(created.status,200,JSON.stringify(created.data));
 const {slug,joinCode}=created.data.world;
 const initial=await request(`/api/worlds/${slug}/cozy`,'1');assert.equal(initial.status,200);
 const worldId=initial.data.world.id;
 const npc=(await db.query("insert into users(username,email) values('npc-test','npc-test@invalid') returning id")).rows[0].id;
 const slot=(await db.query('insert into world_players(world_id,user_id,is_ai) values($1,$2,true) returning id',[worldId,npc])).rows[0].id;
 const engine=loadCozyEngine(),start=engine.createCozyState(initial.data.world,slot,'NPC',Date.now()).cities[0];
 await db.query('select kw_cozy_reserve_late_slot($1,$2,$3,$4)',[worldId,slot,start.q,start.r]);
 const started=await request(`/api/worlds/${slug}/cozy`,'1',{action:{type:'start_world'},requestId:crypto.randomUUID()});assert.equal(started.status,200,JSON.stringify(started.data));
 await db.query("insert into kw_cozy_late_join_config(world_id,deadline) values($1,now()+interval '1 day')",[worldId]);
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:360,height:740},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-kw-smoke':'1'}});
  await context.addCookies([{name:'kw_dev_auth',value:'late',url:base}]);
  const page=await context.newPage();await page.goto(base+'/lobby',{waitUntil:'networkidle'});
  await page.locator('[data-smoke="join-code-input"]').fill(joinCode);
  const response=page.waitForResponse(r=>r.url().endsWith('/api/worlds/join')&&r.request().method()==='POST');
  await page.locator('[data-smoke="join-code-submit"]').tap();assert.equal((await response).status(),200);
  await page.waitForURL(`**/world/${slug}/**`);
  await context.close();
 }finally{await browser.close();}
 const payload=await request(`/api/worlds/${slug}/cozy`,'late');assert.equal(payload.status,200,JSON.stringify(payload.data));
 assert.equal(payload.data.state.playerId,slot);assert.equal(payload.data.computed.influence.total,0);
 assert.deepEqual([payload.data.state.cities[0].q,payload.data.state.cities[0].r],[start.q,start.r]);
 const reloaded=await request(`/api/worlds/${slug}/cozy`,'late');assert.equal(reloaded.data.state.playerId,slot);assert.deepEqual([reloaded.data.state.cities[0].q,reloaded.data.state.cities[0].r],[start.q,start.r]);
 const second=await request('/api/worlds/join','another',{code:joinCode});assert.equal(second.status,409);assert.match(second.data.error,/não há reinos disponíveis/i);
 console.log('PASS Local mobile lobby join, reserved capital, zero influence, reload and full slot');
}finally{server.kill();await rest.close();await db.close();}
