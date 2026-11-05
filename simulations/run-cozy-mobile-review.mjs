// Disposable first-use review: local PostgreSQL and local app, no remote writes.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createCozyDatabase,startCozyRest} from './lib/cozy-fixture.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const reports=path.join(root,'reports/cozy/mobile-review');
await mkdir(reports,{recursive:true});
const db=await createCozyDatabase();
await db.exec(await readFile(path.join(root,'63_SQL_COZY_EXPRESS_ECONOMY.sql'),'utf8'));
const rest=await startCozyRest(db);
const base='http://127.0.0.1:3339';
const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3339'],{cwd:root,windowsHide:true,env:{...process.env,NEXT_DIST_DIR:'.next-mobile-review',NEXT_PUBLIC_SUPABASE_URL:rest.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-public',SUPABASE_SECRET_KEY:'fixture-service',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'},stdio:['ignore','pipe','pipe']});
let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
const profile=await mkdtemp(path.join(os.tmpdir(),'kw-mobile-review-'));
const context=await chromium.launchPersistentContext(profile,{headless:true,args:['--remote-debugging-port=3340'],viewport:{width:360,height:740},isMobile:true,hasTouch:true,deviceScaleFactor:1});
await context.addCookies([{name:'kw_dev_auth',value:'1',url:base}]);
const page=context.pages()[0];
async function stop(){await writeFile(path.join(reports,'server.log'),log);await context.close();child.kill();await rest.close();await db.close();process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);process.stdin.on('data',value=>{if(String(value).trim()==='stop')void stop();});
for(let n=0;n<90;n++){try{await fetch(base+'/login',{signal:AbortSignal.timeout(1500)});break;}catch{if(n===89)throw Error('Local review startup timed out');await new Promise(r=>setTimeout(r,1000));}}
await page.goto(base+'/lobby',{waitUntil:'networkidle'});
await page.screenshot({path:path.join(reports,'01-lobby-360.png'),fullPage:true});
await writeFile(path.join(reports,'session.json'),JSON.stringify({base,cdp:'http://127.0.0.1:3340',scope:'Disposable local first-use review; touch browser, not physical Android.'}));
console.log('MOBILE_REVIEW_READY');
