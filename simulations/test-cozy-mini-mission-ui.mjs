import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';
import {createCozyFoundingDatabase} from './lib/cozy-founding-fixture.mjs';
import {startCozyRest} from './lib/cozy-fixture.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const db=await createCozyFoundingDatabase({persistent:true});
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const {port}=socket.address();await new Promise(r=>socket.close(r));
const rest=await startCozyRest(db),base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{cwd:root,windowsHide:true,env:{...process.env,NEXT_DIST_DIR:'.next-mini-mission-test',KW_COZY_PERSISTENT_PREVIEW:'1',NEXT_PUBLIC_SUPABASE_URL:rest.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-public',SUPABASE_SECRET_KEY:'fixture-service',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'},stdio:'ignore'});
let browser;
try {
 for(let i=0;i<90;i++){try{if((await fetch(base+'/api/release')).ok)break;}catch{}await new Promise(r=>setTimeout(r,1000));if(i===89)throw Error('Servidor não iniciou');}
 browser=await chromium.launch();const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addCookies([{name:'kw_dev_auth',value:'1',url:base}]);const page=await context.newPage();
 const request=async(url,body)=>{const res=await page.request.fetch(base+url,{method:body?'POST':'GET',...(body?{data:body}:{})});assert.equal(res.status(),200,await res.text());return res.json();};
 const {world}=await request('/api/worlds/create',{name:'Teste de encontros',mode:'express'}),endpoint=`/api/worlds/${world.slug}/cozy`;
 const initial=await request(endpoint),act=action=>request(endpoint,{action,requestId:crypto.randomUUID(),playerId:initial.state.playerId});
 await act({type:'king_choose',profileId:'builder',nickname:initial.state.playerName});
 await act({type:'counselor',slot:0,counselorId:'helena'});await act({type:'counselor',slot:1,counselorId:'ines'});
 const hired=await act({type:'hire',role:'engineer'}),tile=hired.tiles.find(x=>x.foundation?.canFound);
 const founded=await act({type:'found_capital',q:tile.q,r:tile.r,name:'Aurora',heroId:hired.state.heroes[0].id});
 delete founded.state.firstAudience;founded.state.army.militia=100;founded.state.resources.supplies=500;
 await db.query('update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2',[JSON.stringify(founded.state),founded.state.playerId]);
 await context.addInitScript(id=>{for(const screen of ['crown','cities','city','council','influence'])localStorage.setItem(`kw-screen-help:v1:${screen}:${id}`,'seen');},founded.state.playerId);
 await page.goto(base+`/world/${world.slug}/intelligence`,{waitUntil:'networkidle'});
 const card=page.getByRole('button',{name:/Encontro disponível/});await card.waitFor();await card.tap();
 const dialog=page.getByRole('dialog').filter({hasText:'Encontro opcional'});await dialog.waitFor();
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));await dialog.getByRole('button',{name:'Enviar exército'}).scrollIntoViewIfNeeded();assert(await dialog.getByRole('button',{name:'Enviar exército'}).isEnabled());}
 await page.setViewportSize({width:390,height:844});await dialog.getByRole('button',{name:'Enviar exército'}).scrollIntoViewIfNeeded();
 const images=await dialog.locator('svg image').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')));assert(images.length>=3);for(const src of images){const response=await page.request.get(new URL(src,base).href);assert(response.ok(),`asset ${src}: ${response.status()}`);}await page.waitForLoadState('networkidle');
 await page.screenshot({path:path.join(root,'reports/cozy/mini-missao-390.png')});
 const pending=page.waitForResponse(res=>res.url().endsWith(endpoint)&&res.request().method()==='POST'&&res.request().postDataJSON()?.action?.type==='mini_mission');
 await dialog.getByRole('button',{name:'Enviar exército'}).tap();const response=await pending;assert.equal(response.status(),200,await response.text());
 const updated=await response.json();assert(updated.state.orders.some(o=>o.miniMission));
 await page.getByText(/Retorno em/).first().waitFor();console.log('PASS celular: 320/390/430, detalhes acessíveis e envio real via API.');
} finally {await browser?.close();server.kill();await rest.close();await db.close();}
