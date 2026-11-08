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
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{cwd:root,windowsHide:true,env:{...process.env,NEXT_DIST_DIR:'.next-map-occupation-test',NEXT_PUBLIC_SUPABASE_URL:rest.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-public',SUPABASE_SECRET_KEY:'fixture-service',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'},stdio:['ignore','pipe','pipe']});
let browser,page,log='';server.stdout.on('data',b=>log=(log+b).slice(-5000));server.stderr.on('data',b=>log=(log+b).slice(-5000));
try{
 for(let i=0;i<90;i++){try{await fetch(base+'/login');break;}catch{await new Promise(r=>setTimeout(r,1000));}}
 browser=await chromium.launch();const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,extraHTTPHeaders:{'x-kw-smoke':'1'}});await context.addCookies([{name:'kw_dev_auth',value:'occupation-ui',url:base}]);page=await context.newPage();
 const create=await page.request.post(base+'/api/worlds/create',{data:{name:'Occupation UI',mode:'express'}});assert.equal(create.status(),200,await create.text());const made=await create.json(),slug=made.world.slug,endpoint=base+`/api/worlds/${slug}/cozy`;
 const command=async action=>{const reply=await page.request.post(endpoint,{data:{requestId:crypto.randomUUID(),action}});assert.equal(reply.status(),200,await reply.text());return reply.json();};
 await command({type:'start_world'});let data=await command({type:'king_choose',profileId:'builder',nickname:'Account king'});assert.equal(data.world.economyVersion,3);
 const city=data.state.cities[0],target=data.tiles.find(t=>!t.ownerId&&!L.sanctuaryAt(t)&&Math.max(Math.abs(t.q-city.q),Math.abs(t.r-city.r),Math.abs(t.q+t.r-city.q-city.r))===2);assert(target);
 data.state.explored.push(target.id);data.state.resources={gold:1000,materials:2000,supplies:1000};
 data.shared.independentCities??={};data.shared.independentCities[target.id]={city:{...structuredClone(city),id:'npc-fixture',capital:false,name:'Vila do Vale',q:target.q,r:target.r,sectors:{administration:1,economy:1,society:1,recruitment:1,defense:4}},formerOwnerId:'fixture',at:Date.now(),reason:'horde'};
 const save=async()=>{await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(data.state),data.state.playerId]);await db.query('update kw_cozy_world_states set state_json=$1::jsonb,revision=revision+1 where world_id=$2',[JSON.stringify(data.shared),data.world.id]);};await save();
 await context.addInitScript(id=>{for(const screen of ['crown','map','military','city','government'])localStorage.setItem(`kw-screen-help:v1:${screen}:${id}`,'seen');},data.state.playerId);
 const open=async()=>{await page.goto(base+`/world/${slug}/intelligence`,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Mundo',exact:true}).tap();await page.locator(`[data-cozy-tile="${target.id}"]`).tap({force:true});await page.getByText('Controle · 100%',{exact:true}).waitFor();};await open();
 assert.equal(await page.getByRole('group',{name:'Herói para anexar cidade'}).count(),0);await page.getByRole('button',{name:/Atacar cidade/}).waitFor();
 await mkdir(path.join(root,'reports/cozy'),{recursive:true});await page.screenshot({path:path.join(root,'reports/cozy/city-control-100-390.png')});
 data.shared.npcResistance={[target.id]:{initial:100,remaining:24,at:Date.now()}};data.state.heroes.push({id:'free-general',name:'Gareth',role:'general',cityId:null});await save();
 await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Mundo',exact:true}).tap();await page.locator(`[data-cozy-tile="${target.id}"]`).tap({force:true});await page.getByText('Controle · 24%',{exact:true}).waitFor();
 const slots=page.getByRole('group',{name:'Herói para anexar cidade',exact:true});await slots.waitFor();assert.equal(await slots.locator('select').count(),0);let writes=0;page.on('request',request=>{if(request.method()==='POST'&&request.url()===endpoint)writes++;});await slots.getByRole('button',{name:'Escolher Gareth para anexar',exact:true}).tap();assert.equal(writes,0,'Selecting a hero slot does not dispatch an occupation');
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const cta=page.getByRole('button',{name:/Anexar cidade/});await cta.waitFor();const button=await cta.boundingBox(),panel=await page.getByRole('dialog',{name:'Vila do Vale',exact:true}).boundingBox();assert(button&&panel&&button.y>=panel.y&&button.y+button.height<=panel.y+panel.height+1,'The action must remain visible without scrolling');}
 await page.setViewportSize({width:390,height:844});await page.getByRole('dialog',{name:'Vila do Vale',exact:true}).evaluate(el=>{el.scrollTop=0;const body=el.querySelector(':scope>div');if(body)body.scrollTop=0;});await page.screenshot({path:path.join(root,'reports/cozy/city-control-24-390.png')});console.log('PASS new v3 world through real SQL/API: control 100% shows attack without hero; 24% shows occupation and hero slots; selecting a slot never posts; 320/390/430 mobile layout.');
 // A real founding command uses the same empty-hero slot and the server's quote.
 data.state.explored=Array.from({length:21},(_,q)=>Array.from({length:21},(_,r)=>({q:data.state.cities[0].q+q-10,r:data.state.cities[0].r+r-10}))).flat().filter(c=>Math.abs(c.q)<=40&&Math.abs(c.r)<=40&&Math.abs(c.q+c.r)<=40).map(c=>`${c.q},${c.r}`);await save();
 const prepared=await (await page.request.get(endpoint)).json();const site=prepared.tiles.filter(t=>t.foundation?.canFound).sort((a,b)=>a.distance-b.distance)[0];assert(site);
 await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Mundo',exact:true}).tap();
 const visibleTarget=page.locator(`[data-cozy-tile="${site.id}"]`);
 if(await visibleTarget.isVisible())await visibleTarget.tap({force:true});else throw Error('Founding fixture must be in the nearby camera');
 await page.getByRole('group',{name:'Herói para fundar cidade',exact:true}).waitFor();
 await page.getByRole('button',{name:'Escolher Gareth para fundar',exact:true}).tap();
 const response=page.waitForResponse(reply=>reply.url()===endpoint&&reply.request().method()==='POST'&&reply.request().postDataJSON()?.action?.type==='found_city');
 await page.getByRole('button',{name:'Fundar cidade',exact:true}).tap();const reply=await response;assert.equal(reply.status(),200,await reply.text());const dispatched=await reply.json();assert(dispatched.state.orders.some(o=>o.foundation));assert.equal(dispatched.state.cities.length,1);assert.equal(dispatched.state.heroes.find(h=>h.id==='free-general').cityId,null);
 console.log('PASS mobile foundation: known free terrain, portrait slot, quoted investment, explicit dispatch and no instant city or premature hero assignment.');
}catch(error){console.error(log);throw error;}finally{if(browser)await browser.close();server.kill();await rest.close();await db.close();}
