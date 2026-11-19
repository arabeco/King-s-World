import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {spawn} from 'node:child_process';import {createServer} from 'node:net';import {fileURLToPath} from 'node:url';import path from 'node:path';import {chromium} from 'playwright';import {createCozyFoundingDatabase} from './lib/cozy-founding-fixture.mjs';import {startCozyRest} from './lib/cozy-fixture.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),db=await createCozyFoundingDatabase({persistent:true});
await db.exec('alter table world_players drop constraint world_players_world_id_fkey; alter table world_players add constraint world_players_world_id_fkey foreign key(world_id) references worlds(id) on delete cascade');
await db.exec(await readFile(path.join(root,'82_SQL_DELETE_SOLO_WORLD.sql'),'utf8'));
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const {port}=socket.address();await new Promise(r=>socket.close(r));const rest=await startCozyRest(db),base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{cwd:root,windowsHide:true,env:{...process.env,NEXT_DIST_DIR:'.next-delete-world-test',KW_COZY_PERSISTENT_PREVIEW:'1',NEXT_PUBLIC_SUPABASE_URL:rest.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-public',SUPABASE_SECRET_KEY:'fixture-service',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'},stdio:'ignore'});
let browser;
try{
 for(let i=0;i<90;i++){try{if((await fetch(base+'/api/release')).ok)break;}catch{}await new Promise(r=>setTimeout(r,1000));if(i===89)throw Error('Servidor não iniciou');}
 browser=await chromium.launch();const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await context.addCookies([{name:'kw_dev_auth',value:'1',url:base}]);const page=await context.newPage();
 const create=await page.request.post(base+'/api/worlds/create',{data:{name:'Reino antigo',mode:'express'}});assert.equal(create.status(),200,await create.text());const {world}=await create.json();
 const cross=await page.request.post(base+`/api/worlds/${world.slug}/delete`,{headers:{origin:'https://foreign.invalid'}});assert.equal(cross.status(),403);
 await page.goto(base+'/lobby',{waitUntil:'networkidle'});await page.screenshot({path:path.join(root,'reports/cozy/lobby-delete-390.png')});await page.getByRole('button',{name:'Excluir este mundo'}).tap();const dialog=page.getByRole('dialog',{name:'Excluir Reino antigo?'});await dialog.waitFor();
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await dialog.getByRole('button',{name:'Excluir mundo',exact:true}).isVisible());}
 await dialog.getByRole('button',{name:'Voltar'}).tap();await dialog.waitFor({state:'hidden'});assert.equal((await page.request.get(base+'/api/me/entitlements')).status(),200);
 await page.getByRole('button',{name:'Excluir este mundo'}).tap();const response=page.waitForResponse(r=>r.url().endsWith(`/api/worlds/${world.slug}/delete`)&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Excluir mundo',exact:true}).tap();assert.equal((await response).status(),200);await dialog.waitFor({state:'hidden'});
 const benefits=await (await page.request.get(base+'/api/me/entitlements')).json();assert.equal(benefits.benefits.activeWorlds,0);assert.equal(benefits.benefits.canCreate,true);
 console.log('PASS lobby mobile: cancelar, confirmação, origem cruzada, exclusão e liberação de vaga.');
}finally{await browser?.close();server.kill();await rest.close();await db.close();}
