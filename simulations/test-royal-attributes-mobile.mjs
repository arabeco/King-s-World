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
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:360,height:740},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-kw-smoke':'1'}});await context.addCookies([{name:'kw_dev_auth',value:'attribute',url:base}]);const page=await context.newPage();
  await page.goto(base+'/lobby',{waitUntil:'networkidle'});const panel=page.getByRole('region',{name:'Atributos do rei'});await panel.getByText('1 ponto livre').waitFor();await panel.getByRole('button',{name:'Aumentar Administração'}).tap();const saved=page.waitForResponse(r=>r.url().endsWith('/api/me/royal-attributes')&&r.request().method()==='POST');await panel.getByRole('button',{name:'Salvar distribuição'}).tap();const savedResponse=await saved;assert.equal(savedResponse.status(),200,await savedResponse.text());await panel.getByText('Distribuição salva.').waitFor();
  await page.reload({waitUntil:'networkidle'});await page.getByRole('region',{name:'Atributos do rei'}).getByText('0 pontos livres').waitFor();
  await page.getByPlaceholder('Nome do mundo').fill('Meu perfil');await page.getByRole('button',{name:'Criar',exact:true}).tap();await page.getByRole('button',{name:'Entrar no mundo',exact:true}).tap();await page.waitForURL('**/world/**');
  const help=page.getByRole('dialog',{name:'Como comandar seu reino'});await help.getByRole('button',{name:'Fechar ajuda'}).tap();
  await page.getByRole('button',{name:'Escolha seu perfil de rei'}).tap();const dialog=page.getByRole('dialog',{name:'Seu governante'}),inner=dialog.getByRole('region',{name:'Atributos do rei'});await inner.getByText('0 pontos livres').waitFor();assert.match(await inner.innerText(),/6%/);
  await page.screenshot({path:path.join(root,'reports/cozy/royal-first-choice-360.png'),fullPage:true});
  for(const width of [320,390]){
   await page.setViewportSize({width,height:740});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
   for(const button of await inner.getByRole('button').all()){const bounds=await button.boundingBox();assert.ok(bounds.width>=44&&bounds.height>=44,'Attribute controls remain touch-sized');}
   await page.screenshot({path:path.join(root,`reports/cozy/royal-first-choice-${width}.png`),fullPage:true});
  }
  await page.setViewportSize({width:360,height:740});
  await dialog.getByRole('button',{name:/Guardião/}).tap();assert.equal(await dialog.getByRole('button',{name:/Guardião/}).getAttribute('aria-pressed'),'true');
  await inner.getByRole('button',{name:'Diminuir Administração'}).tap();await inner.getByRole('button',{name:'Aumentar Comando'}).tap();await inner.getByRole('button',{name:'Salvar distribuição'}).tap();await inner.getByText('Distribuição salva.').waitFor();
  const chose=page.waitForResponse(r=>r.url().endsWith('/cozy')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Iniciar meu reinado'}).tap();const chosen=await chose;assert.equal(chosen.status(),200);const receipt=chosen.request().postDataJSON();const replay=await page.request.post(chosen.url(),{data:receipt,headers:{'x-kw-smoke':'1'}});assert.equal(replay.status(),200);const result=await replay.json();assert.equal(result.state.king.profileId,'guardian');assert.deepEqual(result.state.king.attributes,{administration:5,command:6,exploration:5});
  await page.goto(base+'/lobby',{waitUntil:'networkidle'});const again=page.getByRole('region',{name:'Atributos do rei'});await again.getByText('0 pontos livres').waitFor();assert.match(await again.innerText(),/6%/);
  await again.getByRole('button',{name:'Diminuir Comando'}).tap();await again.getByRole('button',{name:'Aumentar Exploração'}).tap();await again.getByRole('button',{name:'Salvar distribuição'}).tap();await again.getByText('Distribuição salva.').waitFor();
  const worldResponse=await page.request.get(chosen.url());const worldState=await worldResponse.json();assert.deepEqual(worldState.state.king.attributes,{administration:5,command:6,exploration:5},'A later account change cannot alter an existing reign or its offline history');
  await context.close();
 }finally{await browser.close();}
 console.log('PASS shared royal profile from lobby and world, save and reload on touch mobile');
}finally{server.kill();await rest.close();await db.close();}
