// Local touch-browser walkthrough. No map actions, time advances or extra resources.
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
 await page.screenshot({path:file('map-'+name+'.png'),fullPage:true});
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
 await page.getByPlaceholder('Nome do mundo').fill('Cartografia mobile');
 const create=page.waitForResponse(r=>r.url().endsWith('/api/worlds/create')&&r.request().method()==='POST');
 await tap(page.getByRole('button',{name:'Criar',exact:true}));assert.equal((await create).status(),200);
 await tap(page.getByRole('button',{name:'Entrar no mundo',exact:true}));await page.waitForURL('**/world/**');
 await help('Como comandar seu reino');
 await tap(page.getByRole('button',{name:'Mundo',exact:true}));await help('Como explorar o mundo');
 for(const width of [360,390]){
  await page.setViewportSize({width,height:width===360?740:844});
  await tap(page.getByRole('button',{name:'Centralizar na capital',exact:true}));
  for(const mode of ['Detalhe','Região','Mundo']){
   await tap(page.getByRole('button',{name:mode,exact:true}).filter({hasNot:page.locator('img')}));
   await shot(width+'-'+mode);
  }
 }
 await tap(page.getByRole('button',{name:'Restaurar visão da capital',exact:true}));
 const surface=page.getByRole('grid',{name:'Territórios próximos'}),box=await surface.boundingBox();
 const cdp=await context.newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+57,y:y+43}]});
 const before=await page.locator('svg[aria-label="Mapa dos reinos"]').getAttribute('viewBox');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForTimeout(150);
 const after=(await page.locator('svg[aria-label="Mapa dos reinos"]').getAttribute('viewBox')).split(' ').map(Number);
 before.split(' ').map(Number).forEach((n,i)=>assert.ok(Math.abs(n-after[i])<0.001,'Drag release must not snap')); 
 assert.equal(await page.getByRole('dialog').count(),0,'Drag must not select a territory');
 for(let n=0;n<3;n++)await tap(page.getByRole('button',{name:'Aproximar mapa',exact:true}));
 for(let n=0;n<3;n++)await tap(page.getByRole('button',{name:'Afastar mapa',exact:true}));
 await tap(page.getByRole('button',{name:'Restaurar visão da capital',exact:true}));
 const target=page.locator('[data-cozy-tile][data-centered="true"]');const label=await target.getAttribute('aria-label');
 await target.tap();await page.getByRole('button',{name:'Fechar território',exact:true}).waitFor();
 await shot('territory');await tap(page.getByRole('button',{name:'Fechar território',exact:true}));
 await tap(page.getByRole('button',{name:'Localizar',exact:true}));await shot('locate');
 await tap(page.getByRole('button',{name:'Fechar localização',exact:true}));
 const saved=await page.evaluate(()=>Object.entries(localStorage).find(([key])=>key.startsWith('kw-cozy-map:'))?.[1]);
 assert.ok(saved,'Camera must be saved');
 await page.reload({waitUntil:'networkidle'});
 await tap(page.getByRole('button',{name:'Mundo',exact:true}));
 assert.equal(await page.getByRole('dialog',{name:'Como explorar o mundo',exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>Object.entries(localStorage).find(([key])=>key.startsWith('kw-cozy-map:'))?.[1]),saved,'Camera persists on reload');
 assert.deepEqual(errors,[]);
 await writeFile(new URL('map-result.json',root),JSON.stringify({status:'PASS',viewports:[360,390],checks:['first visit','world region detail','touch drag without snap','zoom buttons','capital selection','locate'],errors},null,2));
 console.log('PASS mobile map',label);
}catch(error){await shot('failure').catch(()=>{});throw error;}
finally{await context.close();await browser.close();}
