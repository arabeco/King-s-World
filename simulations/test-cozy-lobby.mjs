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
 await db.exec(await readFile(path.join(root,'63_SQL_COZY_EXPRESS_ECONOMY.sql'),'utf8'));
 await db.exec(await readFile(path.join(root,'65_SQL_COZY_LOBBY.sql'),'utf8'));
 for(let i=0;i<90;i++){try{await fetch(base+'/login');break}catch{if(i===89)throw Error('Startup timeout');await new Promise(r=>setTimeout(r,1000));}}
 const opened=await request('/api/worlds/create','1',{name:'Vale Solar',mode:'normal'});assert.equal(opened.status,200,JSON.stringify(opened.data));
 const locked=await request('/api/worlds/create','1',{name:'Castelo da Lua',mode:'express',password:'segredo'});assert.equal(locked.status,200,JSON.stringify(locked.data));
 const listing=await request('/api/worlds/discover','late');assert.equal(listing.status,200,JSON.stringify(listing.data));
 assert.deepEqual(listing.data.worlds.map(w=>[w.name,w.locked]).sort(),[['Castelo da Lua',true],['Vale Solar',false]]);
 await db.exec('set role authenticated');
 try { await assert.rejects(db.query('select * from kw_cozy_lobby_settings'),/permission denied/i); } finally { await db.exec('reset role'); }
 assert(!JSON.stringify(listing.data).includes('segredo'));assert(!JSON.stringify(listing.data).includes(opened.data.world.joinCode));
 const missing=await request('/api/worlds/join','late',{slug:locked.data.world.slug});assert.equal(missing.status,403);
 const wrong=await request('/api/worlds/join','late',{code:locked.data.world.joinCode,password:'errada'});assert.equal(wrong.status,403);
 const okay=await request('/api/worlds/join','late',{slug:locked.data.world.slug,password:'segredo'});assert.equal(okay.status,200,JSON.stringify(okay.data));
 const openJoin=await request('/api/worlds/join','another',{slug:opened.data.world.slug});assert.equal(openJoin.status,200,JSON.stringify(openJoin.data));
 const browser=await chromium.launch({headless:true});
 try{const context=await browser.newContext({viewport:{width:360,height:740},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-kw-smoke':'1'}});await context.addCookies([{name:'kw_dev_auth',value:'newplayer',url:base}]);const page=await context.newPage();await page.goto(base+'/lobby',{waitUntil:'networkidle'});await page.getByLabel('Nome do mundo',{exact:true}).fill('Castelo da Lua');await page.getByRole('button',{name:/Castelo da Lua/}).tap();await page.screenshot({path:path.join(root,'reports/cozy/lobby-directory-360.png'),fullPage:true});await page.getByLabel('Senha do mundo',{exact:true}).fill('segredo');const join=page.waitForResponse(r=>r.url().endsWith('/api/worlds/join')&&r.request().method()==='POST');await page.getByRole('button',{name:'Entrar no mundo',exact:true}).tap();assert.equal((await join).status(),200);await page.waitForURL(`**/world/${locked.data.world.slug}/**`);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await context.close();}finally{await browser.close();}
 console.log('PASS Lobby open and password worlds, privacy, wrong password, name search and mobile join');
}finally{server.kill();await rest.close();await db.close();}
