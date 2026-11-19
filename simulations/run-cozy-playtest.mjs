import {randomUUID} from "node:crypto";
import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {setTimeout as delay} from "node:timers/promises";
import {fileURLToPath} from "node:url";
import {startCozyRest} from "./lib/cozy-fixture.mjs";
import {createCozyFoundingDatabase,stageCozyAscension} from "./lib/cozy-founding-fixture.mjs";

const rite=process.argv.includes("--rito");
const root=new URL("../",import.meta.url);
const host="127.0.0.1";
const reservation=createServer();
await new Promise(resolve=>reservation.listen(0,host,resolve));
const {port}=reservation.address();
await new Promise(resolve=>reservation.close(resolve));
const base=`http://${host}:${port}`;
const db=await createCozyFoundingDatabase({persistent:true});
let rest,child;
try {
  rest=await startCozyRest(db);
  child=spawn(process.execPath,[
    fileURLToPath(new URL("node_modules/next/dist/bin/next",root)),
    "dev","--hostname",host,"--port",String(port),
  ],{
    cwd:fileURLToPath(root),windowsHide:true,stdio:"inherit",
    env:{...process.env,NEXT_DIST_DIR:rite?".next-cozy-playtest-rite":".next-cozy-playtest",
      KW_COZY_PERSISTENT_PREVIEW:"1",NEXT_PUBLIC_SUPABASE_URL:rest.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"fixture-public",
      SUPABASE_SECRET_KEY:"fixture-service",SUPABASE_SERVICE_ROLE_KEY:"fixture-service"},
  });
  const closed=new Promise((resolve,reject)=>{
    child.once("error",reject);
    child.once("exit",resolve);
  });
  const stop=()=>child.kill();
  process.once("SIGINT",stop);
  process.once("SIGTERM",stop);

  async function request(path,body) {
    const response=await fetch(base+path,{
      headers:{cookie:"kw_dev_auth=1",...(body&&{"Content-Type":"application/json"})},
      method:body?"POST":"GET",body:body?JSON.stringify(body):undefined,
      signal:AbortSignal.timeout(45_000),
    });
    if(!response.ok)throw new Error(`HTTP ${response.status} em ${path}: ${await response.text()}`);
    return response.json();
  }
  async function prepareRite() {
    const {world}=await request("/api/worlds/create",{name:"Aurora · Teste da Travessia",mode:"express"});
    const endpoint=`/api/worlds/${world.slug}/cozy`;
    const initial=await request(endpoint);
    const action=command=>request(endpoint,{action:command,requestId:randomUUID(),playerId:initial.state.playerId});
    await action({type:"king_choose",profileId:"builder",nickname:initial.state.playerName});
    await action({type:"counselor",slot:0,counselorId:"helena"});
    await action({type:"counselor",slot:1,counselorId:"ines"});
    const hired=await action({type:"hire",role:"engineer"});
    const tile=hired.tiles.find(candidate=>candidate.foundation?.canFound);
    const founded=await action({type:"found_capital",q:tile.q,r:tile.r,name:"Aurora",heroId:hired.state.heroes[0].id});
    await stageCozyAscension(db,founded.state);
    const {computed}=await request(endpoint);
    if(computed.influence.total<1500)throw new Error("O cenário da Travessia precisa começar acima de 1.500 de influência.");
  }

  const start=async()=>{
    for(let attempt=0;attempt<90;attempt++){
      if(await fetch(base+"/api/release",{signal:AbortSignal.timeout(4000)}).then(response=>response.ok,()=>false))break;
      if(attempt===89)throw new Error("O servidor do teste Cozy não iniciou.");
      await delay(500);
    }
    if(rite)await prepareRite();
    console.log(`\nTeste Cozy • ${rite?"Travessia":"reino novo"}\n${base}/login\nUse “Entrar como dev”. Os dados de teste ficam ativos enquanto o servidor rodar.\n`);
    await closed;
  };
  await Promise.race([start(),closed.then(()=>{if(child.exitCode)throw new Error(`Servidor do teste encerrou com código ${child.exitCode}.`);})]);
} finally {
  if(child?.exitCode===null)child.kill();
  await rest?.close();
  await db.close();
}
