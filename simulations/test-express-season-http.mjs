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
 await db.exec(await readFile(path.join(root,'63_SQL_COZY_EXPRESS_ECONOMY.sql'),'utf8'));await db.exec(await readFile(path.join(root,'66_SQL_ROYAL_ATTRIBUTES.sql'),'utf8'));
 for(let i=0;i<90;i++){try{await fetch(base+'/login');break}catch{if(i===89)throw Error('Startup timeout');await new Promise(r=>setTimeout(r,1000));}}
 const created=await request('/api/worlds/create','1',{name:'Expresso completo',mode:'express'});assert.equal(created.status,200,JSON.stringify(created.data));const slug=created.data.world.slug;
 const cmd=async action=>request(`/api/worlds/${slug}/cozy`,'1',{action,requestId:crypto.randomUUID()});
 const start=await cmd({type:'start_world'});assert.equal(start.status,200,JSON.stringify(start.data));
 const choice=await cmd({type:'king_choose',profileId:'builder',nickname:'Rei'});assert.equal(choice.status,200,JSON.stringify(choice.data));assert.equal(choice.data.computed.influence.total,0);
 const city=choice.data.state.cities[0].id;
 const plan=await cmd({type:'plan_upgrade',cityId:city,sector:'economy',steps:2});assert.equal(plan.status,200,JSON.stringify(plan.data));assert.equal(plan.data.state.orders.filter(o=>o.kind==='upgrade').length,2);
 const target=Date.now()-31*86400000,oldStart=Date.parse((await db.query('select runtime_anchor_started_at from worlds where id=$1',[start.data.world.id])).rows[0].runtime_anchor_started_at),shift=target-oldStart;
 await db.query('update worlds set starts_at=$2,runtime_anchor_started_at=$2 where id=$1',[start.data.world.id,new Date(target).toISOString()]);
 const records=(await db.query('select world_player_id,state_json from kw_cozy_player_states where world_id=$1',[start.data.world.id])).rows;
 for(const record of records){const s=record.state_json;for(const key of ['createdAt','settledAt','citySystemsAt'])if(typeof s[key]==='number')s[key]+=shift;for(const order of s.orders){for(const key of ['createdAt','arrivesAt'])if(typeof order[key]==='number')order[key]+=shift;if(order.planned?.startsAt)order.planned.startsAt+=shift;}await db.query('update kw_cozy_player_states set state_json=$2 where world_player_id=$1',[record.world_player_id,JSON.stringify(s)]);}
 const final=await request(`/api/worlds/${slug}/cozy`,'1');assert.equal(final.status,200,JSON.stringify(final.data));assert.equal(final.data.world.status,'finalized');assert.equal(final.data.computed.readOnly,true);assert.equal(final.data.state.orders.filter(o=>o.kind==='upgrade').length,0);
 const score=final.data.computed.influence.total;assert.equal(final.data.state.finalScore,score);const history=await request('/api/me/cozy','1');assert.equal(history.data.account.seasons,1);assert.equal(history.data.history.length,1);
 const again=await request(`/api/worlds/${slug}/cozy`,'1');assert.equal(again.data.state.finalScore,score);const repeat=await request('/api/me/cozy','1');assert.deepEqual(repeat.data,history.data);
 const denied=await cmd({type:'recruit',troop:'militia',amount:1});assert.equal(denied.status,422);assert.match(denied.data.error,/temporada/i);
 console.log('PASS Express via HTTP: start, zero, king, paid queue, 31-day offline catch-up, final score, reward once, read-only');
}finally{server.kill();await rest.close();await db.close();}
