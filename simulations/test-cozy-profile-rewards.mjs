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
 await page.screenshot({path:file('reward-'+name+'.png'),fullPage:true});
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
 const account=page.getByRole('region',{name:'Histórico da conta'});await account.getByText('Insígnia de Vitória',{exact:true}).waitFor();
 assert.match(await account.innerText(),/Alcance 1.500/);assert.match(await account.innerText(),/Nível 3 da conta/);
 await tap(page.getByRole('button',{name:'Expresso · 30 dias reais',exact:true}));await page.getByPlaceholder('Nome do mundo').fill('Recompensas reais');
 const created=page.waitForResponse(r=>r.url().endsWith('/api/worlds/create')&&r.request().method()==='POST');await tap(page.getByRole('button',{name:'Criar',exact:true}));assert.equal((await created).status(),200);
 await tap(page.getByRole('button',{name:'Entrar no mundo',exact:true}));await page.waitForURL('**/world/**');await help('Como comandar seu reino');
 const opened=page.waitForResponse(r=>r.url().endsWith('/cozy')&&r.request().method()==='POST');await tap(page.getByRole('button',{name:'Abrir os portões',exact:true}));assert.equal((await opened).status(),200);
 await tap(page.getByRole('button',{name:'Escolha seu perfil de rei',exact:true}));const dialog=page.getByRole('dialog',{name:'Seu governante'});assert.match(await dialog.innerText(),/1.500 de influência/);assert.match(await dialog.innerText(),/Nível 3 da conta/);
 await tap(page.getByRole('button',{name:'Fechar perfil',exact:true}));
 await page.route('**/api/worlds/**/cozy',async route=>{if(route.request().method()!=='GET')return route.continue();const response=await route.fetch();const result=await response.json();result.account={...result.account,seals:1,level:3,xp:400};await route.fulfill({response,json:result});});
 await page.reload({waitUntil:'networkidle'});await tap(page.getByRole('button',{name:'Escolha seu perfil de rei',exact:true}));await dialog.waitFor();assert.match(await dialog.innerText(),/Desbloqueada/);assert.match(await dialog.innerText(),/Desbloqueado/);await shot('profile');
 await tap(page.getByRole('button',{name:'Fechar perfil',exact:true}));assert.deepEqual(errors,[]);
 console.log('PASS account and royal rewards locked and unlocked on a 360px touch viewport');
}finally{await context.close();await browser.close();}
