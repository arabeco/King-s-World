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
 await db.exec(await readFile(path.join(root,'66_SQL_ROYAL_ATTRIBUTES.sql'),'utf8'));
 for(let i=0;i<90;i++){try{await fetch(base+'/login');break}catch{if(i===89)throw Error('Startup timeout');await new Promise(r=>setTimeout(r,1000));}}
 const created=await request('/api/worlds/create','1',{name:'Comparação de nível',mode:'normal'});assert.equal(created.status,200);
 const slug=created.data.world.slug;const first=await request(`/api/worlds/${slug}/cozy`,'1');assert.equal(first.status,200);
 const state=first.data.state,worldId=first.data.world.id,playerId=state.playerId;
 const actor=(await db.query('select user_id from world_players where id=$1',[playerId])).rows[0].user_id;
 await db.query("insert into kw_cozy_rewards(world_id,user_id,world_player_id,world_name,player_name,xp,finished) values($1,$2,$3,'Teste','Teste',19600,true)",[worldId,actor,playerId]);
 await db.query('select kw_royal_attributes_save($1,10,10,10,0)',[actor]);
 const second=await request(`/api/worlds/${slug}/cozy`,'1');assert.equal(second.status,200);assert.equal(second.data.account.level,15);assert.equal(first.data.account.level,1);
 for(const key of ['productionPerDay','defensePower','royalDefenseBonus','influence'])assert.deepEqual(second.data.computed[key],first.data.computed[key],`Account level must not silently change ${key}`);
 const coords=first.data.tiles.filter(t=>t.travelMs).slice(0,8).map(t=>[t.id,t.travelMs]);
 assert.deepEqual(second.data.tiles.filter(t=>t.travelMs).slice(0,8).map(t=>[t.id,t.travelMs]),coords);
 console.log('PASS Same kingdom at account levels 1 and 15: production, defense, influence and travel unchanged');
}finally{server.kill();await rest.close();await db.close();}
