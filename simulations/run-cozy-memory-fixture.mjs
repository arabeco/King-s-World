// Production-mode local QA without adding any authentication bypass to the product.
import {spawn} from 'node:child_process';
import {createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createServerClient} from '@supabase/ssr';
import {createCozyDatabase,startCozyRest} from './lib/cozy-fixture.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const label=process.env.COZY_MEMORY_LABEL||'baseline';
if(!/^[a-z0-9-]+$/.test(label))throw Error('Invalid measurement label');
const mode=process.env.COZY_MEMORY_MODE||'production';
if(!['production','development'].includes(mode))throw Error('Invalid mode');
const folder=path.join(root,'reports/cozy/memory');await mkdir(folder,{recursive:true});
const logFile=path.join(folder,`${label}-server.log`);await writeFile(logFile,'');
const now=Math.floor(Date.now()/1000),user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'memory@fixture.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{username:'memory_qa'},created_at:new Date().toISOString()};
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const unsigned=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,aud:'authenticated',role:'authenticated',iss:'http://127.0.0.1:3320/auth/v1',exp:now+86400,iat:now});
const accessToken=unsigned+'.'+createHmac('sha256','local-fixture-not-a-real-secret').update(unsigned).digest('base64url');
const db=await createCozyDatabase();await db.exec(await readFile(path.join(root,'63_SQL_COZY_EXPRESS_ECONOMY.sql'),'utf8'));
const rest=await startCozyRest(db,3320,{user,accessToken});
const cookies=new Map();
const client=createServerClient(rest.url,'fixture-public',{cookies:{getAll:()=>[...cookies.values()],setAll:values=>{for(const c of values)cookies.set(c.name,c);}}});
const auth=await client.auth.setSession({access_token:accessToken,refresh_token:'local-fixture-refresh'});if(auth.error)throw auth.error;
const cookieHeader=[...cookies.values()].map(c=>`${c.name}=${c.value}`).join('; ');
const dist=mode==='production'?`.next-memory-${label}`:'.next-memory-dev';
const env={...process.env,NODE_ENV:mode,KW_LOCAL_WEBVIEW_QA:'1',NEXT_DIST_DIR:dist,NEXT_PUBLIC_SUPABASE_URL:rest.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-public',SUPABASE_SECRET_KEY:'fixture-service',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'};
const next=path.join(root,'node_modules/next/dist/bin/next');
let child;
function launch(args){const proc=spawn(process.execPath,[next,...args],{cwd:root,windowsHide:true,env,stdio:['ignore','pipe','pipe']});proc.stdout.on('data',b=>void appendFile(logFile,b));proc.stderr.on('data',b=>void appendFile(logFile,b));return proc;}
async function stop(){child?.kill();await rest.close();await db.close();process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);process.stdin.on('data',b=>{if(String(b).trim()==='stop')void stop();});
try{
 if(mode==='production'&&process.env.COZY_MEMORY_SKIP_BUILD!=='1'){
  console.log('MEMORY_BUILD',label);child=launch(['build']);const code=await new Promise(resolve=>child.on('exit',resolve));child=null;if(code!==0)throw Error('Memory build failed; see '+logFile);
 }
 child=launch([mode==='production'?'start':'dev','--hostname','127.0.0.1','--port','3318']);
 const base='http://127.0.0.1:3318';
 for(let i=0;i<90;i++){try{const r=await fetch(base+'/login',{signal:AbortSignal.timeout(2000)});if(r.ok)break;}catch{}if(i===89)throw Error('Memory app startup failed');await new Promise(r=>setTimeout(r,1000));}
 // Exercise the actual Next response adapter, not just middleware unit stubs.
 for(const headers of [{},{RSC:'1'}]){
  const response=await fetch(base+'/lobby',{redirect:'manual',headers});
  assert.equal(response.status,307);assert.equal(new URL(response.headers.get('location'),base).origin,base,'Next must not send the WebView to an external loopback host');
 }
 async function req(route,body){const response=await fetch(base+route,{method:body?'POST':'GET',headers:{cookie:cookieHeader,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const value=await response.json();if(!response.ok)throw Error(JSON.stringify(value));return value;}
 const made=await req('/api/worlds/create',{name:'Memória · QA local',mode:'express'}),slug=made.world.slug;
 await req(`/api/worlds/${slug}/cozy`,{action:{type:'start_world'},requestId:crypto.randomUUID()});
 const metadata={label,mode,base,url:`${base}/world/${slug}/intelligence`,slug,dist,cookies:[...cookies.values()].map(c=>({name:c.name,value:c.value,url:base,...(c.options?.maxAge?{expires:now+c.options.maxAge}:{})})),scope:'Local disposable Auth+Postgres fixture, real production-mode app, no remote Supabase or product auth bypass'};
 await writeFile(path.join(folder,`${label}-fixture.json`),JSON.stringify(metadata,null,2));
 await writeFile(path.join(folder,'session.json'),JSON.stringify(metadata,null,2));
 console.log('MEMORY_FIXTURE_READY',JSON.stringify({label,mode,url:metadata.url}));
}catch(error){child?.kill();await rest.close();await db.close();throw error;}
