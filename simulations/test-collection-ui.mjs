import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {createCozyDatabase,startCozyRest} from './lib/cozy-fixture.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),db=await createCozyDatabase();
await db.exec('create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;');
for(const name of ['11_SQL_PREMIUM_ENTITLEMENTS_PLAYSTORE.sql','63_SQL_COZY_EXPRESS_ECONOMY.sql','65_SQL_COZY_LOBBY.sql','66_SQL_ROYAL_ATTRIBUTES.sql','67_SQL_ACCOUNT_APPEARANCE.sql','68_SQL_COLLECTION_WALLET.sql','69_SQL_KING_GAMEPLAY_PROGRESSION.sql','70_SQL_COLLECTION_SEASON_REWARDS.sql','71_SQL_COZY_PREMIUM_BENEFITS.sql','73_SQL_SEASON_POSITION_REWARDS.sql','75_SQL_PLAY_GEM_PURCHASES.sql'])await db.exec(await readFile(path.join(root,name),'utf8'));
const listener=createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
const rest=await startCozyRest(db),base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{cwd:root,windowsHide:true,env:{...process.env,NEXT_DIST_DIR:'.next-collection-test',NEXT_PUBLIC_SUPABASE_URL:rest.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-public',SUPABASE_SECRET_KEY:'fixture-service',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'},stdio:['ignore','pipe','pipe']});
let browser,page,log='';server.stdout.on('data',b=>{log=(log+b).slice(-6000);});server.stderr.on('data',b=>{log=(log+b).slice(-6000);});
try{
 for(let i=0;i<90;i++){try{await fetch(base+'/login');break;}catch{await new Promise(r=>setTimeout(r,1000));}}
 browser=await chromium.launch();const context=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:{'x-kw-smoke':'1'}});await context.addCookies([{name:'kw_dev_auth',value:'collectionui',url:base}]);page=await context.newPage();
 await page.goto(base+'/profile',{waitUntil:'networkidle'});const collection=page.getByRole('region',{name:'Coleção de reis',exact:true});
 const collectionCheck=await page.request.get(base+'/api/me/collection');assert.equal(collectionCheck.status(),200,await collectionCheck.text());
 await collection.getByText('Nível 1',{exact:true}).waitFor();assert.equal(await collection.locator('article').count(),4);
 const secondKing=collection.locator('article').nth(1);
 await secondKing.getByRole('button',{name:/^Destacar /}).click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-king]')[1]?.getAttribute('data-focused')==='true');
 assert.equal(await secondKing.getAttribute('data-selected'),'false','Browsing does not equip the king');
 await collection.locator('article').first().getByRole('button',{name:/^Destacar /}).click();

 await collection.getByRole('button',{name:'Ver todos os reis (22)',exact:true}).click();assert.equal(await collection.locator('article').count(),22);
 await collection.getByRole('button',{name:'Mostrar só meus reis',exact:true}).click();assert.equal(await collection.locator('article').count(),4);
 assert.equal(await page.getByText('Nível da conta',{exact:true}).count(),0);
 assert.equal(await collection.getByRole('heading',{name:'Equipamentos',exact:true}).count(),0);
 const me=(await (await page.request.get(base+'/api/me/profile')).json()).profile;
 await db.exec('create unique index test_users_username_folded on users(lower(username));');
 await db.query("insert into users(username,email) values('TakenNick','taken@test.invalid')");
 for(const username of ['ab','x'.repeat(25),'a b','a-b','ábc',123,null])assert.equal((await page.request.patch(base+'/api/me/profile',{data:{username}})).status(),400);
 assert.equal((await page.request.patch(base+'/api/me/profile',{data:{username:'takenNICK'}})).status(),409);
 assert.equal((await page.request.patch(base+'/api/me/profile',{data:{username:'ForgedOrigin'},headers:{origin:'https://foreign.invalid'}})).status(),403);
 await page.getByText('Configurações da conta',{exact:true}).click();await page.getByRole('button',{name:'Editar nick',exact:true}).click();await page.getByRole('textbox',{name:'Nickname da conta',exact:true}).fill('takenNICK');await page.getByRole('button',{name:'Salvar nick',exact:true}).click();await page.getByRole('alert').getByText('Esse nick já está em uso.',{exact:true}).waitFor();
 await page.getByRole('textbox',{name:'Nickname da conta',exact:true}).fill('GlobalKing');await page.getByRole('button',{name:'Salvar nick',exact:true}).click();await collection.getByRole('heading',{name:'GlobalKing',exact:true}).waitFor();
 assert.equal((await (await page.request.get(base+'/api/me/profile')).json()).profile.username,'GlobalKing');
 console.log('PASS account-only nickname: 3–24 ASCII letters/numbers/underscore, invalid types, case-insensitive uniqueness, foreign-origin denial and mobile save');

 await db.query("update kw_player_inventory set xp=25 where user_id=$1 and product_id='sovereign-01'",[me.id]);
 await page.reload({waitUntil:'networkidle'});await collection.getByText('Nível 2',{exact:true}).waitFor();
 await collection.getByText('1 ponto disponível',{exact:true}).click();
 await collection.locator('div').filter({has:page.getByText('Administração · 5 base + 0',{exact:true})}).last().getByRole('button',{name:'+1',exact:true}).click();
 await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Confirmar ponto permanente'}).waitFor({state:'hidden'});await collection.getByText('1 ponto disponível',{exact:true}).waitFor();
 await collection.locator('div').filter({has:page.getByText('Administração · 5 base + 0',{exact:true})}).last().getByRole('button',{name:'+1',exact:true}).click();
 const pointDialog=page.getByRole('dialog',{name:'Confirmar ponto permanente'});
 await page.route('**/api/me/king-stats',async route=>{await route.fulfill({status:503,json:{error:'Falha de conexão antes de salvar.'}});});
 await pointDialog.getByRole('button',{name:'Confirmar ponto',exact:true}).click();await pointDialog.getByRole('button',{name:'Conferir resultado',exact:true}).waitFor();assert.equal(await pointDialog.getByRole('button',{name:'Confirmar ponto',exact:true}).count(),0);
 await page.route('**/api/me/collection',route=>route.fulfill({status:503,json:{error:'Coleção temporariamente indisponível.'}}));
 await pointDialog.getByRole('button',{name:'Conferir resultado',exact:true}).click();await pointDialog.getByText('Coleção temporariamente indisponível.',{exact:true}).waitFor();await page.unroute('**/api/me/collection');
 await pointDialog.getByRole('button',{name:'Conferir resultado',exact:true}).click();await pointDialog.getByText('Nenhuma alteração encontrada. Você pode confirmar o ponto.',{exact:true}).waitFor();await page.unroute('**/api/me/king-stats');
 let pointRequest;
 await page.route('**/api/me/king-stats',async route=>{pointRequest=route.request().postDataJSON();const response=await route.fetch();assert.equal(response.status(),200);await route.fulfill({status:503,json:{error:'Resposta perdida após salvar o ponto.'}});});
 await pointDialog.getByRole('button',{name:'Confirmar ponto',exact:true}).click();await pointDialog.getByRole('button',{name:'Conferir resultado',exact:true}).waitFor();await page.unroute('**/api/me/king-stats');assert.deepEqual(pointRequest,{kingId:'sovereign-01',stat:'administration',revision:0});
 await pointDialog.getByRole('button',{name:'Conferir resultado',exact:true}).click();await pointDialog.waitFor({state:'hidden'});
 await collection.getByText('Administração · 5 base + 1',{exact:true}).waitFor();await collection.getByText('0 pontos disponíveis',{exact:true}).waitFor();
 // Another tab spends the remaining point after this tab opened its confirmation.
 await db.query("update kw_player_inventory set xp=100 where user_id=$1 and product_id='sovereign-01'",[me.id]);await page.reload({waitUntil:'networkidle'});await collection.getByText('1 ponto disponível',{exact:true}).click();
 await collection.locator('div').filter({has:page.getByText('Exploração · 5 base + 0',{exact:true})}).last().getByRole('button',{name:'+1',exact:true}).click();
 await db.query('select kw_king_add_stat($1,$2,$3,$4)',[me.id,'sovereign-01','command',1]);
 await pointDialog.getByRole('button',{name:'Confirmar ponto',exact:true}).click();await pointDialog.getByText('Este rei mudou em outra aba. Atualize a coleção.',{exact:true}).waitFor();await pointDialog.getByRole('button',{name:'Conferir resultado',exact:true}).click();await pointDialog.waitFor({state:'hidden'});
 await collection.getByText('Comando · 5 base + 1',{exact:true}).waitFor();await collection.getByText('Exploração · 5 base + 0',{exact:true}).waitFor();await collection.getByText('0 pontos disponíveis',{exact:true}).waitFor();
 console.log('PASS permanent points: failed write, failed reconciliation, lost committed response and competing tab all recover without double spend or changing the chosen attribute');
 await page.screenshot({path:path.join(root,'reports/cozy/collection-profile-390.png'),fullPage:true});
 const accountNav=page.getByRole('navigation',{name:'Atalhos da conta',exact:true});
 await accountNav.locator('[aria-current="page"]').filter({hasText:'Perfil'}).waitFor();
 await accountNav.getByRole('link',{name:'Inventário',exact:true}).click();
 await page.waitForURL('**/inventory');
 await accountNav.locator('[aria-current="page"]').filter({hasText:'Inventário'}).waitFor();
 await page.goto(base+'/inventory?tab=equipment',{waitUntil:'networkidle'});const inventory=page.getByRole('region',{name:'Inventário',exact:true});await inventory.getByText('Livro de Ofícios',{exact:true}).waitFor();assert.equal(await inventory.locator('article').count(),3);
 const equipmentTab=inventory.getByRole('tab',{name:'Equipamentos',exact:true});assert.equal(await equipmentTab.getAttribute('aria-selected'),'true');await equipmentTab.focus();await page.keyboard.press('ArrowRight');await inventory.getByRole('tab',{name:'Brasões',exact:true}).waitFor();await inventory.locator('article').nth(19).waitFor();assert.equal(await inventory.locator('article').count(),20);await page.keyboard.press('Home');assert.equal(await inventory.getByRole('tab',{name:'Reis',exact:true}).getAttribute('aria-selected'),'true');await page.keyboard.press('End');assert.equal(await inventory.getByRole('tab',{name:'Brasões',exact:true}).getAttribute('aria-selected'),'true');assert.equal(new URL(page.url()).searchParams.get('tab'),'crest');await page.reload({waitUntil:'networkidle'});await inventory.getByRole('tab',{name:'Brasões',exact:true}).waitFor();await inventory.locator('article').nth(19).waitFor();assert.equal(await inventory.locator('article').count(),20);await equipmentTab.click();
 const inspect=inventory.getByRole('button',{name:'Ver detalhes de Livro de Ofícios',exact:true});await inspect.click();const itemDetail=page.getByRole('dialog',{name:'Livro de Ofícios',exact:true});await itemDetail.getByText('+1% Materiais',{exact:true}).waitFor();
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});const bounds=await itemDetail.boundingBox();assert(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y>=0&&bounds.y+bounds.height<=844);await page.keyboard.press('Tab');assert.equal(await itemDetail.evaluate(el=>el.contains(document.activeElement)),true);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'reports/cozy/inventory-item-detail-390.png')});await page.keyboard.press('Escape');await itemDetail.waitFor({state:'hidden'});assert.equal(await inspect.evaluate(el=>document.activeElement===el),true);
 console.log('PASS inventory category keyboard navigation, item effects/rarity, native dialog focus, Escape and 320/390/430 layout; canceling a permanent stat spends no point');
 const entitlementResponse=await page.request.get(base+'/api/me/entitlements');assert.equal(entitlementResponse.status(),200);const access=await entitlementResponse.json();assert.equal(access.benefits.worldLimit,1);assert(!JSON.stringify(access).includes('purchase_token'));assert(!JSON.stringify(access).includes('raw_payload'));
 await accountNav.getByRole('link',{name:'Loja',exact:true}).click();
 await accountNav.locator('[aria-current="page"]').filter({hasText:'Loja'}).waitFor();
 const shop=page.getByRole('region',{name:'Loja da Coroa'});await shop.getByRole('button',{name:'Faltam 50 Gemas',exact:true}).first().waitFor();
 await shop.getByRole('button',{name:'Premium',exact:true}).click();await page.getByRole('heading',{name:'Coroa Premium',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Em preparação',exact:true}).count(),5);
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.screenshot({path:path.join(root,'reports/cozy/collection-store-390.png'),fullPage:true});
 await db.query('update kw_player_wallet set gems=100 where user_id=$1',[me.id]);await page.reload({waitUntil:'networkidle'});
 const catalog=JSON.parse(await readFile(path.join(root,'lib/collection-catalog.json'),'utf8'));const product=catalog.find(p=>p.id==='sovereign-09');assert.equal(product.price,50);
 const card=shop.locator('article').filter({has:page.getByText(product.name,{exact:true})});await card.getByRole('button',{name:'Comprar',exact:true}).click();const purchaseDialog=page.getByRole('dialog',{name:'Confirmar compra',exact:true});await purchaseDialog.waitFor();
 await page.keyboard.press('Escape');await purchaseDialog.waitFor({state:'hidden'});assert.equal((await (await page.request.get(base+'/api/me/collection')).json()).gems,100);
 await card.getByRole('button',{name:'Comprar',exact:true}).click();let releasePurchase,committedPurchase;const purchaseGate=new Promise(resolve=>{releasePurchase=resolve;}),purchaseCommitted=new Promise(resolve=>{committedPurchase=resolve;});
 await page.route('**/api/me/collection',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();committedPurchase(response.status());await purchaseGate;await route.fulfill({response});});
 await purchaseDialog.getByRole('button',{name:'Confirmar compra',exact:true}).click();assert.equal(await purchaseCommitted,200);assert.equal(await purchaseDialog.getByRole('button',{name:'Comprando…',exact:true}).isDisabled(),true);await page.keyboard.press('Escape');assert.equal(await purchaseDialog.isVisible(),true);
 const purchaseReply=page.waitForResponse(r=>r.url().endsWith('/api/me/collection')&&r.request().method()==='POST');releasePurchase();const bought=await purchaseReply;assert.equal(bought.status(),200);await purchaseDialog.waitFor({state:'hidden'});await page.unroute('**/api/me/collection');
 const receipt=bought.request().postDataJSON();const duplicate=await page.request.post(base+'/api/me/collection',{data:receipt});assert.equal(duplicate.status(),200);const balance=await duplicate.json();assert.equal(balance.gems,50);assert.equal(balance.inventory.filter(p=>p.id===product.id).length,1);
 console.log('PASS Gem purchase: cancellation preserves balance, committed slow response prevents double purchase/dismissal, same receipt never spends twice');
 const retryProduct=catalog.find(p=>p.kind==='king'&&p.sale&&p.price===50&&p.id!==product.id);
 await shop.locator('article').filter({has:page.getByText(retryProduct.name,{exact:true})}).getByRole('button',{name:'Comprar',exact:true}).click();
 let uncertainRequest;
 await page.route('**/api/me/collection',async route=>{if(route.request().method()!=='POST')return route.continue();uncertainRequest=route.request().postDataJSON();const response=await route.fetch();assert.equal(response.status(),200);await route.fulfill({status:503,json:{error:'Conexão interrompida após confirmar a compra.'}});});
 await purchaseDialog.getByRole('button',{name:'Confirmar compra',exact:true}).click();await purchaseDialog.getByRole('alert').waitFor();await page.unroute('**/api/me/collection');
 assert.equal((await (await page.request.get(base+'/api/me/collection')).json()).gems,0);
 const recoveredPurchase=page.waitForResponse(r=>r.url().endsWith('/api/me/collection')&&r.request().method()==='POST');await purchaseDialog.getByRole('button',{name:'Confirmar compra',exact:true}).click();const recovered=await recoveredPurchase;assert.equal(recovered.status(),200);assert.deepEqual(recovered.request().postDataJSON(),uncertainRequest);await purchaseDialog.waitFor({state:'hidden'});
 const recoveredInventory=await (await page.request.get(base+'/api/me/collection')).json();assert.equal(recoveredInventory.gems,0);assert.equal(recoveredInventory.inventory.filter(p=>p.id===retryProduct.id).length,1);
 console.log('PASS committed purchase with lost response: retry preserves receipt and grants exactly once with no second debit');

 const created=await page.request.post(base+'/api/worlds/create',{data:{name:'Equipment isolation',mode:'normal'}});assert.equal(created.status(),200);const createdWorld=(await created.json()).world;
 await page.goto(base+createdWorld.href,{waitUntil:'networkidle'});const royal=page.getByRole('dialog',{name:'Seu governante',exact:true});await royal.waitFor();
 const endpoint=base+'/api/worlds/'+createdWorld.slug+'/cozy';
 for(const [index,crestId,crestFinish,status] of [[0,'extra-dragon','plain',400],[1,'../../foreign','plain',400],[2,'empire-crest-01','imperial',403]]){
  const response=await page.request.post(endpoint,{data:{requestId:'bad-crest-request-'+index,action:{type:'king_choose',profileId:'builder',nickname:'Gear King',crestId,crestFinish}}});assert.equal(response.status(),status);
 }
 for(const [index,items] of [['item-journey-crown','',''],['item-craft-ledger','item-craft-ledger',''],['','','','']].entries()){
  const response=await page.request.post(endpoint,{data:{requestId:'bad-gear-request-'+index,action:{type:'king_choose',profileId:'builder',nickname:'Gear King',equipment:items}}});assert.equal(response.status(),400);
 }
 const staleKing=await page.request.post(endpoint,{data:{requestId:'stale-king-selection',action:{type:'king_choose',profileId:'builder',nickname:'Gear King',kingId:'sovereign-04',statRevision:0,equipment:[]}}});assert.equal(staleKing.status(),409);
 const staleStats=await page.request.post(endpoint,{data:{requestId:'stale-king-stats-01',action:{type:'king_choose',profileId:'builder',nickname:'Gear King',kingId:'sovereign-01',statRevision:999,equipment:[]}}});assert.equal(staleStats.status(),409);
 await royal.getByRole('button',{name:'Escolher brasão do reino',exact:true}).click();const crests=page.getByRole('dialog',{name:'Brasão do reino',exact:true});await crests.getByRole('button',{name:'Brasão 07',exact:true}).waitFor();assert.equal(await crests.locator('div').getByRole('button',{name:/^Brasão/}).count(),20);await crests.locator('img').evaluateAll(async images=>{await Promise.all(images.map(async img=>{img.loading='eager';await img.decode();}));});assert.equal(await crests.locator('img').evaluateAll(images=>images.filter(img=>!img.complete||img.naturalWidth===0).length),0);await page.screenshot({path:path.join(root,'reports/cozy/world-crest-picker-390.png')});await crests.getByRole('button',{name:'Brasão 07',exact:true}).click();
 await royal.getByRole('button',{name:'Escolher equipamento do slot 1',exact:true}).click();const picker=page.getByRole('dialog',{name:'Escolher item do slot 1'});await picker.getByRole('button',{name:/Livro de Ofícios/}).waitFor();await page.screenshot({path:path.join(root,'reports/cozy/world-equipment-popup.png')});await picker.getByRole('button',{name:/Livro de Ofícios/}).click();
 await royal.getByRole('button',{name:'Escolher equipamento do slot 2',exact:true}).click();const second=page.getByRole('dialog',{name:'Escolher item do slot 2'});assert.ok(await second.getByRole('button',{name:/Livro de Ofícios/}).isDisabled());await second.getByRole('button',{name:'Deixar slot vazio',exact:true}).click();

 assert.equal(await royal.getByRole('textbox').count(),0,'Nickname is edited only in the account profile');
 await royal.getByRole('link',{name:'Preparar rei na coleção',exact:true}).click();await page.waitForURL('**/profile');await page.goBack({waitUntil:'networkidle'});await royal.waitFor();
 assert.equal(await royal.getByText('GlobalKing',{exact:true}).count(),1);await royal.getByRole('button',{name:'Escolher equipamento do slot 1',exact:true}).getByRole('img',{name:'Livro de Ofícios',exact:true}).waitFor();assert.match(await royal.getByRole('button',{name:'Escolher brasão do reino',exact:true}).innerText(),/Brasão 07/);
 await page.reload({waitUntil:'networkidle'});await royal.waitFor();assert.equal(await royal.getByText('GlobalKing',{exact:true}).count(),1);await royal.getByRole('button',{name:'Escolher equipamento do slot 1',exact:true}).getByRole('img',{name:'Livro de Ofícios',exact:true}).waitFor();
 console.log('PASS preparation survives profile navigation, browser Back and reload with account nickname, equipment and crest preserved');
 let firstRequest=null;
 await page.route('**/api/worlds/*/cozy',async route=>{
  const request=route.request();if(request.method()==='POST'&&request.postDataJSON()?.action?.type==='king_choose'){firstRequest=request.postDataJSON();await route.fulfill({status:503,json:{error:'Falha local simulada'}});}else await route.continue();
 });
 await royal.getByRole('button',{name:'Iniciar meu reinado',exact:true}).click();
 const recovery=page.getByRole('button',{name:'Confirmar resultado',exact:true});await recovery.waitFor();
 assert.equal(await royal.getByRole('textbox').count(),0);
 assert.equal(await royal.getByRole('button',{name:'Escolher equipamento do slot 1',exact:true}).isDisabled(),true);
 await page.unroute('**/api/worlds/*/cozy');
 const commit=page.waitForResponse(r=>r.url()===endpoint&&r.request().method()==='POST');await recovery.click();const committed=await commit;assert.equal(committed.status(),200);assert.deepEqual(committed.request().postDataJSON(),firstRequest,'Recovery repeats the exact request and selected loadout');
 await royal.waitFor({state:'hidden'});
 await page.getByRole('dialog',{name:'Como comandar seu reino',exact:true}).getByRole('button',{name:'Fechar ajuda',exact:true}).click();
 await page.getByRole('button',{name:'Perfil do reinado',exact:true}).click();
 const reignProfile=page.getByRole('dialog',{name:'Perfil do reinado',exact:true});
 await reignProfile.getByRole('img',{name:'Livro de Ofícios',exact:true}).waitFor();
 assert.equal(await reignProfile.getByRole('link',{name:'Voltar ao lobby',exact:true}).getAttribute('href'),'/lobby');
 await page.screenshot({path:path.join(root,'reports/cozy/world-reign-profile-390.png')});
 await page.keyboard.press('Escape');
 await reignProfile.waitFor({state:'hidden'});

 assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('kw-coronation-draft:')).length),0,'Confirmed coronation clears its draft');
 console.log('PASS coronation network recovery preserves request ID, nickname, king, equipment and crest without a second form save');
 const reign=(await (await page.request.get(endpoint)).json()).state.king;assert.equal(reign.nickname,'GlobalKing');assert.equal(reign.sovereignId,'sovereign-01');assert.deepEqual(reign.equipment,['item-craft-ledger','','']);assert.equal(reign.attributes.administration,6);
 const appearance=await (await page.request.get(base+'/api/me/appearance')).json();assert.equal((await page.request.post(base+'/api/me/appearance',{data:{appearance_id:'sovereign-04',revision:appearance.revision}})).status(),200);
 const frozenWorld=await (await page.request.get(endpoint)).json();assert.deepEqual(frozenWorld.state.king,reign);assert.equal(frozenWorld.state.crestId,'empire-crest-07');assert.equal(frozenWorld.shared.realmCrests[frozenWorld.state.playerId].id,'empire-crest-07');
 const prizeWorld=(await db.query('select id from worlds where slug=$1',[createdWorld.slug])).rows[0].id;
 const prizePlayer=(await db.query('select id from world_players where world_id=$1 and user_id=$2',[prizeWorld,me.id])).rows[0].id;

 for(let i=1;i<5;i++){
  const peer=(await db.query('insert into users(username,email) values($1,$2) returning id',['reward-peer-'+i,'reward-peer-'+i+'@test.invalid'])).rows[0].id;
  const member=(await db.query('insert into world_players(world_id,user_id) values($1,$2) returning id',[prizeWorld,peer])).rows[0].id;
  await db.query("insert into kw_cozy_rewards(world_id,user_id,world_player_id,world_name,player_name,finished,final_rank,final_score) values($1,$2,$3,'Equipment isolation','Peer',true,$4,1000)",[prizeWorld,peer,member,i+1]);
 }
 const prePrizeXp=(await (await page.request.get(base+'/api/me/collection')).json()).inventory.find(p=>p.id==='sovereign-01').xp;
 await db.query("insert into kw_king_xp_events(world_player_id,revision,product_id,xp) values($1,9001,'sovereign-01',300)",[prizePlayer]);
 await db.query("update kw_player_inventory set xp=xp+300 where user_id=$1 and product_id='sovereign-01'",[me.id]);
 await db.query("update worlds set starts_at=now()-interval '121 days' where id=$1",[prizeWorld]);
 await db.query("insert into kw_cozy_rewards(world_id,user_id,world_player_id,world_name,player_name,finished,final_rank,final_score,portal_crossed_at) values($1,$2,$3,'Equipment isolation','Tester',true,1,1500,now())",[prizeWorld,me.id,prizePlayer]);
 await db.query("update worlds set status='finalized' where id=$1",[prizeWorld]);
 await page.goto(base+'/inventory?tab=equipment',{waitUntil:'networkidle'});
 await page.locator('details summary').click();await page.locator('details').getByText('Equipment isolation',{exact:true}).waitFor();
 assert.equal(await inventory.locator('article').count(),4);
 assert.equal(await page.locator('details img').count(),1);

 await inventory.getByRole('button',{name:'Ver prêmios de Equipment isolation',exact:true}).click();const rewardsDialog=page.getByRole('dialog',{name:'Prêmios de Equipment isolation',exact:true});await rewardsDialog.getByText('1º / 5 participantes elegíveis',{exact:true}).waitFor();await rewardsDialog.getByText('+30 XP',{exact:true}).waitFor();
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert(await rewardsDialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));const bounds=await rewardsDialog.boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=width+1);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'reports/cozy/season-position-rewards-390.png')});await page.keyboard.press('Escape');await rewardsDialog.waitFor({state:'hidden'});
 const paidPrize=await (await page.request.get(base+'/api/me/collection')).json();assert.equal(paidPrize.inventory.find(p=>p.id==='sovereign-01').xp,prePrizeXp+330);assert.equal(paidPrize.inventory.find(p=>p.id==='sovereign-04').xp,0);assert.equal(paidPrize.seasonRewards[0].gems,72);
 console.log('PASS position receipt: Normal 72 Gemas, exactly one item, +30 XP to the actual king, no XP diverted to current selection, compact detail at 320/390/430');
 const prizeButton=inventory.locator('details').getByRole('button',{name:/^Ver prêmio /});await prizeButton.click();const prizeDetail=page.getByRole('dialog');await prizeDetail.getByText('Prêmio de temporada',{exact:true}).waitFor();await page.keyboard.press('Escape');await prizeDetail.waitFor({state:'hidden'});assert.equal(await prizeButton.evaluate(el=>document.activeElement===el),true);
 assert.match(await inventory.locator('details time').innerText(),/\d{2}:\d{2}/);

 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'reports/cozy/collection-inventory-390.png'),fullPage:true});
 await db.query("insert into user_entitlements(user_id,provider,product_id,purchase_token,status,expires_at) values($1,'google_play','premium_monthly','private-fixture-token','canceled',now()+interval '10 days')",[me.id]);
 const paidAccess=await (await page.request.get(base+'/api/me/entitlements')).json();assert.equal(paidAccess.premium.active,true);assert.equal(paidAccess.benefits.worldLimit,5);assert(!JSON.stringify(paidAccess).includes('private-fixture-token'));
 await page.goto(base+'/premium',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Premium ativo',exact:true}).waitFor();
 await accountNav.getByRole('link',{name:'Mundos',exact:true}).click();
 await accountNav.locator('[aria-current="page"]').filter({hasText:'Mundos'}).waitFor();
 await page.getByRole('link',{name:'Abrir meu perfil',exact:true}).waitFor();
 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:844});
  for(const name of ['Meus mundos','Buscar','Criar']){
   await page.getByRole('navigation',{name:'Mundos',exact:true}).getByRole('button',{name,exact:true}).click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Lobby ${name} fits ${width}`);
   await page.screenshot({path:path.join(root,`reports/cozy/lobby-${name==='Meus mundos'?'realms':name==='Buscar'?'search':'create'}-${width}.png`),fullPage:true});
  }
 }
 await page.getByText('0/5 mundos ativos',{exact:true}).waitFor();
 const imperialCreated=await page.request.post(base+'/api/worlds/create',{data:{name:'Imperial crest',mode:'express'}});assert.equal(imperialCreated.status(),200);const imperialWorld=(await imperialCreated.json()).world;
 const imperialEndpoint=base+'/api/worlds/'+imperialWorld.slug+'/cozy';const imperialChoice=await page.request.post(imperialEndpoint,{data:{requestId:'imperial-crest-start',action:{type:'king_choose',profileId:'builder',nickname:'Royal',crestId:'empire-crest-20',crestFinish:'imperial'}}});assert.equal(imperialChoice.status(),200,await imperialChoice.text());
 const imperialSave=await (await page.request.get(imperialEndpoint)).json();assert.equal(imperialSave.state.crestFinish,'imperial');assert.deepEqual(imperialSave.state.king.attributes,{administration:4,command:3,exploration:8});
 assert.equal(imperialSave.state.king.nickname,'GlobalKing','Forged coronation nickname cannot override the account nickname');
 assert.equal((await page.request.patch(base+'/api/me/profile',{data:{username:'GlobalKingLater'}})).status(),200);
 const renamedAccountWorld=await (await page.request.get(imperialEndpoint)).json();assert.equal(renamedAccountWorld.state.playerName,'GlobalKingLater');assert.equal(renamedAccountWorld.state.king.nickname,'GlobalKingLater');
 const oldSeason=await (await page.request.get(endpoint)).json();assert.equal(oldSeason.state.playerName,'GlobalKing','Closed seasons retain their recorded identity');
 assert.equal((await page.request.patch(base+'/api/me/profile',{data:{username:'GlobalKing'}})).status(),200);
 console.log('PASS account nickname propagates to live worlds and king, forged world nickname is ignored, finalized history stays unchanged');
 const started=await page.request.post(imperialEndpoint,{data:{requestId:'start-local-name-test',action:{type:'start_world'}}});assert.equal(started.status(),200);
 await context.addInitScript(id=>{for(const screen of ['crown','cities','city','military'])localStorage.setItem(`kw-screen-help:v1:${screen}:${id}`,'seen');},imperialSave.state.playerId);
 await page.goto(base+imperialWorld.href,{waitUntil:'networkidle'});const navigation=page.getByRole('navigation',{name:'Áreas do reino',exact:true});
 await navigation.getByRole('button',{name:'Cidades',exact:true}).click();await page.getByRole('button',{name:'Ver cidade Capital',exact:true}).click();
 await page.getByRole('tab',{name:'Decisões',exact:true}).click();await page.getByRole('button',{name:'Renomear',exact:true}).click();await page.getByRole('textbox',{name:'Nome da cidade',exact:true}).fill('Porto da Coroa');
 const renameReply=page.waitForResponse(r=>r.url()===imperialEndpoint&&r.request().method()==='POST');await page.getByRole('button',{name:'Salvar nome',exact:true}).click();assert.equal((await renameReply).status(),200);
 await page.getByRole('heading',{name:'Porto da Coroa',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Nome escolhido',exact:true}).isDisabled(),true);
 const citySave=await (await page.request.get(imperialEndpoint)).json(),capital=citySave.state.cities[0];assert.equal(citySave.shared.claims[`${capital.q},${capital.r}`].name,'Porto da Coroa');
 assert.equal((await page.request.post(imperialEndpoint,{data:{requestId:'second-name-rejected',action:{type:'rename_city',cityId:capital.id,name:'Outro nome'}}})).status(),422);
 await page.reload({waitUntil:'networkidle'});await navigation.getByRole('button',{name:'Cidades',exact:true}).click();await page.getByRole('button',{name:'Ver cidade Porto da Coroa',exact:true}).waitFor();
 console.log('PASS city rename through mobile UI: shared map name, once-per-owner lock, server rejection and persisted name after reload');
 await navigation.getByRole('button',{name:'Coroa',exact:true}).click();await page.getByRole('button',{name:'Militar',exact:true}).click();
 const militia=page.getByRole('article',{name:'Milícia',exact:true});
 await militia.getByRole('button',{name:'Aumentar quantidade de Milícia',exact:true}).click();await militia.getByRole('button',{name:'Recrutar 2 Milícia',exact:true}).waitFor();
 await militia.getByRole('button',{name:'Aumentar quantidade de Milícia',exact:true}).click();await militia.getByRole('button',{name:'Recrutar 3 Milícia',exact:true}).waitFor();
 await militia.getByRole('button',{name:'Diminuir quantidade de Milícia',exact:true}).click();
 const armyBefore=await (await page.request.get(imperialEndpoint)).json();const troopReply=page.waitForResponse(r=>r.url()===imperialEndpoint&&r.request().method()==='POST');await militia.getByRole('button',{name:'Recrutar 2 Milícia',exact:true}).click();const troops=await troopReply;assert.equal(troops.status(),200);assert.equal(troops.request().postDataJSON().action.amount,2);const armyAfter=await troops.json();assert.equal(armyAfter.state.army.militia-armyBefore.state.army.militia,2);assert(Math.abs(armyBefore.state.resources.materials-armyAfter.state.resources.materials-2*armyBefore.computed.troopCosts.militia)<1,'Exact cost allows only real time production during HTTP');
 console.log('PASS mobile military quantity: +1, +1, -1 and recruit exactly two with the displayed total cost');
 await db.query("update user_entitlements set expires_at=now()-interval '1 second' where user_id=$1",[me.id]);assert.equal((await (await page.request.get(imperialEndpoint)).json()).state.crestFinish,'imperial');
 console.log('PASS owned crest picker, forged crest denial, Premium-only finish, shared map identity and retained cosmetic after expiry without stat bonus');
 console.log('PASS real Premium API, canceled-but-paid access, private token removal and lobby world limits');
 console.log('PASS completed-season reward receipt and owned inventory at 320, 390 and 430 pixels, one item in Normal mode');
 console.log('PASS world-specific equipment popup, duplicate UI denial, forged/unowned/oversized request denial, prepared stat snapshot and isolation after account selection changes');
 console.log('PASS compact owned collection, expand/collapse, no account level, inventory deep link, store deficits, Premium navigation, disabled cash purchases and mobile overflow');
 await page.clock.install();let releaseRead,readStarted;const heldRead=new Promise(resolve=>{releaseRead=resolve;}),reading=new Promise(resolve=>{readStarted=resolve;});
 await page.route('**/api/me/collection',async route=>{readStarted();await heldRead;await route.abort('failed').catch(()=>{});});
 await page.goto(base+'/profile',{waitUntil:'domcontentloaded'});await reading;
 assert.equal(await collection.getByRole('img',{name:catalog.find(p=>p.id==='sovereign-01').name,exact:true}).count(),0,'Loading never presents a fallback king as the real selection');
 await page.clock.fastForward(20_001);await collection.getByRole('alert').getByText('A conexão demorou a responder. Tente novamente.',{exact:true}).waitFor();
 releaseRead();await page.unroute('**/api/me/collection');await collection.getByRole('button',{name:'Tentar novamente',exact:true}).click();await collection.getByRole('img',{name:catalog.find(p=>p.id==='sovereign-04').name,exact:true}).waitFor();
 console.log('PASS stalled collection read: bounded wait, recovery button and correct selected king after retry without showing a fallback profile');
 await db.query("update user_entitlements set expires_at=now()+interval '1 day' where user_id=$1",[me.id]);
 const recoveryWorldReply=await page.request.post(base+'/api/worlds/create',{data:{name:'Coronation timeout recovery',mode:'express'}});assert.equal(recoveryWorldReply.status(),200);const recoveryWorld=(await recoveryWorldReply.json()).world;
 let releaseStats,statsStarted;const heldStats=new Promise(resolve=>{releaseStats=resolve;}),loadingStats=new Promise(resolve=>{statsStarted=resolve;});
 await page.route('**/api/me/royal-attributes',async route=>{statsStarted();await heldStats;await route.abort('failed').catch(()=>{});});
 await page.goto(base+recoveryWorld.href,{waitUntil:'domcontentloaded'});await loadingStats;await royal.waitFor();assert.equal(await royal.getByRole('textbox').count(),0);assert.equal(await royal.getByRole('button',{name:'Iniciar meu reinado',exact:true}).isDisabled(),true);
 await page.clock.fastForward(20_001);const preparedStats=royal.getByRole('region',{name:'Atributos do rei',exact:true});await preparedStats.getByRole('alert').waitFor();releaseStats();await page.unroute('**/api/me/royal-attributes');await preparedStats.getByRole('button',{name:'Tentar novamente',exact:true}).click();await royal.getByRole('button',{name:'Iniciar meu reinado',exact:true}).waitFor({state:'visible'});await page.waitForFunction(()=>Array.from(document.querySelectorAll('dialog button')).some(b=>b.textContent==='Iniciar meu reinado'&&!b.disabled));
 for(const kind of ['equipment','crest']){
  let releaseInventory,inventoryStarted;const heldInventory=new Promise(resolve=>{releaseInventory=resolve;}),loadingInventory=new Promise(resolve=>{inventoryStarted=resolve;});
  await page.route('**/api/me/collection',async route=>{inventoryStarted();await heldInventory;await route.abort('failed').catch(()=>{});});
  await royal.getByRole('button',{name:kind==='equipment'?'Escolher equipamento do slot 1':'Escolher brasão do reino',exact:true}).click();await loadingInventory;
  const selection=page.getByRole('dialog',{name:kind==='equipment'?'Escolher item do slot 1':'Brasão do reino',exact:true});await page.clock.fastForward(20_001);await selection.getByRole('alert').waitFor();
  releaseInventory();await page.unroute('**/api/me/collection');await selection.getByRole('button',{name:'Tentar novamente',exact:true}).click();await selection.getByRole('button',{name:kind==='equipment'?/Livro de Ofícios/:'Brasão 07',exact:true}).waitFor();
  await selection.getByRole('button',{name:kind==='equipment'?'Fechar inventário':'Fechar brasões',exact:true}).click();assert.equal(await royal.getByText('GlobalKing',{exact:true}).count(),1);assert.equal(await royal.getByRole('button',{name:'Iniciar meu reinado',exact:true}).isEnabled(),true);
 }
 console.log('PASS coronation stalled stats, equipment and crest reads recover in place and preserve account identity and readiness');
 {
 await db.query('update kw_player_wallet set gems=0 where user_id=$1',[me.id]);
 const refundable=(await db.query("select c.product_id from kw_collection_catalog c where c.kind='king' and c.gem_price=50 and c.on_sale and not exists(select 1 from kw_player_inventory i where i.user_id=$1 and i.product_id=c.product_id) order by c.product_id limit 1",[me.id])).rows[0].product_id;
 await db.query("select kw_grant_play_gems($1,'gems_50','ui-refund-buy','GPA.ui-refund','sandbox')",[me.id]);
 await db.query("select kw_collection_buy($1,$2,'ui-refund-spend')",[me.id,refundable]);
 await db.query("select kw_refund_play_gems('ui-refund-buy')");
 await page.goto(base+'/premium',{waitUntil:'networkidle'});await shop.getByText('Estorno · 50 Gemas',{exact:true}).waitFor();
 await shop.getByText('Estorno · 50 Gemas',{exact:true}).click();await shop.getByText(/Os próximos créditos repõem 50 Gemas/).waitFor();
 for(const width of [320,390]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.screenshot({path:path.join(root,'reports/cozy/gem-refund-debt-390.png')});
 assert.equal(await page.locator('#gem-packs button').count(),4);for(const button of await page.locator('#gem-packs button').all())assert(await button.isDisabled());
 const refunded=await (await page.request.get(base+'/api/me/collection')).json();assert.equal(refunded.gemDebt,50);assert.equal(refunded.gems,0);assert(refunded.inventory.some(i=>i.id===refundable));
 await db.query("select kw_grant_play_gems($1,'gems_50','ui-refund-recovery','GPA.ui-recovery','sandbox')",[me.id]);
 await page.reload({waitUntil:'networkidle'});await shop.getByRole('heading',{name:/Gemas/}).waitFor();assert.equal(await shop.getByText('Estorno · 50 Gemas',{exact:true}).count(),0);
 const recovered=await (await page.request.get(base+'/api/me/collection')).json();assert.equal(recovered.gemDebt,0);assert.equal(recovered.gems,0);assert(recovered.inventory.some(i=>i.id===refundable));
 console.log('PASS refunded real SQL checkout: owned king preserved, debt visible in mobile shop/API, future credit offsets it once, cash checkout stays disabled');
 }



}catch(error){console.error('Collection UI diagnostics:',page?await page.locator('body').innerText().catch(()=>page.url()):'browser not ready',log);throw error;}finally{await browser?.close();server.kill();await rest.close();await db.close();}
