// Same 2GB AVD and APK for each sample. No map navigation or game mutations.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),{promisify}=require('node:util'),{chromium}=require('playwright');
const run=promisify(cp.execFile),root=path.resolve(__dirname,'..'),folder=path.join(root,'reports/cozy/memory');
const meta=JSON.parse(fs.readFileSync(path.join(folder,'session.json'),'utf8'));
const adb=path.join(process.env.LOCALAPPDATA,'Android/Sdk/platform-tools/adb.exe'),device='emulator-5556';
const shell=async(...args)=>(await run(adb,['-s',device,...args],{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024,timeout:20000})).stdout;
const samples=[],started=Date.now();let monitoring=true,browser;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function sample(stage){
 const system=await shell('shell','cat','/proc/meminfo');
 const pid=(await shell('shell','pidof','com.kingsworld.app').catch(()=>'' )).trim();
 let memory='';if(pid)memory=await shell('shell','dumpsys','meminfo',pid).catch(()=>'');
 const rss=memory.match(/TOTAL RSS:\s+(\d+)/),pss=memory.match(/TOTAL PSS:\s+(\d+)/);
 const row={stage,seconds:Math.round((Date.now()-started)/1000),pid:pid||null,systemTotalKB:Number(system.match(/MemTotal:\s+(\d+)/)?.[1]),systemAvailableKB:Number(system.match(/MemAvailable:\s+(\d+)/)?.[1]),appPssKB:pss?Number(pss[1]):null,appRssKB:rss?Number(rss[1]):null};samples.push(row);return row;
}
(async()=>{
 const output=path.join(folder,`${meta.label}-android-memory.json`);fs.writeFileSync(output,JSON.stringify({status:'RUNNING',label:meta.label}));
 await shell('reverse','tcp:3318','tcp:3318');await shell('reverse','tcp:3320','tcp:3320');
 await shell('shell','input','keyevent','224');await shell('shell','wm','dismiss-keyguard');
 await shell('shell','am','force-stop','com.kingsworld.app');const before=await sample('system-before-app');
 assert.ok(before.systemTotalKB>1800000&&before.systemTotalKB<2200000,'This comparison requires the actual 2GB AVD configuration');
 const loop=(async()=>{while(monitoring){await sample('sampling').catch(()=>{});await sleep(3000);}})();
 try{
  await shell('shell','am','start','-W','-n','com.kingsworld.app/.MainActivity');
  const pid=(await shell('shell','pidof','com.kingsworld.app')).trim();if(!pid)throw Error('App process not present after start');
  await shell('forward','tcp:9228',`localabstract:webview_devtools_remote_${pid}`);
  for(let n=0;n<12;n++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9228',{timeout:3000});break;}catch{await sleep(1000);}}
  if(!browser)throw Error('Native WebView did not become available');
  const context=browser.contexts()[0];const page=context.pages()[0];page.setDefaultTimeout(30000);
  await page.waitForURL(/\/(lobby|login|world\/)/,{timeout:45000});
  await page.waitForLoadState('networkidle',{timeout:45000});
  await context.addCookies(meta.cookies);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(meta.url,{waitUntil:'networkidle',timeout:45000});await page.getByRole('navigation',{name:'Áreas do reino'}).waitFor();
  const crownHelp=page.getByRole('dialog',{name:'Como comandar seu reino',exact:true});
  if(await crownHelp.count())await crownHelp.getByRole('button',{name:'Fechar ajuda',exact:true}).click();
  await sample('crown-ready');await sleep(15000);await sample('crown-idle');
  for(const name of ['Militar','Governo','Conselho','Conquistas']){
   await page.getByRole('button',{name,exact:true}).click();const help=page.getByRole('dialog').filter({has:page.getByRole('button',{name:'Pular',exact:true})});if(await help.count())await help.getByRole('button',{name:'Pular',exact:true}).click();
   await page.getByRole('dialog',{name,exact:true}).waitFor();await sample('panel-'+name);await page.getByRole('button',{name:'Fechar painel',exact:true}).click();
  }
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
  const js=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  await page.screenshot({path:path.join(folder,`${meta.label}-android-crown.png`)});await sample('panels-closed');
  assert.deepEqual(errors,[], 'WebView must not report an uncaught JavaScript error');
  // Reopen without injecting cookies again: session recovery must survive a
  // process death. These are controlled force-stops, not simulated OOM proof.
  for(let i=0;i<Number(process.env.COZY_MEMORY_RESTARTS||0);i++){
   await browser.close();browser=null;
   await shell('shell','am','force-stop','com.kingsworld.app');
   await shell('shell','am','start','-W','-n','com.kingsworld.app/.MainActivity');
   const nextPid=(await shell('shell','pidof','com.kingsworld.app')).trim();
   assert.ok(nextPid,'App must reopen');assert.notEqual(nextPid,pid);
   await shell('forward','tcp:9228',`localabstract:webview_devtools_remote_${nextPid}`);
   for(let n=0;n<12;n++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9228',{timeout:3000});break;}catch{await sleep(1000);}}
   assert.ok(browser,'Reopened WebView must become available');
   const reopened=browser.contexts()[0].pages()[0];reopened.on('pageerror',e=>errors.push(e.message));
   // Let Capacitor's own initial URL and the server redirect settle first.
   // Competing with them can abort goto() without an app/process failure.
   await reopened.waitForURL(/\/(lobby|login|world\/)/,{timeout:45000});
   await reopened.waitForLoadState('networkidle',{timeout:45000});
   await reopened.goto(meta.url,{waitUntil:'networkidle',timeout:45000});
   await reopened.getByRole('navigation',{name:'Áreas do reino'}).waitFor();
   await sample(`reopen-${i+1}`);assert.deepEqual(errors,[]);
  }
  if(process.env.COZY_MEMORY_TEST_SIGNED_OUT==='1'){
   const current=browser.contexts()[0];await current.clearCookies();const login=current.pages()[0];
   await login.goto(meta.base+'/lobby',{waitUntil:'networkidle',timeout:45000});
   await login.waitForURL(url=>url.origin===meta.base&&url.pathname==='/login',{timeout:30000});
   await login.getByRole('button',{name:'Entrar',exact:true}).waitFor();
   const activity=await shell('shell','dumpsys','activity','activities');
   assert.match(activity,/topResumedActivity[^\n]*com\.kingsworld\.app/,'Sign-in must remain in the native app');
   await sample('signed-out-stays-in-app');await login.screenshot({path:path.join(folder,`${meta.label}-android-login.png`)});
  }
  monitoring=false;await loop;
  fs.writeFileSync(output,JSON.stringify({status:'PASS',scope:'Instrumented native WebView, optimized local app, normal initial state, main-process PSS excludes separate renderers; not a physical-device benchmark.',label:meta.label,mode:meta.mode,samples,jsHeapUsed:js.JSHeapUsedSize,errors},null,2));console.log('PASS',meta.label,JSON.stringify(samples.filter(s=>s.stage!=='sampling')));
 }catch(error){monitoring=false;await loop;const exit=await shell('shell','dumpsys','activity','exit-info','com.kingsworld.app').catch(()=> 'Unavailable');fs.writeFileSync(path.join(folder,`${meta.label}-android-exit.txt`),exit);fs.writeFileSync(path.join(folder,`${meta.label}-android-logcat.txt`),await shell('logcat','-d','-t','1500').catch(()=> 'Unavailable'));fs.writeFileSync(output,JSON.stringify({status:'FAIL',label:meta.label,mode:meta.mode,error:String(error),samples},null,2));throw error;}
 finally{monitoring=false;if(browser)await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
