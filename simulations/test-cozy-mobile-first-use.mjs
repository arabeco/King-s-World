// Start run-cozy-mobile-review.mjs first. All game mutations below are UI taps.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {dismissSupplementaryGuides} from './lib/dismiss-supplementary-guides.mjs';
const reports=new URL('../reports/cozy/mobile-review/',import.meta.url);
const session=JSON.parse(await readFile(new URL('session.json',reports),'utf8'));
assert.equal(session.base,'http://127.0.0.1:3339');
const browser=await chromium.connectOverCDP(session.cdp),context=await browser.newContext({viewport:{width:360,height:740},isMobile:true,hasTouch:true,deviceScaleFactor:1,extraHTTPHeaders:{'x-kw-smoke':'1'}}),page=await context.newPage();
const checks=[],errors=[];
await dismissSupplementaryGuides(page);
page.on('pageerror',e=>errors.push(e.message));
let slug;
async function tap(locator){await locator.tap();}
async function command(type,trigger){const [response]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/cozy')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action?.type===type),trigger()]);assert.equal(response.status(),200,await response.text());return response.json();}
async function data(){const response=await page.request.get(`${session.base}/api/worlds/${slug}/cozy`);assert.equal(response.status(),200);return response.json();}
async function shot(name){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');await page.screenshot({path:new URL(name+'.png',reports).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});}
async function guide(title){const h=page.getByRole('dialog',{name:title,exact:true});if(!await h.count())return;await tap(h.getByRole('button',{name:'Próximo',exact:true}));await tap(h.getByRole('button',{name:'Próximo',exact:true}));await tap(h.getByRole('button',{name:'Entendi',exact:true}));}
async function closePanel(){await tap(page.getByRole('button',{name:'Fechar painel',exact:true}));}
async function step(name,fn){await fn();checks.push(name);console.log('PASS',name);}
try{
 await context.addCookies([{name:'kw_dev_auth',value:'first_'+Date.now(),url:session.base}]);
 await page.setViewportSize({width:360,height:740});
 await page.goto(session.base+'/lobby',{waitUntil:'networkidle'});
 await step('New player creates Express through lobby, with no injected resources',async()=>{
  await tap(page.getByRole('button',{name:'Expresso · 30 dias reais',exact:true}));
  await page.getByPlaceholder('Nome do mundo').fill('Primeira jornada móvel');
  const response=page.waitForResponse(r=>r.url().endsWith('/api/worlds/create')&&r.request().method()==='POST');
  await tap(page.getByRole('button',{name:'Criar',exact:true}));assert.equal((await response).status(),200);
  await tap(page.getByRole('button',{name:'Entrar no mundo',exact:true}));await page.waitForURL('**/world/**');await page.waitForLoadState('networkidle');
  slug=page.url().split('/world/')[1].split('/')[0];const d=await data();assert.equal(d.computed.influence.total,0);assert.equal(d.world.economyVersion,2);assert.equal(d.state.resources.gold,350);
  await shot('first-use-01-entry-360');
 });
 await step('Choose royal profile, then start at zero influence',async()=>{
  await tap(page.getByRole('button',{name:'Escolha seu perfil de rei',exact:true}));
  await tap(page.getByRole('button',{name:'Fechar perfil',exact:true}));
  await command('start_world',()=>tap(page.getByRole('button',{name:'Abrir os portões',exact:true})));
  await tap(page.getByRole('button',{name:'Escolha seu perfil de rei',exact:true}));
  await page.getByLabel('Nome do governante',{exact:true}).fill('Aurora');
  await tap(page.getByRole('button',{name:/^Construtor/}));
  await command('king_choose',()=>tap(page.getByRole('button',{name:'Iniciar meu reinado',exact:true})));
  assert.equal((await data()).computed.influence.total,0);
 });
 await step('Read infrastructure and city guides; preview/pay two actual levels',async()=>{
  await tap(page.getByRole('button',{name:'Infraestrutura',exact:true}));await guide('Como evoluir suas cidades');
  await tap(page.getByRole('button',{name:'Ver cidade Capital',exact:true}));await guide('Como cuidar da sua cidade');
  await tap(page.getByRole('button',{name:'Ver setor Economia',exact:true}));
  const planner=page.getByRole('region',{name:'Planejar fila',exact:true});
  await planner.getByText('Economia · nível 1 → 3',{exact:true}).waitFor();await planner.getByText('Pagamento agora',{exact:true}).waitFor();
  await shot('first-use-02a-sector-action-360');await planner.scrollIntoViewIfNeeded();await shot('first-use-02-plan-preview-360');
  const before=await data();const after=await command('plan_upgrade',()=>tap(planner.getByRole('button',{name:'Planejar 2 níveis de Economia',exact:true})));
  const orders=after.state.orders.filter(o=>o.kind==='upgrade');assert.equal(orders.length,2);assert.equal(orders.reduce((v,o)=>v+o.planned.cost.materials,0),481);
  assert(after.state.resources.materials>=before.state.resources.materials-481);assert(after.state.resources.materials<before.state.resources.materials-476);
  assert.equal(after.computed.influence.infrastructure,0,'Work gives influence only on completion');
  await tap(page.getByRole('button',{name:'Fechar setor',exact:true}));await tap(page.getByRole('button',{name:'Coroa',exact:true}));
 });
 await step('Orders distinguish active/queued and show successive result levels at zero queued progress',async()=>{
  await tap(page.getByRole('button',{name:/1 ativa · 1 na fila/}));
  const orders=page.getByRole('region',{name:'Ordens do reino',exact:true});
  await orders.getByText('Agendada · começa automaticamente',{exact:true}).waitFor();
  const cards=orders.locator('article');assert.match(await cards.nth(0).innerText(),/Nível 1\s*2/);assert.match(await cards.nth(1).innerText(),/Nível 2\s*3/);
  assert.equal(await cards.nth(1).getByRole('progressbar').getAttribute('aria-valuenow'),'0');
  await shot('first-use-03-orders-360');await closePanel();await page.reload({waitUntil:'networkidle'});
  assert.equal((await data()).state.orders.length,2);
 });
 await step('Cancellation discloses scope/refund; review and keep do not mutate plans',async()=>{
  await tap(page.getByRole('button',{name:'Cidades',exact:true}));await tap(page.getByRole('button',{name:'Ver cidade Capital',exact:true}));await tap(page.getByRole('button',{name:'Ver setor Economia',exact:true}));
  const planner=page.getByRole('region',{name:'Planejar fila',exact:true});const before=await data();
  await tap(planner.getByRole('button',{name:'Cancelar daqui em diante',exact:true}));
  const confirm=planner.getByRole('group',{name:'Confirmar cancelamento de planos',exact:true});assert.match(await confirm.innerText(),/277/);assert.equal((await data()).state.orders.length,2);
  await tap(confirm.getByRole('button',{name:'Manter planos',exact:true}));assert.equal((await data()).state.orders.length,2);
  await tap(planner.getByRole('button',{name:'Cancelar daqui em diante',exact:true}));await shot('first-use-04-cancel-review-360');
  const after=await command('cancel_plan',()=>tap(confirm.getByRole('button',{name:'Confirmar cancelamento',exact:true})));
  assert.equal(after.state.orders.length,1);assert(after.state.resources.materials>=before.state.resources.materials+277);assert.equal(after.state.orders[0].planned.started,true);
  await tap(page.getByRole('button',{name:'Fechar setor',exact:true}));await tap(page.getByRole('button',{name:'Coroa',exact:true}));
 });
 await step('Recruit five troops with visible real cost and inspect horde defense',async()=>{
  await tap(page.getByRole('button',{name:'Militar',exact:true}));await guide('Como preparar seu exército');
  const d=await data();await page.getByRole('button',{name:'Selecionar 5 Milícia',exact:true}).tap();const button=page.getByRole('button',{name:'Recrutar 5 Milícia',exact:true});await button.waitFor();
  const box=await button.boundingBox();assert(box.height>=44);
  const after=await command('recruit',()=>tap(button));assert.equal(after.state.army.militia,d.state.army.militia+5);
  await tap(page.getByRole('tab',{name:'Defesa',exact:true}));await page.getByRole('article',{name:'Preparação para a próxima horda'}).waitFor();
  await shot('first-use-05-military-defense-360');
  await closePanel();
  await page.getByRole('button',{name:'Governo',exact:true}).click();
  await guide('Como conduzir seu governo');
  await page.getByRole('tab',{name:'Pesquisas',exact:true}).click();
  await page.getByRole('button',{name:'Ver pesquisa Muralhas do reino',exact:true}).click();
  await page.getByRole('button',{name:'Pesquisar Muralhas do reino',exact:true}).waitFor();
  await closePanel();
 });
 await step('Hire and assign a hero; research queue gives a useful insufficient-gold message',async()=>{
  await tap(page.getByRole('button',{name:'Governo',exact:true}));
  await tap(page.getByRole('tab',{name:'Heróis',exact:true}));
  const hired=await command('hire',()=>tap(page.getByRole('button',{name:'Contratar Administrador',exact:true})));const hero=hired.state.heroes[0];
  await command('assign',()=>page.getByLabel(`Cidade de ${hero.name}`,{exact:true}).selectOption(hired.state.cities[0].id));assert.equal((await data()).computed.influence.government,30);
  await tap(page.getByRole('tab',{name:'Pesquisas',exact:true}));const planner=page.getByRole('region',{name:'Planejar fila',exact:true});await planner.getByLabel('Pesquisa',{exact:true}).selectOption('economy');
  await planner.getByLabel('Níveis a acrescentar',{exact:true}).selectOption('4');assert(await planner.getByRole('button',{name:'Planejar 4 níveis de Cultivo e ofícios',exact:true}).isDisabled());assert.match(await planner.getByRole('status').innerText(),/Faltam .*ouro/);
  await shot('first-use-06-insufficient-gold-360');await planner.getByLabel('Níveis a acrescentar',{exact:true}).selectOption('2');
  await command('plan_research',()=>tap(planner.getByRole('button',{name:'Planejar 2 níveis de Cultivo e ofícios',exact:true})));await closePanel();
 });
 await step('Council choice and achievements show real recognition without free quest claims',async()=>{
  await tap(page.getByRole('button',{name:'Conselho',exact:true}));await guide('Como decidir no Conselho');
  const before=await data();await page.locator('button[aria-pressed=false]').filter({has:page.getByLabel('Consequências previstas')}).first().tap();const after=await command('decree',()=>tap(page.getByRole('button',{name:'Assinar',exact:true})));assert(after.computed.influence.society>before.computed.influence.society);await shot('first-use-07-council-360');await closePanel();
  await tap(page.getByRole('button',{name:'Conquistas',exact:true}));await guide('Como acompanhar suas conquistas');await page.getByRole('tab',{name:'Vitória',exact:true}).tap();assert.match(await page.getByRole('dialog',{name:'Conquistas',exact:true}).innerText(),/1[.\s]?500/);await shot('first-use-08-victory-360');await closePanel();
 });
 await step('Influence opens all five destinations; resume preserves real orders at 360/390 px',async()=>{
  for(const name of ['Infraestrutura','Governo','Militar','Conselho','Conquistas']){await tap(page.getByRole('button',{name:/^Influência:/}));await tap(page.getByRole('button',{name:`Abrir progresso de ${name}`,exact:true}));await page.getByRole('dialog',{name,exact:true}).waitFor();await closePanel();}
  const before=await data();await page.reload({waitUntil:'networkidle'});const after=await data();assert.deepEqual(after.state.orders.map(o=>o.id),before.state.orders.map(o=>o.id));
  for(const width of [360,390]){await page.setViewportSize({width,height:740});await shot(`first-use-09-resume-${width}`);}
  assert.deepEqual(errors,[]);
 });
 await step('Alliance, treasury and reports have useful first-use states without map navigation',async()=>{
  await tap(page.getByRole('button',{name:'Aliança',exact:true}));await guide('Como jogar em aliança');
  await page.getByLabel('Nome da sua aliança',{exact:true}).fill('Companhia Aurora');
  await command('alliance_create',()=>tap(page.getByRole('button',{name:'Criar aliança',exact:true})));
  assert((await data()).state.allianceId);await shot('first-use-10-alliance-360');
  await tap(page.getByRole('button',{name:'Coroa',exact:true}));await tap(page.getByRole('button',{name:'Tesouro do reino',exact:true}));await shot('first-use-11-treasury-360');await closePanel();
  await tap(page.getByRole('button',{name:'Relatos',exact:true}));await shot('first-use-12-reports-360');
 });
 await step('Research planner and five-area progress fit 390 px with touch-sized controls',async()=>{
  await page.setViewportSize({width:390,height:740});await tap(page.getByRole('button',{name:'Coroa',exact:true}));
  await tap(page.getByRole('button',{name:/^Influência:/}));await shot('first-use-13-five-areas-390');
  await tap(page.getByRole('button',{name:'Abrir progresso de Governo',exact:true}));await tap(page.getByRole('tab',{name:'Pesquisas',exact:true}));
  const planner=page.getByRole('region',{name:'Planejar fila',exact:true});await planner.scrollIntoViewIfNeeded();
  for(const control of await planner.locator('button,select').all()){const box=await control.boundingBox();if(box)assert(box.height>=44,'Planning controls need a 44px touch target');}
  await shot('first-use-14-planner-390');await closePanel();
 });
 await writeFile(new URL('first-use-result.json',reports),JSON.stringify({status:'PASS',scope:'Local disposable PostgreSQL + real Next routes + touch-enabled Chromium; UI mutations only, normal resources, no map edits, no physical Android.',checks,slug},null,2));
}catch(error){await shot('first-use-FAIL');await writeFile(new URL('first-use-result.json',reports),JSON.stringify({status:'FAIL',checks,error:String(error),body:await page.locator('body').innerText()},null,2));throw error;}
finally{await browser.close();}
