// Synthetic local presentation stress test. GET interception only; no gameplay commands.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../reports/cozy/mobile-review/',import.meta.url);
const session=JSON.parse(await readFile(new URL('session.json',root),'utf8'));
assert.equal(session.base,'http://127.0.0.1:3339');
const browser=await chromium.connectOverCDP(session.cdp);
const context=await browser.newContext({viewport:{width:360,height:740},isMobile:true,hasTouch:true,deviceScaleFactor:1,extraHTTPHeaders:{'x-kw-smoke':'1'}});
await context.addCookies([{name:'kw_dev_auth',value:'visual_'+Date.now(),url:session.base}]);
const page=await context.newPage();page.setDefaultTimeout(30000);
const errors=[],checks=[];let posts=0,watchCommands=false,slug;
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(watchCommands&&r.method()==='POST'&&r.url().includes('/cozy'))posts++;});
const tap=l=>l.tap();
const file=name=>new URL(name,root).pathname.replace(/^\/(\w:)/,'$1');
async function shot(name){
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page must fit mobile width');
 await page.screenshot({path:file('crowded-'+name+'.png'),fullPage:true});
}
async function help(title,{capture=false}={}){
 const guide=page.getByRole('dialog',{name:title,exact:true});await guide.waitFor();
 assert.ok(await guide.evaluate(d=>d.getBoundingClientRect().width<=innerWidth-16));
 if(capture)await shot('first-help');
 let steps=0;
 while(await guide.isVisible()){
  assert.ok(++steps<=3,'Help must stay brief');
  await guide.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
  const next=guide.getByRole('button',{name:'Próximo',exact:true});
  await tap(await next.count()?next:guide.getByRole('button',{name:'Entendi',exact:true}));
 }
 checks.push(title);console.log('PASS first visit',title);
}
const close=()=>tap(page.getByRole('button',{name:'Fechar painel',exact:true}));
try{
 await page.goto(session.base+'/lobby',{waitUntil:'networkidle'});
 await tap(page.getByRole('button',{name:'Expresso · 30 dias reais',exact:true}));
 await page.getByPlaceholder('Nome do mundo').fill('Teste de ocupação');
 const create=page.waitForResponse(r=>r.url().endsWith('/api/worlds/create')&&r.request().method()==='POST');
 await tap(page.getByRole('button',{name:'Criar',exact:true}));assert.equal((await create).status(),200);
 await tap(page.getByRole('button',{name:'Entrar no mundo',exact:true}));await page.waitForURL('**/world/**');
 await help('Como comandar seu reino');slug=page.url().split('/world/')[1].split('/')[0];
 const source=await (await page.request.get(`${session.base}/api/worlds/${slug}/cozy`)).json();
 const {crowdedMap}=await import('./fixtures/cozy-crowded-map.mjs');const payload=crowdedMap(source);
 await page.route(`**/api/worlds/${slug}/cozy`,async route=>{
  assert.equal(route.request().method(),'GET','Stress fixture must not send commands');
  await route.fulfill({json:payload});
 });
 await page.reload({waitUntil:'networkidle'});await tap(page.getByRole('button',{name:'Mundo',exact:true}));await help('Como explorar o mundo');
 for(const width of [360,390]){
  await page.setViewportSize({width,height:width===360?740:844});
  for(const mode of ['Mundo','Região','Detalhe']){
   if(mode!=='Mundo')await tap(page.getByRole('button',{name:'Centralizar na capital',exact:true}));
   await tap(page.getByLabel('Escala do mapa',{exact:true}).getByRole('button',{name:mode,exact:true}));
   await shot(width+'-'+mode);
   const emblems=await page.locator('[data-map-scale] [data-map-emblem]').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};}));
   for(let a=0;a<emblems.length;a++)for(let b=a+1;b<emblems.length;b++){const x=emblems[a],y=emblems[b];assert.ok(x.x+x.w<=y.x||y.x+y.w<=x.x||x.y+x.h<=y.y||y.y+y.h<=x.y,'Emblems must not overlap');}
   if(mode==='Mundo'){const gray=await page.addStyleTag({content:'body{filter:grayscale(1)}'});await shot(width+'-grayscale');await gray.evaluate(el=>el.remove());}

  }
  await tap(page.getByLabel('Escala do mapa',{exact:true}).getByRole('button',{name:'Região',exact:true}));
  const svg=page.locator('svg[aria-label="Mapa dos reinos"]'),box=await svg.boundingBox();
  await page.touchscreen.tap(box.x+box.width/2+13,box.y+box.height/2);
  const chooser=page.getByRole('dialog',{name:'Escolher cidade',exact:true});await chooser.waitFor();
  assert.ok(await chooser.locator('[data-map-choice]').count()>=2);
  for(const button of await chooser.locator('[data-map-choice]').all()){const b=await button.boundingBox();assert.ok(b.height>=44);}
  await shot(width+'-choose');await tap(chooser.locator('[data-map-choice]').first());
  await page.getByRole('button',{name:'Fechar território',exact:true}).waitFor();assert.equal(await page.locator('[aria-label="Território e acesso"] [data-map-emblem]').count(),1);
  await tap(page.getByRole('button',{name:'Fechar território',exact:true}));
  await tap(page.getByRole('button',{name:'Localizar',exact:true}));await page.getByLabel('Buscar destino conhecido',{exact:true}).fill('Cidade 1.7');await tap(page.locator('[data-map-destination]').first());
  await tap(page.getByRole('button',{name:'Fechar território',exact:true}));
  await page.touchscreen.tap(box.x+box.width/2+13,box.y+box.height/2);
  await chooser.waitFor();assert.match(await chooser.innerText(),/Seu império/);assert.match(await chooser.innerText(),/Aliado/);
  await shot(width+'-border-choice');await tap(page.getByRole('button',{name:'Fechar cidades próximas',exact:true}));
  assert.equal(await page.locator('[data-owner-border]').count(),20);assert.equal(await page.locator('[data-map-journey]').count(),24);
  await tap(page.getByRole('button',{name:'Reinos',exact:true}));
  assert.equal(await page.locator('[data-map-realm]').count(),20);
  await shot(width+'-realms');await tap(page.getByRole('button',{name:'Fechar reinos',exact:true}));
  await tap(page.getByRole('button',{name:'Localizar',exact:true}));await page.getByLabel('Buscar destino conhecido',{exact:true}).fill('Cidade 2.1');
  const list=page.locator('[data-map-destination]');assert.equal(await list.count(),2); // 2.1 and 2.10
  assert.match(await list.first().innerText(),/Aliado/);await shot(width+'-allied');
  await page.getByLabel('Buscar destino conhecido',{exact:true}).fill('Cidade 7.1');assert.match(await list.first().innerText(),/Império/);
  await page.getByLabel('Buscar destino conhecido',{exact:true}).fill('Reserva compartilhada');await tap(page.locator('[data-map-destination]').first());
  assert.equal(await page.getByLabel('Impérios que compartilham a reserva',{exact:true}).locator('[data-map-emblem]').count(),2);
  assert.doesNotMatch(await page.getByRole('dialog').innerText(),/NaN|undefined/);
  await shot(width+'-shared');await tap(page.getByRole('button',{name:'Fechar território',exact:true}));
  await tap(page.getByRole('button',{name:'Localizar',exact:true}));
  await tap(page.getByText('Ir por coordenadas',{exact:true}));
  await page.getByLabel('Coordenadas',{exact:true}).fill('32,30');await tap(page.getByRole('button',{name:'Ir',exact:true}));
  await tap(page.getByLabel('Escala do mapa',{exact:true}).getByRole('button',{name:'Detalhe',exact:true}));
  const island=page.locator('[data-map-scale] [data-map-emblem="stress-player-1"]');assert.equal(await island.count(),1);
  await shot(width+'-outpost');await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
  assert.match(await page.locator('[aria-label="Território e acesso"]').innerText(),/Aliado/);
  await tap(page.getByRole('button',{name:'Fechar território',exact:true}));
 }
 assert.deepEqual(errors,[]);
 await writeFile(new URL('crowded-result.json',root),JSON.stringify({status:'PASS',scope:'Synthetic presentation fixture, not multiplayer persistence or native device performance',players:20,cities:200,alliances:4,orders:24,tiles:payload.tiles.length,viewports:[360,390],errors},null,2));
 console.log('PASS crowded map: 20 empires, 200 cities, 4 alliances, 24 routes');
}catch(error){await shot('failure').catch(()=>{});throw error;}
finally{await context.close();await browser.close();}
