import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createCozyDatabase,startCozyRest} from './lib/cozy-fixture.mjs';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
import {auditButtonContrast} from './lib/button-contrast.mjs';
const contrastChecks=[];
const audit=async(page,name)=>{const result=await auditButtonContrast(page,name);contrastChecks.push(result);console.log('PASS contrast',JSON.stringify(result));await writeFile(path.join(root,'reports/cozy/button-contrast.json'),JSON.stringify(contrastChecks,null,2));};
const root=fileURLToPath(new URL('..',import.meta.url)),db=await createCozyDatabase();
await db.exec(await readFile(path.join(root,'64_SQL_COZY_LATE_JOIN.sql'),'utf8'));
const rest=await startCozyRest(db),port=3327,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{cwd:root,windowsHide:true,env:{...process.env,NEXT_DIST_DIR:'.next-late-test',NEXT_PUBLIC_SUPABASE_URL:rest.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-public',SUPABASE_SECRET_KEY:'fixture-service',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'},stdio:'ignore'});
const request=async(url,who,body)=>{const res=await fetch(base+url,{method:body?'POST':'GET',headers:{cookie:`kw_dev_auth=${who}`,'x-kw-smoke':'1','content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()};};
try{
 await db.exec(await readFile(path.join(root,'66_SQL_ROYAL_ATTRIBUTES.sql'),'utf8'));
 await db.exec(await readFile(path.join(root,'67_SQL_ACCOUNT_APPEARANCE.sql'),'utf8'));
 await db.exec(await readFile(path.join(root,'68_SQL_COLLECTION_WALLET.sql'),'utf8'));
 await db.exec(await readFile(path.join(root,'69_SQL_KING_GAMEPLAY_PROGRESSION.sql'),'utf8'));
 for(let i=0;i<90;i++){try{await fetch(base+'/login');break}catch{if(i===89)throw Error('Startup timeout');await new Promise(r=>setTimeout(r,1000));}}
 const browser=await chromium.launch({headless:true});
 const entry=await browser.newPage({viewport:{width:390,height:844}});await entry.goto(base+'/login',{waitUntil:'networkidle'});await audit(entry,'Login');await entry.screenshot({path:path.join(root,'reports/cozy/buttons-login.png')});await entry.close();
 try{const context=await browser.newContext({viewport:{width:360,height:740},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-kw-smoke':'1'}});await context.addCookies([{name:'kw_dev_auth',value:'firstking',url:base}]);const page=await context.newPage();
 await page.goto(base+'/lobby',{waitUntil:'networkidle'});await page.waitForTimeout(1000);await audit(page,'Lobby');await page.getByPlaceholder('Nome do mundo').fill('Meu Expresso');await page.getByRole('button',{name:'Criar',exact:true}).tap();await page.getByRole('button',{name:'Entrar no mundo',exact:true}).tap();await page.waitForURL('**/world/**');
 const dialog=page.getByRole('dialog',{name:'Seu governante',exact:true});await dialog.waitFor();await page.waitForTimeout(2500);assert.ok(await dialog.isVisible(),'Choice must not disappear before input');assert.equal(await page.getByRole('dialog',{name:'Como comandar seu reino'}).count(),0);
 await audit(page,'Escolha do governante');await page.screenshot({path:path.join(root,'reports/cozy/new-first-entry-360.png')});
 assert.equal(await dialog.getByRole('textbox').count(),0,'Nickname belongs to the global account profile');const attrs=dialog.getByRole('region',{name:'Atributos do rei'});await attrs.getByText('0 pontos livres').waitFor();assert.equal(await attrs.getByRole('button',{name:'Aumentar Administração'}).count(),0);assert.equal(await attrs.getByRole('button',{name:'Salvar distribuição'}).count(),0);assert.equal(await dialog.getByRole('button',{name:/Guardião/}).count(),0);const reply=page.waitForResponse(r=>r.url().endsWith('/cozy')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Escolher equipamento do slot 1',exact:true}).tap();const picker=page.getByRole('dialog',{name:'Escolher item do slot 1',exact:true});await picker.getByRole('button',{name:/Livro de Ofícios/}).tap();await dialog.getByRole('button',{name:'Iniciar meu reinado'}).tap();assert.equal((await reply).status(),200);await dialog.waitFor({state:'hidden'});
 const help=page.getByRole('dialog',{name:'Como comandar seu reino'});await help.waitFor();await help.getByRole('button',{name:'Fechar ajuda'}).tap();
 await page.reload({waitUntil:'networkidle'});assert.equal(await page.getByRole('dialog',{name:'Seu governante'}).count(),0);
 const url=page.url().split('/world/')[1].split('/')[0];const d=await (await page.request.get(`${base}/api/worlds/${url}/cozy`)).json();assert.equal(d.state.king.profileId,'builder');assert.equal(d.state.king.attributes.administration,5);assert.equal(d.state.king.sovereignId,'sovereign-01');assert.deepEqual(d.state.king.equipment,['item-craft-ledger','','']);assert.equal(d.computed.influence.total,0);await page.screenshot({path:path.join(root,'reports/cozy/crown-pentagon-360.png')});for(const label of ['Infraestrutura','Militar','Governo','Conselho','Conquistas']){const button=page.getByRole('button',{name:label,exact:true});assert.match(await button.innerText(),/0\/500/);assert.ok((await button.boundingBox()).height>=44);}assert.match(await page.getByRole('button',{name:/Detalhes da influência/}).innerText(),/0/);
 for(const {width,height} of [{width:320,height:568},{width:360,height:640},{width:390,height:844}]){
  await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const nav=await page.getByRole('navigation',{name:'Áreas do reino'}).boundingBox();
  for(const label of ['Infraestrutura','Militar','Governo','Conselho','Conquistas']){const el=page.getByRole('button',{name:label,exact:true});const b=await el.boundingBox();assert.ok(b.y+b.height<=nav.y+1,`${width}x${height} ${label}: bottom ${b.y+b.height}, nav ${nav.y}`);assert.ok(b.height>=44);}
  await page.screenshot({path:path.join(root,`reports/cozy/crown-pentagon-${width}.png`)});
 }
 await page.setViewportSize({width:360,height:740});
 for(const [label,title] of [['Infraestrutura','Como evoluir suas cidades'],['Militar','Como preparar seu exército'],['Governo','Como conduzir seu governo'],['Conselho','Como decidir no Conselho'],['Conquistas','Como acompanhar suas conquistas']]){
  await page.getByRole('button',{name:label,exact:true}).tap();
  const panel=page.getByRole('dialog',{name:label,exact:true});await panel.waitFor();
  const guide=page.getByRole('dialog',{name:title,exact:true});await guide.getByRole('button',{name:'Fechar ajuda'}).tap();
  await audit(page,label);await page.screenshot({path:path.join(root,`reports/cozy/crown-area-${label}.png`)});
  await panel.getByRole('progressbar',{name:`Influência de ${label}`,exact:true}).waitFor();
  const sources=panel.getByRole('button',{name:'Fontes de influência',exact:true});await sources.tap();assert.ok(await panel.locator('#area-sources dt').count()>0);await sources.tap();
  if(label==='Conselho'){await panel.getByRole('button',{name:/Política/}).tap();await panel.getByRole('button',{name:/Tomás/}).waitFor();await panel.getByRole('button',{name:/Política/}).tap();}

  await panel.getByRole('button',{name:'Fechar painel',exact:true}).tap();await panel.waitFor({state:'hidden'});
 }
 const startReply=page.waitForResponse(r=>r.url().endsWith('/cozy')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Abrir os portões'}).tap();assert.equal((await startReply).status(),200);
 await page.getByRole('button',{name:'Abrir os portões'}).waitFor({state:'hidden'});
 for(const {width,height} of [{width:320,height:568},{width:360,height:640},{width:390,height:844}]){
  await page.setViewportSize({width,height});const nav=await page.getByRole('navigation',{name:'Áreas do reino'}).boundingBox();
  for(const label of ['Infraestrutura','Militar','Governo','Conselho','Conquistas']){const b=await page.getByRole('button',{name:label,exact:true}).boundingBox();assert.ok(b.y+b.height<=nav.y+1,`started ${width}x${height} ${label}: bottom ${b.y+b.height}, nav ${nav.y}`);}
 }
 await page.setViewportSize({width:360,height:740});await page.getByRole('button',{name:/Detalhes da influência/}).tap();const influence=page.getByRole('dialog',{name:'Influência',exact:true});await influence.waitFor();
 const influenceGuide=page.getByRole('dialog',{name:'Como acompanhar sua influência'});await influenceGuide.waitFor();await influenceGuide.getByRole('button',{name:'Fechar ajuda'}).tap();
 await influence.getByRole('button',{name:'Fechar painel'}).tap();await page.getByRole('button',{name:'Mundo',exact:true}).tap();
 const mapGuide=page.getByRole('dialog',{name:'Como explorar o mundo'});await mapGuide.waitFor();await mapGuide.getByRole('button',{name:'Fechar ajuda'}).tap();
 for(const {width,height} of [{width:320,height:568},{width:360,height:640},{width:390,height:844}]){
  await page.setViewportSize({width,height});await page.getByRole('button',{name:'Restaurar visão da capital'}).tap();
  const minus=page.getByRole('button',{name:'Afastar mapa'});for(let i=0;i<15&&await minus.isEnabled();i++)await minus.tap();assert.ok(await minus.isDisabled());await page.waitForTimeout(150);
  const svg=page.locator('svg[aria-label="Mapa dos reinos"]'),world=page.locator('[data-world-outline]');
  const fit=await svg.evaluate((el)=>{const s=el.getBoundingClientRect(),w=el.querySelector('[data-world-outline]').getBoundingClientRect();return {left:w.left-s.left,right:s.right-w.right,top:w.top-s.top,bottom:s.bottom-w.bottom};});
  assert.ok(Object.values(fit).every(v=>v>=0),`${width} world must fit: ${JSON.stringify(fit)} viewBox=${await svg.getAttribute('viewBox')} scale=${await page.locator('[data-map-scale]').getAttribute('data-map-scale')}`);
  const knownTowers=[...new Set(d.tiles.filter(t=>t.revealed&&t.landmarkId).map(t=>t.landmarkId))];
  const hints=await page.locator('[data-tower-signal]').evaluateAll(ns=>ns.map(n=>n.dataset.towerSignal));
  assert.ok(hints.length>=1&&hints.length<=2);
  assert.ok([...knownTowers,...hints].includes('sanctuary-central'));
  assert.ok(hints.every(id=>!knownTowers.includes(id)),'Signals do not reveal a district');
  assert.ok(knownTowers.length<7,'New player must not see the whole tower network');
  assert.deepEqual((await page.locator('[data-tower-marker]').evaluateAll(nodes=>nodes.map(n=>n.dataset.towerMarker))).sort(),knownTowers.sort());
  for(const marker of await page.locator('[data-tower-marker]').all()){const a=await marker.boundingBox(),b=await svg.boundingBox();assert.ok(a.x>=b.x&&a.x+a.width<=b.x+b.width&&a.y>=b.y&&a.y+a.height<=b.y+b.height,'Tower marker fits in map');}
  await page.screenshot({path:path.join(root,`reports/cozy/map-world-overview-${width}.png`)});
 }
 const gallery=path.join(root,'reports/cozy/referencias-telas');await mkdir(gallery,{recursive:true});
 await page.setViewportSize({width:390,height:844});
 const confirmation=page.getByRole('button',{name:'Fechar confirmação'});if(await confirmation.isVisible()){try{await confirmation.tap({timeout:1500});}catch(error){if(await confirmation.isVisible())throw error;}}
 await page.getByRole('button',{name:'Restaurar visão da capital'}).tap();
 const surface=page.getByRole('grid',{name:'Territórios próximos'});
 const gridButton=page.getByRole('button',{name:'Mostrar grade de hexágonos'});
 await gridButton.tap();
 assert.equal(await page.locator('[data-hex-grid]').first().getAttribute('fill'),'none');
 await gridButton.tap();
 assert.notEqual(await page.locator('[data-hex-grid]').first().getAttribute('fill'),'none');
 const plus=page.getByRole('button',{name:'Aproximar mapa'});
 for(let i=0;i<8&&await plus.isEnabled();i++)await plus.tap();
 assert.equal(Number(await page.locator('[data-map-scale]').getAttribute('data-map-scale')),3);
 await page.screenshot({path:path.join(root,'reports/cozy/map-city-close.png')});
 await page.getByRole('button',{name:'Restaurar visão da capital'}).tap();
 const capitalTile=page.locator('[data-cozy-tile][data-centered="true"]');
 const capitalLabel=await capitalTile.getAttribute('aria-label');
 await capitalTile.tap();
 await page.getByRole('button',{name:'Fechar território',exact:true}).waitFor();
 assert.ok(await page.getByRole('dialog').innerText().then(text=>text.includes('Capital')));
 const territory=page.getByRole('dialog');
 assert.ok((await territory.boundingBox()).height<844*.43,'Territory card leaves the map visible');
 assert.equal(await territory.evaluate(el=>el.matches(':modal')),false,'Map remains interactive');
 assert.equal(await page.locator('[data-selection-hex] path').count(),2);
 await page.screenshot({path:path.join(root,'reports/cozy/map-selection-capital.png')});
 await page.getByRole('button',{name:'Fechar território',exact:true}).tap();
 const latest=await (await page.request.get(`${base}/api/worlds/${url}/cozy`)).json();
 const capital=latest.state.cities.find(c=>c.capital);
 const unknown=latest.tiles.find(t=>!t.revealed&&t.q===capital.q+2&&t.r===capital.r);
 assert.ok(unknown);assert.equal(unknown.terrainVisible,true);assert.equal(unknown.revealed,false);assert.equal(unknown.ownerId,null);
 assert.ok(await page.locator(`[data-visible-ground="${unknown.id}"]`).count(),'Visible unowned ground paints the landscape');
 await page.locator(`[data-cozy-tile="${unknown.id}"]`).tap();
 const unknownCard=page.getByRole('dialog',{name:'Território desconhecido',exact:true});
 await unknownCard.getByRole('button',{name:/^Explorar /}).waitFor();
 assert.ok((await unknownCard.boundingBox()).height<844*.43);
 assert.equal((await (await page.request.get(`${base}/api/worlds/${url}/cozy`)).json()).state.explored.includes(unknown.id),false,'Selecting never spends resources or reveals a tile');
 await audit(page,'Mapa - explorar');await page.screenshot({path:path.join(root,'reports/cozy/map-selection-fog.png')});
 for(const viewport of [{width:320,height:568},{width:360,height:640}]){
  await page.setViewportSize(viewport);
  const action=unknownCard.getByRole('button',{name:/^Explorar /});
  await action.scrollIntoViewIfNeeded();
  const card=await unknownCard.boundingBox(),button=await action.boundingBox();
  assert.ok(card.height<=viewport.height*.43,'Compact territory card on the smallest phone');
  assert.ok(button.y>=card.y&&button.y+button.height<=card.y+card.height+1,'Exploration action remains reachable');
  assert.ok(button.height>=44,'Exploration has a touch-sized target');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(root,`reports/cozy/map-selection-fog-${viewport.width}.png`)});
 }
 await page.setViewportSize({width:390,height:844});

 await page.getByRole('button',{name:'Fechar território',exact:true}).tap();
 await page.getByRole('button',{name:'Restaurar visão da capital'}).tap();
 const touch=await context.newCDPSession(page);
 const bounds=await surface.boundingBox();
 const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+58,y:y+39}]});
 const beforeDrag=await page.getByLabel('Mapa dos reinos',{exact:true}).getAttribute('viewBox');
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForTimeout(100);
 const afterDrag=(await page.getByLabel('Mapa dos reinos',{exact:true}).getAttribute('viewBox')).split(' ').map(Number);
 beforeDrag.split(' ').map(Number).forEach((n,i)=>assert.ok(Math.abs(n-afterDrag[i])<.001,'Tilted camera must not jump after drag'));
 assert.equal(await page.getByRole('dialog').count(),0,'Dragging must not open a territory');
 await page.getByRole('button',{name:'Restaurar visão da capital'}).tap();
 await page.screenshot({path:path.join(gallery,'10-mapa.png')});
 await page.getByRole('button',{name:'Cidades',exact:true}).tap();
 const cityListGuide=page.getByRole('dialog',{name:'Como navegar pelas cidades'});await cityListGuide.waitFor();await audit(page,'Ajuda');await cityListGuide.getByRole('button',{name:'Fechar ajuda'}).tap();
 await audit(page,'Cidades');await page.screenshot({path:path.join(gallery,'08-cidades.png')});
 assert.ok((await page.getByRole('button',{name:/^Ver cidade /}).first().boundingBox()).height<135,'City roster stays compact');
 await page.getByRole('button',{name:/^Ver cidade /}).first().tap();
 const cityGuide=page.getByRole('dialog',{name:'Como cuidar da sua cidade'});await cityGuide.waitFor();await cityGuide.getByRole('button',{name:'Fechar ajuda'}).tap();
 await audit(page,'Interior');await page.screenshot({path:path.join(gallery,'07-dentro-da-cidade.png')});
 const sectorButton=page.getByRole('button',{name:'Ver setor Economia',exact:true});assert.ok((await sectorButton.boundingBox()).height>=64);assert.ok((await sectorButton.locator('[data-sector-level]').boundingBox()).width>=48,'Interior levels stay large');
 await page.getByRole('button',{name:'Ver setor Economia',exact:true}).tap();await page.getByRole('dialog',{name:'Economia',exact:true}).waitFor();await audit(page,'Evoluir cidade');await page.screenshot({path:path.join(root,'reports/cozy/buttons-city-upgrade.png')});await page.getByRole('button',{name:'Fechar setor',exact:true}).tap();
 await page.getByRole('tab',{name:'Decisões',exact:true}).tap();await audit(page,'Decisoes locais');await page.screenshot({path:path.join(gallery,'11-decisoes-da-cidade.png')});
 await page.getByRole('button',{name:'Aliança',exact:true}).tap();
 const allianceGuide=page.getByRole('dialog',{name:'Como jogar em aliança'});await allianceGuide.waitFor();await allianceGuide.getByRole('button',{name:'Fechar ajuda'}).tap();
 await page.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode().catch(()=>{}))));
 await audit(page,'Alianca');await page.screenshot({path:path.join(gallery,'09-alianca.png')});
 await page.getByRole('button',{name:'Buscar aliança',exact:true}).tap();
 await page.getByLabel('Buscar por nome').fill('Teste');
 await page.getByText('Nenhuma aliança encontrada.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Coroa',exact:true}).tap();await audit(page,'Coroa');await page.screenshot({path:path.join(gallery,'01-coroa-geral.png')});
 for(const [number,label] of [['02','Infraestrutura'],['03','Militar'],['04','Governo'],['05','Conselho'],['06','Conquistas']]){
  await page.getByRole('button',{name:label,exact:true}).tap();const panel=page.getByRole('dialog',{name:label,exact:true});await panel.waitFor();
  await audit(page,`${label} - temporada iniciada`);await page.screenshot({path:path.join(gallery,`${number}-${label.toLowerCase()}.png`)});
  if(label==='Militar'){
   await panel.getByRole('button',{name:'Aumentar quantidade de Milícia',exact:true}).tap();
   const reply=page.waitForResponse(r=>r.url().endsWith('/cozy')&&r.request().method()==='POST');
   await panel.getByRole('button',{name:'Recrutar 5 Milícia',exact:true}).tap();
   assert.equal((await reply).status(),200);
   const receipt=page.getByRole('button',{name:'Fechar confirmação'});
   if(await receipt.isVisible())await receipt.tap();
   await panel.getByRole('tab',{name:'Defesa',exact:true}).tap();
   await panel.getByRole('progressbar',{name:/Integridade de/}).first().waitFor();
   assert.equal(await panel.getByRole('button',{name:'Ver pesquisas de defesa'}).count(),0);
   await page.screenshot({path:path.join(root,'reports/cozy/military-defense-mobile.png')});
   await panel.getByRole('tab',{name:'Recrutamento',exact:true}).tap();
  }
  if(label==='Governo'){
   assert.equal(await panel.locator('[data-court-slot]').count(),10);
   await panel.getByRole('button',{name:'Escolher herói para vaga 1',exact:true}).tap();
   await page.getByRole('dialog',{name:'Escolher herói',exact:true}).getByRole('button',{name:'Detalhes de General',exact:true}).tap();
   const heroInfo=page.getByRole('dialog',{name:'General',exact:true});await heroInfo.waitFor();
   await heroInfo.getByText('+8% de poder · até 40% no reino',{exact:true}).waitFor();
   await page.screenshot({path:path.join(root,'reports/cozy/government-hero-detail.png')});
   await heroInfo.getByRole('button',{name:'Fechar detalhes do governo'}).tap();
   await panel.getByRole('tab',{name:'Pesquisas',exact:true}).tap();
   const researchTiles=panel.getByRole('button',{name:/^Ver pesquisa /});assert.equal(await researchTiles.count(),4);
   for(const viewport of [{width:320,height:568},{width:360,height:640},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    for(const tile of await researchTiles.all()){const b=await tile.boundingBox();assert.ok(b.width>=260&&b.height>=60);}
    await page.screenshot({path:path.join(root,`reports/cozy/government-research-${viewport.width}.png`)});
   }
   await panel.getByRole('button',{name:'Ver pesquisa Cultivo e ofícios',exact:true}).tap();
   const researchInfo=page.getByRole('region',{name:'Pesquisa selecionada: Cultivo e ofícios',exact:true});await researchInfo.waitFor();
   await researchInfo.getByRole('button',{name:'Pesquisar Cultivo e ofícios',exact:true}).waitFor();
   await researchInfo.locator('summary').tap();
   await researchInfo.getByText('+8% de materiais e alimento por nível.',{exact:true}).waitFor();
   await audit(page,'Detalhes da pesquisa');await page.screenshot({path:path.join(root,'reports/cozy/government-research-detail.png')});
   await researchInfo.locator('summary').tap();
   await panel.getByRole('tab',{name:'Heróis',exact:true}).tap();
  }
  if(label==='Conselho'){
   const sign=panel.getByRole('button',{name:'Assinar',exact:true});
   assert.ok(await sign.isDisabled());
   await panel.locator('button[aria-pressed="false"]').first().tap();
   assert.ok(await sign.isEnabled());await audit(page,'Conselho - assinar');
   const response=page.waitForResponse(r=>r.url().endsWith('/cozy')&&r.request().method()==='POST');
   await sign.tap();assert.equal((await response).status(),200);
   await sign.waitFor({state:'hidden'});
  }
  await panel.getByRole('button',{name:'Fechar painel'}).tap();
 }
 // Read-only UI fixture: seven cities without creating anything in a real world.
 const crowded=await (await page.request.get(`${base}/api/worlds/${url}/cozy`)).json();
 const template=crowded.state.cities[0];
 crowded.state.cities=Array.from({length:7},(_,i)=>({...template,id:i?`visual-city-${i}`:template.id,name:['Capital','Vale do Carvalho','Porto das Brumas','Pedra Alta','Campos do Sul','Vila Serena','Guarda do Norte'][i],capital:i===0,q:template.q+i,r:template.r,sectors:Object.fromEntries(Object.keys(template.sectors).map((s,j)=>[s,1+(i+j)%8]))}));
 const progression=loadCozyEngine('progression');
 crowded.computed.influenceDetails.cities=Object.fromEntries(crowded.state.cities.map(city=>[city.id,progression.infrastructureContribution(crowded.state,city)]));
 const oldInfrastructure=crowded.computed.influence.infrastructure;
 crowded.computed.influence.infrastructure=Math.min(500,Object.values(crowded.computed.influenceDetails.cities).reduce((a,b)=>a+b,0));
 crowded.computed.influence.total+=crowded.computed.influence.infrastructure-oldInfrastructure;
 const fixturePath=`**/api/worlds/${url}/cozy`;
 await page.route(fixturePath,async route=>{assert.equal(route.request().method(),'GET');await route.fulfill({json:crowded});});
 await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Coroa',exact:true}).tap();
 const atlas=page.locator('[data-realm-scale]');await atlas.waitFor();
 assert.equal(await atlas.locator('[data-realm-city]').count(),7);
 assert.ok(Number(await atlas.getAttribute('data-realm-scale'))<3);
 assert.ok(await atlas.evaluate(el=>{const box=el.getBoundingClientRect();return [...el.querySelectorAll('[data-realm-city]')].every(c=>{const b=c.getBoundingClientRect();return b.width>0&&b.left>=box.left-1&&b.right<=box.right+1&&b.top>=box.top-1&&b.bottom<=box.bottom+1;});}));
 await page.screenshot({path:path.join(root,'reports/cozy/crown-empire-seven.png')});
 await page.getByRole('button',{name:'Cidades',exact:true}).tap();
 const cities=page.getByRole('button',{name:/^Ver cidade /});assert.equal(await cities.count(),7);
 for(const city of await cities.all())assert.ok((await city.boundingBox()).height<90);
 for(const city of crowded.state.cities){
  const points=crowded.computed.influenceDetails.cities[city.id];
  assert.ok(points>0);
  await page.getByRole('button',{name:`Ver cidade ${city.name}`,exact:true}).getByLabel(`Influência de infraestrutura: ${points} pontos`).waitFor();
 }

 await page.screenshot({path:path.join(root,'reports/cozy/cities-seven-390.png')});
 await cities.last().scrollIntoViewIfNeeded();await cities.last().tap();
 await page.setViewportSize({width:320,height:568});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.ok((await page.getByRole('button',{name:'Ver setor Defesa',exact:true}).locator('[data-sector-level]').boundingBox()).width>=48);
 await page.screenshot({path:path.join(root,'reports/cozy/city-interior-320.png')});
 await page.unroute(fixturePath);await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Perfil da conta',exact:true}).tap();await page.waitForURL('**/profile');
 const collection=page.getByRole('region',{name:'Coleção de reis',exact:true});await collection.waitFor();
 await collection.getByText('Nível 1',{exact:true}).waitFor();assert.equal(await collection.getByRole('heading',{name:'Equipamentos',exact:true}).count(),0);assert.equal(await page.getByText('Nível da conta',{exact:true}).count(),0);
 await collection.locator('article').filter({has:page.getByText('Vestes de Safira',{exact:true})}).getByRole('button',{name:'Selecionar',exact:true}).click();
 await collection.locator('article').filter({has:page.getByText('Vestes de Safira',{exact:true})}).getByRole('button',{name:'Selecionado',exact:true}).waitFor();
 const savedAppearance=await (await page.request.get(base+'/api/me/appearance')).json();
 assert.equal(savedAppearance.appearance_id,'sovereign-04');assert.equal(savedAppearance.revision,1);
 assert.equal((await page.request.post(base+'/api/me/appearance',{data:{appearance_id:'sovereign-09',revision:1}})).status(),403);
 assert.equal((await page.request.post(base+'/api/me/appearance',{data:{appearance_id:'sovereign-02',revision:0}})).status(),409);
 await page.reload({waitUntil:'networkidle'});await collection.getByAltText('Vestes de Safira',{exact:true}).waitFor();
 await page.screenshot({path:path.join(root,'reports/cozy/collection-profile-390.png'),fullPage:true});
 await page.getByRole('link',{name:'Inventário',exact:true}).first().click();await page.waitForURL('**/inventory');
 const inventory=page.getByRole('region',{name:'Inventário',exact:true});await inventory.getByRole('button',{name:'Equipamentos',exact:true}).click();
 await inventory.getByText('Livro de Ofícios',{exact:true}).waitFor();assert.equal(await inventory.locator('article').count(),3);
 await inventory.getByRole('button',{name:'Brasões',exact:true}).click();await inventory.getByText('Brasão 01',{exact:true}).waitFor();assert.equal(await inventory.locator('article').count(),20);
 await page.screenshot({path:path.join(root,'reports/cozy/inventory-390.png'),fullPage:true});
 console.log('PASS profile king level, appearance persistence, ownership checks and inventory categories');
 await page.route('**/api/me/entitlements',route=>route.fulfill({json:{premium:{active:false,entitlement:null}}}));
 await page.getByRole('link',{name:'Loja',exact:true}).first().click();
 await page.waitForURL('**/premium');
 await page.getByText('Coleção em preparação',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Em preparação',exact:true}).count(),5);
 assert.ok((await page.getByRole('button',{name:'Em preparação',exact:true}).all()).length===5);
 await page.getByRole('button',{name:'Faltam 50 Gemas',exact:true}).first().waitFor();
 const me=(await (await page.request.get(base+'/api/me/profile')).json()).profile;
 await db.query('update kw_player_wallet set gems=100 where user_id=$1',[me.id]);
 await page.reload({waitUntil:'networkidle'});
 const shop=page.getByRole('region',{name:'Loja da Coroa',exact:true});
 const product=shop.locator('article').filter({has:page.getByText('Traje de Obras',{exact:true})});
 await product.getByRole('button',{name:'Comprar',exact:true}).click();
 await page.getByRole('dialog',{name:'Confirmar compra'}).getByRole('button',{name:'Confirmar compra',exact:true}).click();
 await product.getByRole('button',{name:'Selecionar',exact:true}).waitFor();
 assert.equal((await (await page.request.get(base+'/api/me/collection')).json()).gems,50);
 console.log('PASS store purchase confirmation, server debit and ownership after purchase');
 assert.ok(await page.getByRole('button',{name:'Restaurar assinatura',exact:true}).isDisabled());
 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(root,'reports/cozy/premium-preview-390.png'),fullPage:true});
 console.log('PASS premium mobile widths and premium sales guard');
 await writeFile(path.join(root,'reports/cozy/button-contrast.json'),JSON.stringify(contrastChecks,null,2));
 console.log('PASS rendered button contrast:',JSON.stringify(contrastChecks));
 await context.close();}finally{await browser.close();}
 console.log('PASS first entry opens king choice before help and remains saved after reload');
}finally{server.kill();await rest.close();await db.close();}

