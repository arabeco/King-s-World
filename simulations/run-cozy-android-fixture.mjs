// Disposable local backend for Android WebView QA. Never connects to remote Supabase.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCozyDatabase,startCozyRest} from './lib/cozy-fixture.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),port=3318,base=`http://127.0.0.1:${port}`;
const db=await createCozyDatabase();await db.exec(await readFile(path.join(root,'63_SQL_COZY_EXPRESS_ECONOMY.sql'),'utf8'));const rest=await startCozyRest(db);
const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{
 cwd:root,windowsHide:true,env:{...process.env,NEXT_DIST_DIR:'.next-cozy-android',NEXT_PUBLIC_SUPABASE_URL:rest.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-public',SUPABASE_SECRET_KEY:'fixture-service',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',COZY_CRON_SECRET:'fixture-android-scheduler-secret-32'},stdio:['ignore','pipe','pipe']});
child.stdout.on('data',b=>process.stdout.write(b));child.stderr.on('data',b=>process.stderr.write(b));
async function req(route,body){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{cookie:'kw_dev_auth=1','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(JSON.stringify(data));return data;}
try{
 for(let i=0;i<90;i++){try{await fetch(base+'/login');break;}catch{if(i===89)throw Error('Local fixture startup timed out');await new Promise(r=>setTimeout(r,1000));}}
 const created=await req('/api/worlds/create',{name:'Android · Reino de teste',mode:'express'}),slug=created.world.slug;
 let data=await req(`/api/worlds/${slug}/cozy`,{action:{type:'start_world'},requestId:crypto.randomUUID()});
 const capital=data.state.cities[0];
 const city={...structuredClone(capital),id:'android-river',name:'Vila do Rio',q:capital.q+3,capital:false,integrity:60,life:{contentment:28,lastDecisionDay:null,lastSocialDay:1,unrestDays:0}};
 data.state.cities.push(city);data.shared.claims[`${city.q},${city.r}`]={playerId:data.state.playerId,cityId:city.id,name:city.name};
 await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(data.state),data.state.playerId]);
 await db.query('update kw_cozy_world_states set state_json=$1::jsonb,revision=revision+1 where world_id=$2',[JSON.stringify(data.shared),data.world.id]);
 const metadata={port,base,slug,url:`${base}/world/${slug}/intelligence`,scope:'Disposable local PGlite fixture, economic Express 30 days, with one extra crisis city for recovery QA'};
 await mkdir(path.join(root,'reports/cozy'),{recursive:true});await writeFile(path.join(root,'reports/cozy/android-fixture.json'),JSON.stringify(metadata,null,2));
 console.log('ANDROID_FIXTURE_READY',JSON.stringify(metadata));
}catch(e){child.kill();await db.close();throw e;}
async function stop(){child.kill();await db.close();process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);process.stdin.on('data',b=>{if(String(b).trim()==='stop')void stop();});
