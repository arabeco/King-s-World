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
 await page.screenshot({path:file('visual-'+name+'.png'),fullPage:true});
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
 await mkdir(root,{recursive:true});await writeFile(new URL('visual-result.json',root),JSON.stringify({status:'RUNNING'}));
 await page.goto(session.base+'/lobby',{waitUntil:'networkidle'});
 await tap(page.getByRole('button',{name:'Expresso · 30 dias reais',exact:true}));
 await page.getByPlaceholder('Nome do mundo').fill('Olhar de quem chegou');
 const create=page.waitForResponse(r=>r.url().endsWith('/api/worlds/create')&&r.request().method()==='POST');
 await tap(page.getByRole('button',{name:'Criar',exact:true}));assert.equal((await create).status(),200);
 await tap(page.getByRole('button',{name:'Entrar no mundo',exact:true}));await page.waitForURL('**/world/**');
 slug=page.url().split('/world/')[1].split('/')[0];
 await help('Como comandar seu reino',{capture:true});
 const opened=page.waitForResponse(r=>r.url().endsWith('/cozy')&&r.request().method()==='POST');
 await tap(page.getByRole('button',{name:'Abrir os portões',exact:true}));assert.equal((await opened).status(),200);watchCommands=true;
 await shot('crown-360');
 const expected=[['Infraestrutura','Como evoluir suas cidades'],['Militar','Como preparar seu exército'],['Governo','Como conduzir seu governo'],['Conselho','Como decidir no Conselho'],['Conquistas','Como acompanhar suas conquistas']];
 for(const [button,title] of expected){
  await tap(page.getByRole('button',{name:button,exact:true}));await help(title);await shot(button.toLowerCase()+'-360');
  const trigger=page.getByRole('button',{name:title,exact:true}),box=await trigger.boundingBox();
  assert.ok(box.width>=44&&box.height>=44,'Information icon must be touch-sized');
  assert.equal(await trigger.innerText(),'','Only the information icon is persistent');
  await tap(trigger);await page.getByRole('dialog',{name:title,exact:true}).waitFor();
  await tap(page.getByRole('button',{name:'Fechar ajuda',exact:true}));
  await close();await tap(page.getByRole('button',{name:button,exact:true}));
  assert.equal(await page.getByRole('dialog',{name:title,exact:true}).count(),0,'Help must not repeat');await close();
 }
 await tap(page.getByRole('button',{name:'Cidades',exact:true}));await help('Como navegar pelas cidades');await shot('cities-360');
 await tap(page.getByRole('button',{name:'Ver cidade Capital',exact:true}));await help('Como cuidar da sua cidade');await shot('city-360');
 await tap(page.getByRole('button',{name:'Ver setor Economia',exact:true}));await shot('sector-360');
 const details=page.locator('details').filter({has:page.getByText('Função do setor',{exact:true})});assert.equal(await details.getAttribute('open'),null);
 await tap(page.getByRole('button',{name:'Fechar setor',exact:true}));await tap(page.getByRole('button',{name:'Coroa',exact:true}));
 for(const [selector,title,snapshot] of [
  [/^Ordens do reino:/,'Como acompanhar suas ordens','orders'],
  ['Tesouro do reino','Como usar o tesouro','treasury'],
  [/^Influência:/,'Como acompanhar sua influência','influence'],
 ]){await tap(page.getByRole('button',{name:selector,exact:typeof selector==='string'}));await help(title);await shot(snapshot+'-360');await close();}
 await tap(page.getByRole('button',{name:'Aliança',exact:true}));await help('Como jogar em aliança');await shot('alliance-360');
 await tap(page.getByRole('button',{name:'Relatos',exact:true}));await help('Como acompanhar os relatos');await shot('reports-360');
 await page.reload({waitUntil:'networkidle'});assert.equal(await page.getByRole('dialog',{name:/^Como /}).count(),0,'Seen guide stays closed after reload');
 await page.setViewportSize({width:390,height:844});await shot('crown-390');
 const d=await (await page.request.get(`${session.base}/api/worlds/${slug}/cozy`)).json();
 assert.equal(d.computed.influence.total,0);assert.equal(d.state.orders.length,0);assert.equal(posts,0,'Help and navigation must not send game commands');assert.deepEqual(errors,[]);
 const anonymous=await browser.newContext({viewport:{width:360,height:740},isMobile:true,hasTouch:true});
 try{
  const access=await anonymous.newPage();
  for(const route of ['login','register','forgot-password']){
   await access.goto(session.base+'/'+route,{waitUntil:'networkidle'});
   assert.equal(await access.locator('.marketing-hero > p').count(),1,'Access screen keeps branding without marketing paragraphs');
   assert.ok(await access.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await access.screenshot({path:file(`visual-${route}-360.png`),fullPage:true});
  }
 }finally{await anonymous.close();}
 const result={status:'PASS',scope:'Local first-use touch Chromium, not human comprehension or physical Android; ordinary resources, no map/balance changes',checks,compactAccessScreens:3,gameCommandsAfterStart:posts,errors};
 await writeFile(new URL('visual-result.json',root),JSON.stringify(result,null,2));console.log('PASS',checks.length,'first-visit screens; manual reopen, no repetition, no commands, 360/390px');
}catch(error){await shot('failure').catch(()=>{});await writeFile(new URL('visual-result.json',root),JSON.stringify({status:'FAIL',error:String(error),checks,errors},null,2));throw error;}
finally{await context.close();await browser.close();}
