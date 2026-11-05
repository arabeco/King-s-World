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
 const browser=await chromium.launch({headless:true});try{
 const context=await browser.newContext({viewport:{width:360,height:740},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-kw-smoke':'1'}});await context.addCookies([{name:'kw_dev_auth',value:'goldtest',url:base}]);const page=await context.newPage();
 const closeGuide=async title=>{const d=page.getByRole('dialog',{name:title,exact:true});await d.getByRole('button',{name:'Fechar ajuda',exact:true}).tap();};
 const snap=async name=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(root,`reports/cozy/gold-${name}.png`),fullPage:true});};
 await page.goto(base+'/lobby',{waitUntil:'networkidle'});await page.getByPlaceholder('Nome do mundo').fill('Jardim dourado');await page.getByRole('button',{name:'Criar',exact:true}).tap();await page.getByRole('button',{name:'Entrar no mundo',exact:true}).tap();await page.waitForURL('**/world/**');await closeGuide('Como comandar seu reino');
 await snap('gates');await page.getByRole('button',{name:'Abrir os portões'}).tap();await page.getByRole('button',{name:'Militar',exact:true}).tap();await closeGuide('Como preparar seu exército');await snap('military');
 const gold=await page.locator('button').evaluateAll(buttons=>buttons.filter(b=>!b.disabled&&getComputedStyle(b).backgroundImage.includes('linear-gradient')&&getComputedStyle(b).backgroundImage.includes('255, 241, 181')).length);assert.ok(gold>0,'Main action must use the shared gold gradient');
 await page.getByRole('button',{name:'Fechar painel',exact:true}).tap();await page.getByRole('button',{name:'Cidades',exact:true}).tap();await closeGuide('Como navegar pelas cidades');await page.getByRole('button',{name:'Ver cidade Capital',exact:true}).tap();await closeGuide('Como cuidar da sua cidade');await page.getByRole('button',{name:'Ver setor Economia',exact:true}).tap();await snap('city');
 await context.close();}finally{await browser.close();}
 console.log('PASS metallic actions in crown, military and city on mobile');
}finally{server.kill();await rest.close();await db.close();}
