import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createCozyDatabase,startCozyRest} from './lib/cozy-fixture.mjs';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),db=await createCozyDatabase(),E=loadCozyEngine(),L=loadCozyEngine('landmarks');
await db.exec('create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;');
for(const name of ['11_SQL_PREMIUM_ENTITLEMENTS_PLAYSTORE.sql','63_SQL_COZY_EXPRESS_ECONOMY.sql','65_SQL_COZY_LOBBY.sql','66_SQL_ROYAL_ATTRIBUTES.sql','67_SQL_ACCOUNT_APPEARANCE.sql','68_SQL_COLLECTION_WALLET.sql','69_SQL_KING_GAMEPLAY_PROGRESSION.sql','70_SQL_COLLECTION_SEASON_REWARDS.sql','71_SQL_COZY_PREMIUM_BENEFITS.sql','73_SQL_SEASON_POSITION_REWARDS.sql','74_SQL_COMPETITIVE_WORLD_MODE.sql','75_SQL_PLAY_GEM_PURCHASES.sql','76_SQL_COZY_UNIFIED_RHYTHM.sql'])await db.exec(await readFile(path.join(root,name),'utf8'));
const listener=createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
const rest=await startCozyRest(db),base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{cwd:root,windowsHide:true,env:{...process.env,NEXT_DIST_DIR:'.next-smart-decisions-test',NEXT_PUBLIC_SUPABASE_URL:rest.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-public',SUPABASE_SECRET_KEY:'fixture-service',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'},stdio:['ignore','pipe','pipe']});
let browser,page,log='';server.stdout.on('data',b=>log=(log+b).slice(-5000));server.stderr.on('data',b=>log=(log+b).slice(-5000));
try{
 for(let i=0;i<90;i++){try{await fetch(base+'/login');break;}catch{await new Promise(r=>setTimeout(r,1000));}}
 browser=await chromium.launch();const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-kw-smoke':'1'}});await context.addCookies([{name:'kw_dev_auth',value:'smart-decisions-ui',url:base}]);page=await context.newPage();
 const create=await page.request.post(base+'/api/worlds/create',{data:{name:'Smart Decisions UI',mode:'express'}});assert.equal(create.status(),200,await create.text());const made=await create.json(),slug=made.world.slug,endpoint=base+`/api/worlds/${slug}/cozy`;
 const command=async action=>{const reply=await page.request.post(endpoint,{data:{requestId:crypto.randomUUID(),action}});assert.equal(reply.status(),200,await reply.text());return reply.json();};
 await command({type:'start_world'});let data=await command({type:'king_choose',profileId:'builder',nickname:'Account king'});assert.equal(data.world.economyVersion,3);
 const city=data.state.cities[0];data.state.resources={gold:0,materials:1000,supplies:600};
 const save=async()=>{await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(data.state),data.state.playerId]);};await save();
 await context.addInitScript(id=>{for(const screen of ['crown','cities','city','council'])localStorage.setItem(`kw-screen-help:v1:${screen}:${id}`,'seen');},data.state.playerId);
 let commands=0;page.on('request',request=>{if(request.method()==='POST'&&request.url()===endpoint)commands++;});
 let writes=0;page.on('request',request=>{if(request.method()==='POST'&&request.url()===endpoint&&['city_decision','decree'].includes(request.postDataJSON()?.action?.type))writes++;});
 const nav=()=>page.getByRole('navigation',{name:'Áreas do reino',exact:true});
 await page.goto(base+`/world/${slug}/intelligence`,{waitUntil:'networkidle'});await nav().getByRole('button',{name:'Cidades',exact:true}).tap();await page.getByRole('button',{name:'Ver cidade Capital',exact:true}).tap();await page.getByRole('tab',{name:'Setores',exact:true}).tap();
 // Inspect every building without paying, and keep the real numeric preview legible on mobile.
 const initialMaterials=data.state.resources.materials;
 for(const [name,key] of [['Administração','administration'],['Economia','economy'],['Sociedade','society'],['Recrutamento','recruitment'],['Defesa','defense']]){
  await page.getByRole('button',{name:`Ver setor ${name}`,exact:true}).tap();
  const sheet=page.getByRole('dialog',{name,exact:true});await sheet.waitFor();
  assert.equal(await sheet.getByRole('button',{name:`Evoluir ${name}`,exact:true}).isEnabled(),true);
  await sheet.getByRole('region',{name:'Prévia da evolução',exact:true}).waitFor();
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert(await sheet.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'No horizontal sheet overflow');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  await page.setViewportSize({width:390,height:844});await sheet.locator('img').evaluateAll(async images=>{await Promise.all(images.map(img=>img.decode().catch(()=>{})));});await page.screenshot({path:path.join(root,`reports/cozy/welcoming-upgrade-${key}-390.png`)});
  await sheet.getByRole('button',{name:'Fechar setor',exact:true}).tap();
 }
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});for(const card of await page.getByRole('button',{name:/^Ver setor /}).all())assert(await card.evaluate(el=>Array.from(el.children).every(child=>child.getBoundingClientRect().right<=el.getBoundingClientRect().right+1)),'All sector content fits its row');}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'reports/cozy/welcoming-city-sectors-390.png')});
 assert.equal(commands,0,'Inspecting sectors submits no game commands');const inspected=(await (await page.request.get(endpoint)).json()).state.resources.materials;assert(inspected>=initialMaterials&&inspected<initialMaterials+5,'Only passive production changes while inspecting');
 await page.getByRole('tab',{name:'Decisões',exact:true}).tap();
 const local=page.getByRole('article',{name:'Decisão local da cidade',exact:true});await local.getByRole('button',{name:'Escolher: Vender parte dos materiais',exact:true}).tap();
 assert.equal(writes,0,'Selecting a local choice must not spend');await local.getByRole('button',{name:'Ouro: +16',exact:true}).tap();assert.equal(writes,0,'Reading an effect is free');
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await local.getByRole('button',{name:'Confirmar decisão',exact:true}).scrollIntoViewIfNeeded();assert(await local.getByRole('button',{name:'Confirmar decisão',exact:true}).isEnabled());}
 await page.setViewportSize({width:390,height:844});await local.scrollIntoViewIfNeeded();await page.waitForLoadState('networkidle');await page.screenshot({path:path.join(root,'reports/cozy/smart-local-trade-390.png')});
 let response=page.waitForResponse(reply=>reply.url()===endpoint&&reply.request().method()==='POST'&&reply.request().postDataJSON()?.action?.type==='city_decision');await local.getByRole('button',{name:'Confirmar decisão',exact:true}).tap();let reply=await response;assert.equal(reply.status(),200,await reply.text());let result=await reply.json();assert.equal(result.state.resources.gold,16);assert.equal(writes,1);
 await nav().getByRole('button',{name:'Coroa',exact:true}).tap();await page.getByRole('button',{name:'Conselho',exact:true}).tap();const council=page.getByRole('dialog',{name:'Conselho',exact:true});await council.getByRole('button',{name:'Vender materiais do reino',exact:true}).tap();assert.equal(writes,1,'Selecting a decree is free');
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.setViewportSize({width:390,height:844});await council.getByRole('button',{name:'Assinar',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(root,'reports/cozy/smart-council-trade-390.png')});
 response=page.waitForResponse(reply=>reply.url()===endpoint&&reply.request().method()==='POST'&&reply.request().postDataJSON()?.action?.type==='decree');await council.getByRole('button',{name:'Assinar',exact:true}).tap();reply=await response;assert.equal(reply.status(),200,await reply.text());result=await reply.json();assert.equal(result.state.resources.gold,76);assert.equal(writes,2);
 // Fixtures advance the real v3 clock to a merchant audience, never mock effects or the POST response.
 await db.query("update worlds set starts_at=now()-interval '18 hours',runtime_anchor_started_at=now()-interval '18 hours',ends_at=now()+interval '29 days' where id=$1",[data.world.id]);
 data.state=result.state;data.state.resources={gold:1000,materials:1000,supplies:1000};await save();
 await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Conselho',exact:true}).tap();await council.getByRole('button',{name:'Enviar uma caravana distante',exact:true}).tap();await council.getByText('70% de sucesso',{exact:true}).tap();await council.getByText('O custo é gasto também se falhar.',{exact:true}).waitFor();
 await council.getByRole('button',{name:'Assinar',exact:true}).scrollIntoViewIfNeeded();await page.waitForLoadState('networkidle');await page.screenshot({path:path.join(root,'reports/cozy/smart-council-risk-390.png')});assert.equal(writes,2,'Risk inspection never submits the selected decree');
 response=page.waitForResponse(reply=>reply.url()===endpoint&&reply.request().method()==='POST'&&reply.request().postDataJSON()?.action?.type==='decree');await council.getByRole('button',{name:'Assinar',exact:true}).tap();reply=await response;assert.equal(reply.status(),200,await reply.text());result=await reply.json();assert([975,1070].includes(result.state.resources.gold));assert.equal(writes,3);assert(result.state.resources.supplies>=800&&result.state.resources.supplies<801);
 const replay=await page.request.post(endpoint,{data:reply.request().postDataJSON()});assert.equal(replay.status(),200,await replay.text());const replayed=await replay.json();assert.equal(replayed.state.resources.gold,result.state.resources.gold);assert.equal(replayed.state.decreesSigned.filter(day=>day===4).length,1);
 // Confirm one actual improvement: spend once, create the order, then expose its waiting state.
 await council.getByRole('button',{name:'Fechar painel',exact:true}).tap();
 await nav().getByRole('button',{name:'Cidades',exact:true}).tap();await page.getByRole('button',{name:'Ver cidade Capital',exact:true}).tap();
 await page.getByRole('tab',{name:'Setores',exact:true}).tap();await page.getByRole('button',{name:'Ver setor Economia',exact:true}).tap();
 const economy=page.getByRole('dialog',{name:'Economia',exact:true});
 response=page.waitForResponse(reply=>reply.url()===endpoint&&reply.request().method()==='POST'&&reply.request().postDataJSON()?.action?.type==='upgrade');
 await economy.getByRole('button',{name:'Evoluir Economia',exact:true}).tap();reply=await response;assert.equal(reply.status(),200,await reply.text());
 const upgraded=await reply.json();assert(upgraded.state.resources.materials<result.state.resources.materials);assert(upgraded.state.orders.some(order=>order.kind==='upgrade'&&order.sector==='economy'));
 await page.getByRole('button',{name:'Ver setor Economia',exact:true}).tap();assert.equal(await economy.getByRole('button',{name:'Evoluir Economia',exact:true}).isDisabled(),true);
 await page.screenshot({path:path.join(root,'reports/cozy/welcoming-upgrade-waiting-390.png')});
 await economy.getByRole('button',{name:'Fechar setor',exact:true}).tap();
 console.log('PASS mobile smart decisions: real v3 SQL/API, local/council resource exchanges, gold/material/supply PNGs, tap-to-explain, selection without spending, explicit confirmation, risk cost/failure inspection and 320/390/430 layout.');
}catch(error){console.error(log);throw error;}finally{if(browser)await browser.close();server.kill();await rest.close();await db.close();}
