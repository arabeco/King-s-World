import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startCozyRest } from "./lib/cozy-fixture.mjs";
import { createCozyFoundingDatabase, stageCozyAscension } from "./lib/cozy-founding-fixture.mjs";
import { loadCozyEngine } from "./lib/load-cozy-engine.mjs";

const root = new URL("../", import.meta.url);
const persistent = process.env.KW_TEST_PERSISTENT_WORLD === "1";
const db = await createCozyFoundingDatabase({persistent,repeatMigrations:true});
const listener = createServer();
await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
const { port } = listener.address();
await new Promise(resolve => listener.close(resolve));
const rest = await startCozyRest(db);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [
  fileURLToPath(new URL("node_modules/next/dist/bin/next", root)), "dev", "--hostname", "127.0.0.1", "--port", String(port),
], {
  cwd: fileURLToPath(root), windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env, NEXT_DIST_DIR: ".next-cozy-test", KW_COZY_FOUNDATION_PREVIEW: "1",
    KW_COZY_PERSISTENT_PREVIEW: persistent ? "1" : "0",
    NEXT_PUBLIC_SUPABASE_URL: rest.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public",
    SUPABASE_SECRET_KEY: "fixture-service", SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
  },
});
let log = "";
server.stdout.on("data", chunk => { log = (log + chunk).slice(-9000); });
server.stderr.on("data", chunk => { log = (log + chunk).slice(-9000); });
let browser;
try {
  for (let i = 0; i < 60; i++) {
    try { await fetch(base + "/login", { signal: AbortSignal.timeout(3000) }); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    extraHTTPHeaders: { "x-kw-smoke": "1" },
  });
  await context.addCookies([{ name: "kw_dev_auth", value: "founding-ui", url: base }]);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(60000);
  const create = await page.request.post(base + "/api/worlds/create", { data: { name: "Fundação QA", mode: "express" } });
  assert.equal(create.status(), 200, await create.text());
  const { world } = await create.json();
  const endpoint = base + `/api/worlds/${world.slug}/cozy`;
  const snapshot = async () => {
    const response = await page.request.get(endpoint);
    assert.equal(response.status(), 200, await response.text());
    return response.json();
  };
  const initial = await snapshot();
  assert.equal(initial.world.foundingOnboarding, true);
  assert.equal(Boolean(initial.world.persistent), persistent);
  assert.equal(initial.state.cities.length, 0);
  await context.addInitScript(id => {
    for (const screen of ["crown", "cities", "city", "council", "government", "map", "achievements", "alliance", "infrastructure", "reports"]) localStorage.setItem(`kw-screen-help:v1:${screen}:${id}`, "seen");
  }, initial.state.playerId);
  const tap = name => page.getByRole("button", { name, exact: typeof name === "string" }).tap();
  const screenshots = process.env.KW_FOUNDING_TEST_SCREENSHOTS;
  await page.goto(base + world.href, { waitUntil: "domcontentloaded" });
  await tap(/^Escolher /);
  await tap(/^Helena/);
  await tap(/^Inês/);
  await page.setViewportSize({width:320,height:690});
  const hire = page.getByRole("button",{name:/^Contratar/});
  await hire.waitFor({state:"visible"});
  const hireBox = await hire.boundingBox();
  assert(hireBox.y+hireBox.height<=690,"A contratação fica no primeiro enquadramento a 320 px.");
  if (screenshots) {
    await page.getByRole("group",{name:"Primeiro herói"}).locator("img")
      .evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
    await page.screenshot({path:join(screenshots,"onboarding-corte.png")});
  }
  await tap(/^Contratar/);
  await page.getByRole("heading", { name: "Onde nasce sua capital?" }).waitFor();
  const foundCapital=page.getByRole("button",{name:/^Fundar capital/});
  const foundationBox=await foundCapital.boundingBox();
  assert(foundationBox.y+foundationBox.height<=690,"Nome e confirmação cabem junto do mapa inicial.");
  assert.equal(await page.getByRole("button",{name:"Região",exact:true}).count(),0);
  await page.setViewportSize({width:390,height:844});
  const prepared = await snapshot();
  assert.equal(prepared.state.resources.gold, 150);
  assert.equal(prepared.state.heroes[0].cityId, null);
  await page.goto(base + "/lobby", { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Continuar fundação", exact: true }).tap();
  await page.waitForURL(`**/world/${world.slug}/intelligence`);
  const map = page.getByRole("grid", { name: "Territórios próximos" });
  await map.waitFor();
  assert((await map.boundingBox()).height >= 200, "O mapa ocupa espaço real na tela de fundação.");
  await map.getByRole("gridcell").first().tap();
  await page.getByLabel("Nome da capital").fill("Vale Verde");
  if (screenshots) await page.screenshot({ path: join(screenshots, "fundacao.png") });
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.equal(await page.getByLabel("Nome da capital").inputValue(), "Vale Verde");
  await tap(/^Fundar capital com /);
  const nav = name => page.getByRole("navigation", { name: "Áreas do reino" }).getByRole("button", { name, exact: true });
  if (persistent) {
    const firstExplore=page.getByRole("button",{name:"Explorar arredores",exact:true});
    await firstExplore.tap();
    assert.equal(await nav("Mundo").getAttribute("aria-current"),"page");
    assert.equal((await snapshot()).state.orders.filter(order=>order.kind==="explore").length,0);
    await nav("Coroa").tap();
    if (screenshots) await page.screenshot({path:join(screenshots,"onboarding-coroa.png")});
    await page.getByRole("button", { name: "Conselho", exact: true }).locator("[data-novelty]").waitFor();
    await nav("Cidades").locator("[data-novelty]").waitFor();
  }
  await tap("Ouvir o Conselho");
  if (persistent) {
    await page.waitForFunction(() => !document.querySelector('button[data-command="council"] [data-novelty]'));
    assert((await snapshot()).state.firstAudience, "Abrir a carta conserva a opção de assinar");
    await tap(/Política.*Helena/);
    await tap(/^Tomás/);
    await page.getByText("Ainda vão decidir juntos",{exact:true}).waitFor();
    assert.equal((await snapshot()).state.counselors[0],"helena","A prévia pode ser vista antes de confirmar");
    await tap("Nomear Tomás");
    await page.getByRole("button",{name:/Política.*Tomás/}).waitFor();
    const preview = await snapshot();
    assert.equal(preview.state.counselors[0],"tomas");
    assert.equal(preview.computed.decree.counselorId,"helena");
  }
  await tap("Abastecer a feira");
  await tap("Assinar");
  await tap("Ver Vale Verde");
  const after = await snapshot();
  assert.equal(after.state.cities[0].name, "Vale Verde");
  assert.equal(after.state.heroes[0].cityId, after.state.cities[0].id);
  assert.equal(after.state.resources.gold, 150);
  if (persistent) {
    assert(after.state.resources.materials >= 1880);
    assert(after.state.reports.some(report => report.kind === "council" && report.body.includes("+80 materiais")));
  } else assert.equal(after.state.resources.materials, 1880);
  assert.equal(after.state.firstAudience, undefined);
  await tap("Fechar setor");
  if (persistent) {
    const cityDecision = after.computed.cityLife[after.state.cities[0].id].decision;
    assert(cityDecision.author.name.startsWith("Engenheiro"));
    await nav("Coroa").tap();
    await tap(/Carta de Vale Verde/);
    const local = page.getByRole("article", { name: "Decisão local da cidade" });
    await local.getByRole("heading", { name: cityDecision.title, exact:true }).scrollIntoViewIfNeeded();
    await local.getByText(cityDecision.author.name, { exact: true }).waitFor();
    await nav("Cidades").locator("[data-novelty]").waitFor({state:"hidden"});
    await page.reload({waitUntil:"domcontentloaded"});
    await nav("Cidades").tap();
    const decisions = page.getByRole("tab", {name:"Decisões",exact:true});
    assert.equal(await decisions.locator("[data-novelty]").count(),0);
    await decisions.tap();
    await local.getByRole("heading", { name: cityDecision.title, exact:true }).waitFor();
    assert.equal((await snapshot()).computed.cityLife[after.state.cities[0].id].decision.id,cityDecision.id);

    await db.query("update worlds set starts_at = now() - interval '35 days', runtime_anchor_started_at = now() - interval '35 days' where id = $1", [after.world.id]);
    await page.goto(base + "/lobby", { waitUntil: "domcontentloaded" });
    await page.getByText(/Expresso · Dia 36 · 1 jogador/).waitFor();
    await page.getByRole("link", { name: "Continuar em Vale Verde", exact: true }).tap();
    await page.getByText("Dia 36 · Expresso ×4", { exact: true }).waitFor();
    const opening = await snapshot();
    assert.equal(opening.computed.endsAt, null);
    await tap("Militar");
    const armyHelp = page.getByRole("dialog",{name:"Como preparar seu exército"});
    await armyHelp.getByRole("button",{name:"Próximo",exact:true}).tap();
    await armyHelp.getByRole("heading",{name:"Vitórias de expedição",exact:true}).waitFor();
    await armyHelp.getByRole("button",{name:"Fechar ajuda",exact:true}).tap();
    const campaign = page.getByRole("region", { name: "Vitórias da expedição" });
    await campaign.getByText("0/6", { exact: true }).waitFor();
    await campaign.getByText("0/200 influência", { exact: true }).waitFor();
    await tap("Explorar alvos");
    await nav("Mundo").waitFor();
    assert.equal(await nav("Mundo").getAttribute("aria-current"),"page");
    assert.deepEqual((await snapshot()).state.orders,opening.state.orders);
    await nav("Coroa").tap();
    await tap("Conquistas");
    const reserveQuest = page.getByRole("article",{name:"Uma reserva do reino"});
    await reserveQuest.getByText("Anexe uma área de ouro ou materiais.",{exact:true}).waitFor();
    await reserveQuest.getByRole("button",{name:/Avançar missão/}).tap();
    assert.equal(await nav("Mundo").getAttribute("aria-current"),"page");
    console.log("PASS progressão: Militar e Conquistas mostram fontes PvE e navegam ao mapa sem executar ordens.");
    await nav("Coroa").tap();
    await tap("Infraestrutura");
    await tap(/^Obras livres\s+1$/);
    await page.getByRole("button",{name:"Ver cidade Vale Verde",exact:true}).getByText("Obra livre",{exact:true}).waitFor();
    await tap("Fechar painel");
  } else {
    await page.getByRole("navigation", { name: "Áreas do reino" }).getByRole("button", { name: "Coroa", exact: true }).tap();
    await tap("Abrir os portões");
  }
  await page.getByRole("navigation", { name: "Áreas do reino" }).getByRole("button", { name: "Cidades", exact: true }).tap();
  await tap("Ver setor Defesa");
  await tap("Evoluir Defesa");
  await page.getByRole("dialog", { name: "Defesa" }).waitFor({ state: "hidden" });
  await tap("Ver setor Economia");
  await tap("Adicionar Economia à fila");
  await page.getByRole("dialog", { name: "Economia" }).waitFor({ state: "hidden" });
  const orders = (await snapshot()).state.orders;
  assert.equal(orders.find(order => order.sector === "economy").planned.started, false);
  assert.equal(orders.find(order => order.sector === "defense").arrivesAt, orders.find(order => order.sector === "economy").planned.startsAt);
  await page.getByText("1ª na fila", { exact: true }).waitFor();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  if (screenshots) await page.screenshot({ path: join(screenshots, "fila.png") });
  if (persistent) {
    await page.getByRole("navigation", { name: "Áreas do reino" }).getByRole("button", { name: "Coroa", exact: true }).tap();
    await tap("Infraestrutura");
    await page.getByRole("button",{name:"Ver cidade Vale Verde",exact:true}).getByText(/1 na fila/).waitFor();
    await tap(/^Obras livres\s+0$/);
    await page.getByText("Nenhuma cidade com obra livre agora.",{exact:true}).waitFor();
    await tap("Fechar painel");
    await tap("Governo");
    const trade = page.getByText("Caravana comercial", { exact: true });
    await trade.waitFor();
    if (!await page.getByRole("button", { name: "Enviar caravana", exact: true }).isVisible()) await trade.tap();
    const before = (await snapshot()).state.resources.gold;
    await tap("3 viagens");
    await page.getByText(/Primeira volta em .*última em/).waitFor();
    await tap("Reservar 3 viagens");
    await page.getByText(/Volta em .*2 na fila/).waitFor();
    assert.equal((await snapshot()).state.orders.filter(order=>order.tradeRoute).length,3);
    await tap("Cancelar viagens na fila");
    await page.getByText(/Retornam 120 suprimentos/).waitFor();
    await tap("Confirmar cancelamento");
    await page.getByRole("button",{name:"Cancelar viagens na fila",exact:true}).waitFor({state:"hidden"});
    const sent = await snapshot();
    assert.equal(sent.state.resources.gold, before);
    assert.equal(sent.state.orders.filter(order=>order.tradeRoute).length,1);
    const route = sent.state.orders.find(order => order.tradeRoute);
    assert.equal(route.cargo.gold, 150);
    // Move only the departure under test past the arrival. The API performs settlement.
    await db.query("update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2", [
      JSON.stringify({ ...sent.state, orders: sent.state.orders.map(order => order.id === route.id
        ? { ...order, arrivesAt: Date.now() - 1 } : order) }),
      sent.state.playerId,
    ]);
    const returned = await snapshot();
    assert.equal(returned.state.resources.gold, before + 150);
    const report = returned.state.reports.find(entry => entry.title === "Caravana comercial voltou");
    assert(report);
    // The direct Crown shortcut opens the result itself. Other unread cards keep their dot.
    await page.getByRole("button",{name:"Fechar painel",exact:true}).tap();
    await nav("Coroa").tap();
    await page.reload({waitUntil:"domcontentloaded"});
    await tap(/Caravana comercial voltou/);
    const tribute = page.locator('summary[aria-label="Ler relato: Caravana comercial voltou"]');
    await tribute.waitFor();
    await tribute.locator("[data-novelty]").waitFor({state:"hidden"});
    assert((await snapshot()).state.seenNotices.includes(`report:${report.id}`));
    await nav("Relatos").locator("[data-novelty]").waitFor();
    console.log("PASS novidades: Coroa, carta local, recarga e leitura individual dos relatos.");

    const funded=await snapshot();
    // Start the queue check with enough gold for two level-one researches.
    funded.state.resources.gold=500;
    await db.query("update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2",
      [JSON.stringify(funded.state),funded.state.playerId]);
    await page.reload({waitUntil:"domcontentloaded"});
    await nav("Coroa").tap();
    await tap("Governo");
    await page.getByRole("tab",{name:"Pesquisas"}).tap();
    await tap("Ver pesquisa Doutrina militar");
    await tap("Pesquisar Doutrina militar");
    await tap("Ver pesquisa Cultivo e ofícios");
    await tap("Adicionar Cultivo e ofícios à fila");
    await page.getByText("Em pesquisa · 1 na fila",{exact:true}).waitFor();
    const queuedResearch=(await snapshot()).state.orders.filter(order=>order.kind==="research");
    assert.equal(queuedResearch.length,2);
    assert.equal(queuedResearch[0].arrivesAt,queuedResearch[1].planned.startsAt);
    assert.equal(queuedResearch[1].research,"economy");
    await tap("Fechar painel");

    const {mapPoint}=loadCozyEngine("map-presentation");
    const {sanctuaryAt}=loadCozyEngine("landmarks");
    const seen=new Set(funded.tiles.filter(tile=>tile.revealed).map(tile=>tile.id));
    const capital=funded.state.cities[0];
    const targets=[[3,0],[0,3],[-3,0],[0,-3],[3,-3],[-3,3]].map(([q,r])=>({q:capital.q+q,r:capital.r+r}))
      .filter(coord=>Math.max(Math.abs(coord.q),Math.abs(coord.r),Math.abs(coord.q+coord.r))<=40&&!seen.has(`${coord.q},${coord.r}`)&&!sanctuaryAt(coord));
    assert(targets.length>=2,"Two fog destinations accessible around the capital");
    await nav("Mundo").tap();
    await tap("Detalhe");
    await tap("Centralizar na capital");
    const map=page.locator('svg[aria-label="Mapa dos reinos"]');
    async function selectTile(coord){
      const point=await map.evaluate((svg,{x,y})=>{
        const p=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());
        return {x:p.x,y:p.y};
      },mapPoint(coord));
      await page.touchscreen.tap(point.x,point.y);
      await page.getByRole("dialog",{name:"Território desconhecido",exact:true}).waitFor();
    }
    await selectTile(targets[0]);
    await tap(/^Explorar caminho/);
    await page.getByText("Este destino já tem uma exploração.",{exact:true}).waitFor();
    await tap("Fechar território");
    await tap("Centralizar na capital");
    await selectTile(targets[1]);
    await tap(/^Adicionar à fila/);
    await page.getByText("Este destino já tem uma exploração.",{exact:true}).waitFor();
    const queuedExplorations=(await snapshot()).state.orders.filter(order=>order.kind==="explore");
    assert.equal(queuedExplorations.length,2);
    assert.equal(queuedExplorations[1].planned.startsAt,queuedExplorations[0].arrivesAt);
    assert.equal(await map.locator('[data-journey-kind="explore"]').count(),1);
    await tap("Fechar território");
    console.log("PASS mobile: pesquisa encadeada pelo Governo, duas explorações pelo mapa e posição da equipe ativa.");

    await page.setViewportSize({width:320,height:800});
    await nav("Cidades").tap();
    await page.getByRole("tab",{name:"Setores",exact:true}).tap();
    const beforeBatch=await snapshot();
    const planButton=page.getByRole("button",{name:/Planejar obras/});
    const planning=page.getByRole("dialog",{name:"Planejar obras",exact:true});
    await planButton.tap();
    const rows=planning.getByRole("listitem");
    const count=await rows.count();
    assert(count>=2&&count<=5);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await planning.getByRole("button",{name:"Fechar setor",exact:true}).tap();
    assert.deepEqual((await snapshot()).state.orders,beforeBatch.state.orders,"Reviewing and closing the preview reserves nothing");
    await planButton.tap();
    await planning.getByRole("button",{name:`Reservar ${count} obras`,exact:true}).tap();
    await planning.waitFor({state:"hidden"});
    const afterBatch=await snapshot();
    const newOrders=afterBatch.state.orders.filter(order=>!beforeBatch.state.orders.some(prior=>prior.id===order.id));
    assert.equal(newOrders.length,count);
    assert(newOrders.every(order=>order.kind==="upgrade"&&order.cityId===capital.id&&order.planned.cost.materials>0));
    assert.deepEqual(afterBatch.state.cities[0].sectors,beforeBatch.state.cities[0].sectors);
    await page.reload({waitUntil:"domcontentloaded"});
    await nav("Cidades").tap();
    assert(newOrders.every(order=>!order.planned.started));
    const restored=await snapshot();
    const restoredQueue=restored.state.orders;
    assert(newOrders.every(order=>restoredQueue.some(restored=>restored.id===order.id)));
    await page.getByText(`${restoredQueue.filter(order=>order.kind==="upgrade"&&!order.planned?.started&&order.planned).length}ª na fila`,{exact:true}).waitFor();
    console.log("PASS mobile 320 px: lote de obras, prévia sem cobrança, confirmação e fila preservada após recarregar.");

    // Compress only this city's construction schedule. The API still settles all receipts in order.
    let previousCompletion=restored.state.settledAt;
    const compressed=restoredQueue.map(order=>{
      if(order.kind!=="upgrade"||order.cityId!==capital.id) return order;
      const startsAt=previousCompletion;
      previousCompletion++;
      return {...order,arrivesAt:previousCompletion,...(order.planned?{planned:{...order.planned,startsAt}}:{})};
    });
    await db.query("update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2",
      [JSON.stringify({...restored.state,orders:compressed}),restored.state.playerId]);
    const completed=(await snapshot()).state.reports.filter(entry=>entry.completedWork?.cityId===capital.id);
    assert(completed.length>=count);
    await page.reload({waitUntil:"domcontentloaded"});
    await nav("Relatos").tap();
    const worksGroup=page.locator("details[data-completed-works]").filter({hasText:"Vale Verde"});
    const workReceipts=worksGroup.locator('summary[aria-label="Ler relato: Setor concluído"]');
    await worksGroup.locator(":scope > summary").tap();
    assert.equal(await workReceipts.count(),completed.length);
    assert(!(await snapshot()).state.seenNotices.includes(`report:${completed[0].id}`));
    await workReceipts.first().tap();
    await workReceipts.first().locator("[data-novelty]").waitFor({state:"hidden"});
    const read=await snapshot();
    assert(read.state.seenNotices.includes(`report:${completed[0].id}`));
    assert(!read.state.seenNotices.includes(`report:${completed[1].id}`));
    await nav("Coroa").tap();
    await tap(/Setor concluído/);
    await worksGroup.waitFor({state:"visible"});
    assert(await worksGroup.evaluate(element=>element.open));
    console.log("PASS Relatos: obras agrupadas por cidade, leitura individual e acesso direto pela Coroa.");

    // Let the first exploration and research land during a simulated absence.
    const leaving=await snapshot();
    const ordersOnReturn=leaving.state.orders.map(order=>
      (order.kind==="explore"||order.kind==="research")&&(!order.planned||order.planned.started)
        ? {...order,arrivesAt:leaving.state.settledAt+1} : order);
    await db.query("update kw_cozy_player_states set state_json=$1::jsonb,revision=revision+1 where world_player_id=$2",
      [JSON.stringify({...leaving.state,orders:ordersOnReturn}),leaving.state.playerId]);
    await page.goto(base+"/lobby",{waitUntil:"domcontentloaded"});
    await page.getByRole("link",{name:"Continuar em Vale Verde",exact:true}).tap();
    const returnedToReign=await snapshot();
    const discovery=returnedToReign.state.reports.find(report=>report.kind==="exploration"&&report.location);
    assert(discovery,"A região explorada gera um relato durante a ausência.");
    assert.equal(returnedToReign.state.research.military,1);
    await tap(discovery.title);
    await tap("Ver descoberta");
    await nav("Relatos").waitFor();
    await page.locator("summary").filter({hasText:discovery.title}).waitFor();
    console.log("PASS primeira volta: lobby, obra/pesquisa concluída e descoberta acessível pelo atalho da Coroa.");

    const request = async (who, url, body) => {
      const res = await fetch(url,{
        method:body ? "POST" : "GET",
        headers:{cookie:`kw_dev_auth=${who}`,"x-kw-smoke":"1","Content-Type":"application/json"},
        body:body ? JSON.stringify(body) : undefined,
        signal:AbortSignal.timeout(30_000),
      });
      return {status:res.status,data:await res.json()};
    };
    const command = (who,action,requestId=crypto.randomUUID()) => request(who,endpoint,{action,requestId});
    const ok = async promise => {
      const result = await promise;
      assert.equal(result.status,200,JSON.stringify(result.data.error));
      return result.data;
    };
    const owner = "founding-ui";
    const group = await ok(command(owner,{type:"alliance_create",name:"Guarda do Vale"}));
    const allianceId = group.state.allianceId;
    const friends = ["gift-guest-a","gift-guest-b","gift-guest-c","gift-guest-d"];
    const player = new Map();
    for(const friend of friends){
      await ok(request(friend,base+"/api/worlds/join",{code:world.joinCode}));
      await ok(command(friend,{type:"king_choose",profileId:"builder"}));
      await ok(command(friend,{type:"counselor",slot:0,counselorId:"helena"}));
      await ok(command(friend,{type:"counselor",slot:1,counselorId:"ines"}));
      const hire = await ok(command(friend,{type:"hire",role:"engineer"}));
      const [plot] = hire.tiles;
      const founded = await ok(command(friend,{type:"found_capital",q:plot.q,r:plot.r,name:friend,heroId:hire.state.heroes[0].id}));
      player.set(friend,founded.state);
    }
    const [first, ...remainingFriends] = friends;
    const target = player.get(first);
    const give = (recipientId,details={}) => ({
      type:"alliance_gift",allianceId,recipientId,day:group.allianceGifts.day,resource:"supplies",amount:50,...details,
    });
    assert.match((await command(owner,give(target.playerId))).data.error,/membros da sua aliança/);
    for(const friend of friends)await ok(command(friend,{type:"alliance_join",allianceId}));

    await page.setViewportSize({width:320,height:800});
    await page.reload({waitUntil:"domcontentloaded"});
    await nav("Aliança").tap();
    const gifts = page.getByRole("region",{name:"Presentes",exact:true});
    await gifts.getByRole("button",{name:"Enviar presente",exact:true}).tap();
    const confirm = gifts.getByRole("button",{name:"Confirmar envio",exact:true});
    assert(await confirm.isDisabled());
    await gifts.getByLabel("Aliado",{exact:true}).selectOption(target.playerId);
    await gifts.getByRole("button",{name:"Suprimentos",exact:true}).tap();
    await gifts.getByText("Seu saldo de suprimentos",{exact:true}).waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1));
    assert(!(await snapshot()).state.allianceGiftDay);
    await confirm.tap();
    await gifts.getByText("Recibos de presentes",{exact:true}).waitFor();
    const recordedSend = await snapshot();
    assert.deepEqual(recordedSend.state.allianceGiftDay.sentTo,[target.playerId]);

    const ally = await browser.newContext({
      viewport:{width:390,height:844},isMobile:true,hasTouch:true,extraHTTPHeaders:{"x-kw-smoke":"1"},
    });
    await ally.addCookies([{name:"kw_dev_auth",value:first,url:base}]);
    await ally.addInitScript(id=>{
      for(const area of ["alliance","crown","reports"])localStorage.setItem(`kw-screen-help:v1:${area}:${id}`,"seen");
    },target.playerId);
    const allyPage = await ally.newPage();
    allyPage.setDefaultTimeout(20000);
    await allyPage.goto(base+world.href,{waitUntil:"domcontentloaded"});
    const allyNav = name=>allyPage.getByRole("navigation",{name:"Áreas do reino"}).getByRole("button",{name,exact:true});
    await allyNav("Aliança").locator("[data-novelty]").waitFor();
    await allyNav("Aliança").tap();
    await allyPage.getByText("Recibos de presentes",{exact:true}).tap();
    await allyPage.getByText("+50 suprimentos",{exact:true}).waitFor();
    await allyNav("Aliança").locator("[data-novelty]").waitFor({state:"hidden"});
    const received = await ok(request(first,endpoint));
    const receipt = received.state.reports.find(entry=>entry.allianceGift?.direction==="received");
    assert(receipt && received.state.seenNotices.includes(`report:${receipt.id}`));
    assert.equal(received.state.allianceGiftDay.received,1);
    await allyNav("Relatos").tap();
    const receiptRow = allyPage.locator('summary[aria-label="Ler relato: Presente recebido"]');
    await receiptRow.waitFor();
    assert.equal(await receiptRow.locator("[data-novelty]").count(),0);
    await ally.close();

    const replayId = crypto.randomUUID();
    const replay = give(recordedSend.state.playerId,{resource:"materials",amount:100});
    await Promise.all([ok(command(first,replay,replayId)),ok(command(first,replay,replayId))]);
    assert.equal((await snapshot()).state.reports.filter(entry=>entry.allianceGift?.direction==="received").length,1);
    assert.equal((await command(first,{...replay,amount:50},replayId)).status,409);
    const race = await Promise.all(remainingFriends.map(friend=>command(friend,give(target.playerId))));
    assert.equal(race.filter(result=>result.status===200).length,2,JSON.stringify(race.map(result=>[result.status,result.data.error])));
    assert.match(race.find(result=>result.status!==200).data.error,/três presentes/);
    const filled = await ok(request(first,endpoint));
    assert.equal(filled.state.allianceGiftDay.received,3);
    assert.equal(filled.state.reports.filter(entry=>entry.allianceGift?.direction==="received").length,3);
    assert(!(await snapshot()).shared.allianceGiftDay);
    for(const [index,friend] of remainingFriends.entries()){
      const sent = (await ok(request(friend,endpoint))).state.reports.filter(entry=>entry.allianceGift?.direction==="sent");
      assert.equal(sent.length,race[index].status===200 ? 1 : 0);
    }
    const friendView = await ok(request(remainingFriends[0],endpoint));
    assert(!friendView.state.reports.some(entry=>entry.id===receipt.id));
    assert(friendView.allianceGifts.recipients.find(entry=>entry.playerId===target.playerId).receivedLimitReached);
    console.log("PASS presentes: dois jogadores no celular, recibo privado, leitura compartilhada e concorrência com limite.");

    const previewUrl = endpoint+"?view=ascension";
    const ownerId = (await db.query("select user_id from world_players where id=$1",[recordedSend.state.playerId])).rows[0].user_id;
    const bronze = await ok(request(owner,previewUrl));
    assert.equal(bronze.standing.medal.id,"bronze");
    assert.equal(bronze.rewards.totalGems,15);
    assert.equal(bronze.rewards.bonusXp,0);
    assert(bronze.rewards.equipment?.id.startsWith("item-"));
    await db.query("update kw_cozy_player_states set state_json=jsonb_set(state_json,'{peakInfluence}','2200') where world_player_id=$1",[recordedSend.state.playerId]);
    await page.reload({waitUntil:"domcontentloaded"});
    await tap("Conquistas");
    await page.getByRole("tab",{name:"Ascensão",exact:true}).tap();
    const ascension = page.getByRole("region",{name:"Prévia da Ascensão"});
    await ascension.getByRole("heading",{name:"Ouro",exact:true}).waitFor();
    await ascension.getByText("+15 gemas",{exact:true}).waitFor();
    await ascension.getByText(/^Faltam /).waitFor();
    await ascension.getByText("O que fica no Legado",{exact:true}).tap();
    await ascension.getByText("Vale Verde",{exact:true}).waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.close();

    const readValue = async () => (await db.query(`
      select s.influence,s.revision,s.state_json,w.gems,w.gem_debt,
        (select jsonb_agg(to_jsonb(i) order by i.product_id) from kw_player_inventory i where i.user_id=s.user_id) as inventory,
        (select count(*) from kw_collection_season_rewards r where r.user_id=s.user_id) as rewards
      from kw_cozy_player_states s join kw_player_wallet w on w.user_id=s.user_id where s.world_player_id=$1
    `,[recordedSend.state.playerId])).rows[0];
    const savedBefore = await readValue();
    const gold = await ok(request(owner,previewUrl));
    assert.equal(gold.standing.peak,2200);
    assert.equal(gold.standing.medal.rarity,"rare");
    assert(gold.standing.missing>0);
    assert.equal(gold.archive.cities[0].name,"Vale Verde");
    assert.deepEqual(await ok(request(owner,previewUrl)),gold);
    assert.deepEqual(await readValue(),savedBefore,"A consulta preserva influência, estado, inventário e carteira.");
    assert.equal((await request("out-of-world",previewUrl)).status,403);
    assert.equal((await ok(request(first,previewUrl))).standing.medal.id,"bronze");
    await db.query("insert into kw_player_inventory(user_id,product_id,source) values ($1,$2,'fixture-collection')",[ownerId,gold.rewards.equipment.id]);
    const nextItem = await ok(request(owner,previewUrl));
    assert(nextItem.rewards.equipment);
    assert.notEqual(nextItem.rewards.equipment.id,gold.rewards.equipment.id);
    await db.query("insert into kw_player_inventory(user_id,product_id,source) select $1,product_id,'fixture-collection' from kw_collection_catalog where kind='equipment' and rarity='rare' on conflict do nothing",[ownerId]);
    const complete = await ok(request(owner,previewUrl));
    assert.deepEqual(complete.rewards,{baseGems:15,conversionGems:2,totalGems:17,refundOffset:0,creditedGems:17,bonusXp:0,equipment:null});
    await db.query("update kw_player_wallet set gem_debt=4 where user_id=$1",[ownerId]);
    const offset = await ok(request(owner,previewUrl));
    assert.equal(offset.rewards.totalGems,17);
    assert.equal(offset.rewards.refundOffset,4);
    assert.equal(offset.rewards.creditedGems,13);
    assert.equal((await readValue()).gems,savedBefore.gems);
    console.log("PASS Ascensão: medalha pelo recorde, meta atual, arquivo previsto, raridade esgotada e consulta sem pagamento.");

    const one = async (sql,params=[]) => (await db.query(sql,params)).rows[0];
    const readLegacy = async (userId,before=null) => (await one("select kw_cozy_read_ascensions($1,$2) as history",[userId,before])).history;
    const permissions = await one(`select has_table_privilege('authenticated','kw_cozy_ascension_archives','select') as tab,
      has_function_privilege('authenticated','kw_cozy_read_ascensions(uuid,uuid)','execute') as rpc`);
    assert.deepEqual(permissions,{tab:false,rpc:false});
    await db.query("update kw_cozy_player_states set influence=1510 where world_player_id=$1",[recordedSend.state.playerId]);
    const at=Date.now();
    const current=await readValue();
    const shared=await one("select revision,state_json from kw_cozy_world_states where world_id=$1",[after.world.id]);
    const closeState={...current.state_json,finalizedAt:at,settledAt:at,finalScore:1510,orders:[],
      ascension:{medal:"gold",creditedGems:13,refundOffset:4,equipmentId:null}};
    const close=(state,influence=current.influence) => one("select kw_cozy_commit($1,$2,$3,$4,'running',$5::jsonb,$6::jsonb) as result",
      [after.world.id,ownerId,recordedSend.state.playerId,shared.revision,JSON.stringify(shared.state_json),JSON.stringify([
        {playerId:recordedSend.state.playerId,expectedRevision:current.revision,state,influence},
      ])]);
    await assert.rejects(close({...closeState,finalScore:1499},1499),/COZY_ASCENSION_INVALID_STATE/);
    await assert.rejects(close({...closeState,ascension:{...closeState.ascension,creditedGems:17}}),/COZY_ASCENSION_OFFER_CHANGED/);
    assert.deepEqual(await readLegacy(ownerId),{receipts:[],medals:{},nextCursor:null});
    assert.deepEqual(await readValue(),current,"A changed offer rolls back the world commit too");
    const retry=await Promise.all([close(closeState),close(closeState)]);
    assert.deepEqual(retry.map(entry=>entry.result.status).sort(),["committed","conflict"]);
    const archived=await readLegacy(ownerId);
    const [legacyReceipt]=archived.receipts;
    assert.deepEqual(archived.medals,{gold:1});
    assert.equal(legacyReceipt.worldName,"Fundação QA");
    assert.equal(legacyReceipt.peak,2200);
    assert.equal(legacyReceipt.score,1510);
    assert.equal(legacyReceipt.cities[0].name,"Vale Verde");
    assert.deepEqual(legacyReceipt.rewards,{baseGems:15,conversionGems:2,totalGems:17,refundOffset:4,creditedGems:13,equipmentId:null});
    const credited=await readValue();
    assert.equal(credited.gems,current.gems+13);
    assert.equal(credited.gem_debt,0);
    assert.deepEqual(credited.inventory,current.inventory);
    assert.equal(credited.rewards,current.rewards);
    await db.query("update kw_cozy_player_states set state_json=state_json where world_player_id=$1",[recordedSend.state.playerId]);
    assert.deepEqual(await readValue(),credited);
    assert.deepEqual(await readLegacy(ownerId),archived);
    assert.equal((await one("select status from worlds where id=$1",[after.world.id])).status,"running");

    const guestId=(await one("select user_id from world_players where id=$1",[filled.state.playerId])).user_id;
    assert.deepEqual(await readLegacy(guestId,legacyReceipt.id),{medals:{},receipts:[],nextCursor:null});
    const guest=(await ok(request(first,endpoint))).state;
    const guestQuote=await ok(request(first,previewUrl));
    const guestItem=guestQuote.rewards.equipment.id;
    const guestAt=Date.now();
    const beforeGuest=await one("select gems from kw_player_wallet where user_id=$1",[guestId]);
    await db.query("update kw_cozy_player_states set state_json=$1::jsonb,influence=1500,revision=revision+1 where world_player_id=$2",[
      JSON.stringify({...guest,orders:[],finalScore:1500,finalizedAt:guestAt,settledAt:guestAt,
        ascension:{medal:"bronze",creditedGems:15,refundOffset:0,equipmentId:guestItem}}),guest.playerId,
    ]);
    const visitorHistory=await readLegacy(guestId);
    assert.deepEqual(visitorHistory.medals,{bronze:1});
    assert.equal(visitorHistory.receipts[0].rewards.equipmentId,guestItem);
    assert.equal((await one("select source from kw_player_inventory where user_id=$1 and product_id=$2",[guestId,guestItem])).source,
      `ascension:${visitorHistory.receipts[0].id}`);
    assert.equal((await one("select gems from kw_player_wallet where user_id=$1",[guestId])).gems,beforeGuest.gems+15);

    const legacyPage=await context.newPage();
    await legacyPage.setViewportSize({width:320,height:800});
    await legacyPage.goto(base+"/inventory",{waitUntil:"domcontentloaded"});
    await legacyPage.getByRole("link",{name:"Legado",exact:true}).tap();
    await legacyPage.getByRole("heading",{name:"Legado",exact:true}).waitFor();
    await legacyPage.locator("summary").filter({hasText:"Fundação QA"}).tap();
    await legacyPage.getByText("+13",{exact:true}).waitFor();
    await legacyPage.getByText("Vale Verde",{exact:true}).waitFor();
    assert(await legacyPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.equal(await legacyPage.locator("[data-medal=bronze]").count(),0);
    await legacyPage.goto(base+`/inventory/legacy?before=${visitorHistory.receipts[0].id}`,{waitUntil:"domcontentloaded"});
    await legacyPage.getByText("Nenhum reinado arquivado.",{exact:true}).waitFor();
    console.log("PASS Legado: arquivo e pagamento atômicos, oferta alterada, repetição, estorno, equipamento e galeria privada a 320 px.");

    const oldId=recordedSend.state.playerId;
    const archivedPlayer=await one("select status,cozy_released from world_players where id=$1",[oldId]);
    assert.deepEqual(archivedPlayer,{status:"archived",cozy_released:true});
    const countWorlds=async()=> (await one("select kw_premium_benefits($1) as benefits",[ownerId])).benefits.activeWorlds;
    assert.equal(await countWorlds(),0);
    const archivedView=await ok(request(owner,endpoint));
    assert.equal(archivedView.state.playerId,oldId);
    assert(archivedView.computed.readOnly);
    assert(!archivedView.players.some(player=>player.playerId===guest.playerId));
    const activeCount=Number((await one("select count(*) from world_players where world_id=$1 and not cozy_released",[after.world.id])).count);
    await db.query("update worlds set player_cap=$2 where id=$1",[after.world.id,activeCount+1]);
    const directory=await ok(request(owner,base+"/api/worlds/discover"));
    assert.equal(directory.worlds.find(item=>item.slug===world.slug).players,activeCount);
    await assert.rejects(one("select kw_cozy_join($1,$2,null)",[after.world.id,ownerId]),/COZY_INVITE_REQUIRED/);
    assert.equal(await countWorlds(),0);
    const priorHigh=(await one("select highest_influence from kw_king_xp_progress where world_player_id=$1",[oldId])).highest_influence;

    const waitForLobby=legacyPage.waitForResponse(reply=>reply.url()===base+"/api/me/entitlements"&&reply.ok());
    await legacyPage.goto(base+"/lobby",{waitUntil:"domcontentloaded"});
    await waitForLobby;
    await legacyPage.getByText("Reinado arquivado",{exact:true}).waitFor();
    await legacyPage.getByRole("link",{name:"Ver no Legado",exact:true}).waitFor();
    const waitForJoin=legacyPage.waitForResponse(reply=>reply.url()===base+"/api/worlds/join"&&reply.request().method()==="POST");
    await legacyPage.getByRole("button",{name:"Começar novo reinado",exact:true}).tap();
    const joinReply=await waitForJoin;
    assert.equal(joinReply.status(),200,await joinReply.text());
    await legacyPage.getByRole("button",{name:/^Escolher /}).waitFor();
    const newView=await ok(request(owner,endpoint));
    assert.notEqual(newView.state.playerId,oldId);
    assert.equal(newView.computed.influence.total,0);
    assert.equal(newView.state.cities.length,0);
    assert.equal(newView.state.heroes.length,0);
    assert.equal(newView.state.orders.length,0);
    assert.equal(newView.state.allianceId,null);
    assert.equal(newView.state.resources.gold,350);
    assert.equal(newView.state.ascension,undefined);
    assert(newView.state.founding);
    assert.equal(await countWorlds(),1);
    assert.equal((await one("select highest_influence from kw_king_xp_progress where world_player_id=$1",[newView.state.playerId])).highest_influence,priorHigh);
    const repeats=await Promise.all([1,2].map(()=>ok(request(owner,base+"/api/worlds/join",{slug:world.slug}))));
    assert(repeats.every(result=>result.world.slug===world.slug));
    assert.equal((await ok(request(owner,endpoint))).state.playerId,newView.state.playerId);
    assert.equal(await countWorlds(),1);
    const stale=await request(owner,endpoint,{action:{type:"counselor",slot:0,counselorId:"helena"},requestId:crypto.randomUUID(),playerId:oldId});
    assert.equal(stale.status,409);
    assert.equal(stale.data.code,"REIGN_CHANGED");
    const unbound=await command(owner,{type:"counselor",slot:0,counselorId:"helena"});
    assert.equal(unbound.data.code,"REIGN_CHANGED");
    const counsel = await legacyPage.getByRole("button",{name:/^Escolher /}).first();
    await counsel.tap();
    const counselorSaved=legacyPage.waitForResponse(reply=>reply.url()===endpoint &&
      reply.request().method()==="POST" && reply.request().postDataJSON()?.action?.type==="counselor" && reply.ok());
    await legacyPage.getByRole("button",{name:/^Helena/}).tap();
    await counselorSaved;
    assert.equal((await ok(request(owner,endpoint))).state.counselors[0],"helena");
    assert.deepEqual(await readLegacy(ownerId),archived);
    console.log("PASS Retorno ao lobby: vaga liberada, reinado novo, recibo preservado, XP protegido e aba antiga bloqueada.");

    const riteAction=(action,requestId=crypto.randomUUID())=>request(owner,endpoint,{action,requestId,playerId:newView.state.playerId});
    await ok(riteAction({type:"counselor",slot:1,counselorId:"ines"}));
    const readyHero=await ok(riteAction({type:"hire",role:"engineer"}));
    const [land]=readyHero.tiles;
    const capitalFounded=await ok(riteAction({type:"found_capital",q:land.q,r:land.r,name:"Nova Aurora",heroId:readyHero.state.heroes[0].id}));
    const lateReign=capitalFounded.state;
    await stageCozyAscension(db,lateReign);
    const candidate=await ok(request(owner,endpoint));
    assert(candidate.computed.influence.total>=1500);
    const offer=await ok(request(owner,previewUrl));
    const confirmation={medal:offer.standing.medal.id,equipmentId:offer.rewards.equipment?.id??null,
      creditedGems:offer.rewards.creditedGems,refundOffset:offer.rewards.refundOffset};
    assert.match((await riteAction({type:"ascend",confirmation})).data.error,/duas provas/);
    const access=await one(`select has_function_privilege('authenticated','kw_cozy_commit_ascension(uuid,uuid,uuid,bigint,text,jsonb,jsonb,text,text,boolean)','execute') as can`);
    assert.equal(access.can,false);
    await context.addInitScript(id=>{
      for(const screen of ["crown","achievements","reports"])localStorage.setItem(`kw-screen-help:v1:${screen}:${id}`,"seen");
    },lateReign.playerId);
    await legacyPage.goto(base+world.href,{waitUntil:"domcontentloaded"});
    await legacyPage.getByRole("button",{name:"Conquistas",exact:true}).tap();
    await legacyPage.getByRole("tab",{name:"Ascensão",exact:true}).tap();
    await legacyPage.getByRole("button",{name:/Abrir Rito da Travessia/}).tap();
    const dialog=legacyPage.getByRole("dialog",{name:"Rito da Travessia",exact:true});
    const next=dialog.getByRole("button",{name:"Próximo",exact:true});
    const prev=dialog.getByRole("button",{name:"Anterior",exact:true});
    const finish=dialog.getByRole("button",{name:"Ascender e receber",exact:true});
    await next.tap();
    await dialog.getByRole("heading",{name:"O que vai para a conta",exact:true}).waitFor();
    await dialog.getByText("Perfil do soberano",{exact:true}).waitFor();
    await next.tap();
    assert(await finish.isDisabled());
    await prev.tap();
    await prev.tap();
    const provisions=dialog.getByRole("region",{name:"Equipar a Travessia",exact:true});
    await provisions.getByRole("button",{name:/^Preparar /}).tap();
    await provisions.getByText("Concluída",{exact:true}).waitFor();
    assert.match((await riteAction({type:"ascend",confirmation})).data.error,/duas provas/);
    await dialog.getByRole("button",{name:"Fechar janela",exact:true}).tap();
    await legacyPage.reload({waitUntil:"domcontentloaded"});
    await legacyPage.getByRole("button",{name:"Conquistas",exact:true}).tap();
    await legacyPage.getByRole("tab",{name:"Ascensão",exact:true}).tap();
    await legacyPage.getByRole("button",{name:/Abrir Rito da Travessia.*1\/2/}).tap();
    await provisions.getByText("Concluída",{exact:true}).waitFor();
    await dialog.getByRole("button",{name:"Assinar audiência",exact:true}).tap();
    await dialog.getByRole("region",{name:"Reunir o Conselho",exact:true}).getByText("Concluída",{exact:true}).waitFor();
    assert.equal((await ok(request(owner,endpoint))).state.cities[0].life.contentment,80);
    await next.tap();
    await dialog.getByText("Perfil do soberano",{exact:true}).waitFor();
    await next.tap();
    const oldGems=(await one("select gems from kw_player_wallet where user_id=$1",[ownerId])).gems;
    await db.query("update kw_player_wallet set gem_debt=3 where user_id=$1",[ownerId]);
    await finish.tap();
    await dialog.getByText(/O prêmio mudou/).waitFor();
    const revised=await ok(request(owner,previewUrl));
    assert.equal(revised.rewards.refundOffset,3);
    await dialog.getByText(new RegExp(`\\+${revised.rewards.creditedGems} gemas`)).waitFor();
    assert.equal(await countWorlds(),1);
    const beforeFinal=await readLegacy(ownerId);
    const response=legacyPage.waitForResponse(reply=>reply.request().method()==="POST"&&reply.request().postDataJSON()?.action?.type==="ascend");
    await finish.tap();
    const receiptResponse=await response;
    assert.equal(receiptResponse.status(),200,await receiptResponse.text());
    const outcome=legacyPage.getByRole("dialog",{name:"Resultado da Travessia",exact:true});
    await outcome.getByRole("heading",{name:"Ascensão concluída",exact:true}).waitFor();
    assert.match(await legacyPage.getByRole("button",{name:"Menu do reino",exact:true,includeHidden:true}).textContent(),/Reinado arquivado/);
    const portalArt=outcome.locator('img[src*="portal-travessia"]');
    await portalArt.waitFor();
    await portalArt.evaluate(image=>image.decode());
    if (screenshots) await legacyPage.screenshot({path:join(screenshots,"travessia.png")});
    assert(await legacyPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const outcomeNext=outcome.getByRole("button",{name:"Próximo",exact:true});
    const outcomeBack=outcome.getByRole("button",{name:"Anterior",exact:true});
    assert(await outcomeBack.isDisabled());
    await outcomeNext.tap();
    await outcome.getByRole("heading",{name:"Recompensas recebidas",exact:true}).waitFor();
    await outcome.getByText(`+${revised.rewards.creditedGems} Gemas`,{exact:true}).waitFor();
    await outcome.getByText("Carteira da conta",{exact:true}).waitFor();
    if (screenshots) await legacyPage.screenshot({path:join(screenshots,"recompensas.png")});
    assert.equal(await outcome.getByRole("link",{name:"Voltar aos mundos",exact:true}).count(),0);
    await outcomeBack.tap();
    await outcome.getByRole("heading",{name:"Ascensão concluída",exact:true}).waitFor();
    await outcomeNext.tap();
    await outcomeNext.tap();
    await outcome.getByRole("heading",{name:"Para os próximos reinados",exact:true}).waitFor();
    await outcome.getByRole("link",{name:"Ver soberanos",exact:true}).waitFor();
    if (screenshots) await legacyPage.screenshot({path:join(screenshots,"legado.png")});
    for(const width of [320,390,430]){
      await legacyPage.setViewportSize({width,height:800});
      assert(await outcome.evaluate(element=>element.scrollWidth<=element.clientWidth+1));
    }
    await outcome.getByRole("button",{name:"Fechar janela",exact:true}).tap();
    await legacyPage.getByRole("button",{name:"Ver resultado da Travessia",exact:true}).tap();
    await outcome.getByRole("heading",{name:"Ascensão concluída",exact:true}).waitFor();
    await outcomeNext.tap();
    await outcomeNext.tap();
    const firstBody=receiptResponse.request().postDataJSON();
    await ok(request(owner,endpoint,firstBody));
    const newArchive=await readLegacy(ownerId);
    assert.equal(newArchive.receipts.length,beforeFinal.receipts.length+1);
    assert.equal(newArchive.receipts[0].cities[0].name,"Nova Aurora");
    assert.deepEqual(Object.keys(newArchive.receipts[0].proofs).sort(),["council","provisions"]);
    assert.equal(newArchive.receipts[0].rewards.creditedGems,revised.rewards.creditedGems);
    assert.equal((await one("select gems from kw_player_wallet where user_id=$1",[ownerId])).gems,oldGems+revised.rewards.creditedGems);
    assert.equal(await countWorlds(),0);
    const departed=await ok(request(owner,endpoint));
    assert.equal(departed.shared.claims[`${land.q},${land.r}`],undefined);
    assert.equal(departed.world.status,"running");
    await outcome.getByRole("link",{name:"Voltar aos mundos",exact:true}).tap();
    await legacyPage.getByRole("button",{name:"Começar novo reinado",exact:true}).waitFor();
    await legacyPage.getByRole("link",{name:"Ver no Legado",exact:true}).tap();
    const newestReceipt=legacyPage.locator("details").filter({hasText:"Nova Aurora"});
    await newestReceipt.locator("summary").tap();
    const legacyReplay=newestReceipt.getByRole("button",{name:"Ver resultado da Travessia",exact:true});
    await legacyReplay.tap();
    await outcome.getByRole("heading",{name:"Ascensão concluída",exact:true}).waitFor();
    await outcomeNext.tap();
    await outcome.getByText(`+${revised.rewards.creditedGems} Gemas`,{exact:true}).waitFor();
    await outcomeNext.tap();
    await outcome.getByRole("button",{name:"Concluir",exact:true}).tap();
    await outcome.waitFor({state:"hidden"});
    assert(await legacyReplay.evaluate(button=>button===document.activeElement));
    assert.deepEqual(await readLegacy(ownerId),newArchive);
    const ownerProfile=await ok(request(owner,base+"/api/me/cozy"));
    const visitorProfile=await ok(request(first,base+"/api/me/cozy"));
    assert.deepEqual(ownerProfile.ascensionMedals,{gold:2});
    assert.deepEqual(visitorProfile.ascensionMedals,{bronze:1});
    await legacyPage.setViewportSize({width:320,height:800});
    await legacyPage.goto(base+"/profile",{waitUntil:"domcontentloaded"});
    const profileMedals=legacyPage.getByRole("list",{name:"Medalhas conquistadas"});
    await profileMedals.getByText("×2",{exact:true}).waitFor();
    await profileMedals.scrollIntoViewIfNeeded();
    assert.equal(await profileMedals.getByRole("listitem").count(),1);
    await profileMedals.locator('img[src*="medalha-ouro"]').evaluate(image=>image.decode());
    assert(await profileMedals.evaluate(list=>list.scrollWidth<=list.clientWidth+1));
    await legacyPage.getByRole("link",{name:"Ver reinados",exact:true}).tap();
    await legacyPage.getByRole("heading",{name:"Legado",exact:true}).waitFor();
    console.log("PASS perfil: medalhas da conta, quantidade, privacidade e acesso ao Legado a 320 px.");
    await legacyPage.close();
    console.log("PASS Rito: provas persistidas, pagamento único, resultado navegável e reaberto a 320/390/430 px e retorno ao lobby.");
  }
  console.log("PASS banco, API e celular: herói salvo, retomada, fundação, primeira audiência e fila de obras.");
} catch (error) {
  console.error(log);
  throw error;
} finally {
  if (browser) await browser.close();
  server.kill();
  await rest.close();
  await db.close();
}
