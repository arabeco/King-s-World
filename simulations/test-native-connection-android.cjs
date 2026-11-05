const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {writeFileSync}=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const adb=path.join(process.env.LOCALAPPDATA,'Android/Sdk/platform-tools/adb.exe'),device='emulator-5556';
const run=(...args)=>execFileSync(adb,['-s',device,...args],{encoding:'utf8',timeout:60000,windowsHide:true,maxBuffer:4*1024*1024});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const memoryMb=Number(process.env.COZY_ANDROID_MEMORY_MB??2048);
const report=path.resolve(__dirname,`../reports/cozy/native-connection-android-${memoryMb}.json`);
(async()=>{
 const avd=run('emu','avd','name');assert(avd.includes('KingsWorld_Cozy_QA'),'Only the disposable KingsWorld emulator may be altered');
 const old={wifi:run('shell','settings','get','global','wifi_on').trim(),data:run('shell','settings','get','global','mobile_data').trim(),airplane:run('shell','settings','get','global','airplane_mode_on').trim()};
 let browser,forwarded=false,memoryRecoveryUsed=false;
 writeFileSync(report,JSON.stringify({status:'RUNNING',scope:`${memoryMb}MB Android emulator, native connection recovery only`}));
 try{
  run('install','-r',path.resolve(__dirname,'../android/app/build/outputs/apk/debug/app-debug.apk'));
  run('shell','cmd','connectivity','airplane-mode','enable');run('shell','svc','wifi','disable');run('shell','svc','data','disable');
  run('shell','am','force-stop','com.kingsworld.app');run('shell','am','start','-n','com.kingsworld.app/.MainActivity');
  let pid;for(let i=0;i<40;i++){try{pid=run('shell','pidof','com.kingsworld.app').trim();}catch{pid='';}if(pid)break;await sleep(500);}assert(pid);
  run('forward','tcp:9229','localabstract:webview_devtools_remote_'+pid);forwarded=true;
  for(let i=0;i<40&&!browser;i++){
   try{browser=await chromium.connectOverCDP('http://127.0.0.1:9229',{timeout:1500});}catch{}
   if(!browser&&i%5===0&&!memoryRecoveryUsed&&run('shell','dumpsys','window').includes('com.kingsworld.app.RecoveryActivity')){
    assert.equal(run('shell','pidof','com.kingsworld.app').trim(),pid,'Renderer termination must not kill the app process');
    run('shell','uiautomator','dump','/sdcard/kw-recovery.xml');const xml=run('shell','cat','/sdcard/kw-recovery.xml');
    assert(xml.includes('Vamos retomar seu reino'));
    const node=xml.match(/<node[^>]*resource-id="com\.kingsworld\.app:id\/recovery_retry"[^>]*>/)?.[0];assert(node);
    const box=node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).slice(1).map(Number);
    run('shell','input','tap',String((box[0]+box[2])/2),String((box[1]+box[3])/2));memoryRecoveryUsed=true;
   }
   if(!browser)await sleep(500);
  }
  assert(browser,'No surviving WebView after one native memory-recovery retry');const page=browser.contexts()[0].pages()[0];assert(page);
  await page.getByRole('heading',{name:'Seu reino aguarda',exact:true}).waitFor({timeout:60000});
  assert(page.url().includes('localhost/index.html?retry='),'The local recovery must be loaded by the actual Capacitor error handler');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.resolve(__dirname,`../reports/cozy/native-offline-android-${memoryMb}.png`)});
  run('shell','cmd','connectivity','airplane-mode','disable');run('shell','svc','data','enable');run('shell','svc','wifi','enable');await sleep(3000);
  for(let i=0;i<20&&!run('shell','dumpsys','connectivity').includes('IS_VALIDATED');i++)await sleep(500);
  const button=page.getByRole('button',{name:'Tentar novamente',exact:true}),box=await button.boundingBox(),ratio=await page.evaluate(()=>devicePixelRatio);assert(box&&box.height>=44);
  // Android 17 insets the WebView below the status bar. DOM coordinates start
  // at the WebView origin, not at the top of the physical screen.
  run('shell','uiautomator','dump','/sdcard/kw-connection.xml');const xml=run('shell','cat','/sdcard/kw-connection.xml');
  const webView=xml.match(/<node[^>]*class="android\.webkit\.WebView"[^>]*>/)?.[0];assert(webView);
  const origin=webView.match(/bounds="\[(\d+),(\d+)\]/).slice(1).map(Number);
  run('shell','input','tap',String(Math.round(origin[0]+(box.x+box.width/2)*ratio)),String(Math.round(origin[1]+(box.y+box.height/2)*ratio)));
  await page.waitForURL(/^https:\/\/king-s-world-three\.vercel\.app\//,{timeout:60000,waitUntil:'domcontentloaded'});
  assert(run('shell','dumpsys','window').includes('com.kingsworld.app/'),'Retry must remain in the native activity');
  const result={status:'PASS',scope:`${memoryMb}MB Android emulator, real Capacitor offline errorPath, native touch retry to the configured HTTPS server; not a new gameplay release, physical device or billing test`,device,url:page.url(),viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight})),pid,memoryRecoveryUsed,nativeWebViewOrigin:origin};
  writeFileSync(report,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }catch(error){writeFileSync(report,JSON.stringify({status:'FAIL',error:error.message,scope:'Native connection recovery only'}));throw error;}
 finally{
  if(browser)await browser.close();
  run('shell','cmd','connectivity','airplane-mode',old.airplane==='1'?'enable':'disable');run('shell','svc','wifi',old.wifi==='1'?'enable':'disable');run('shell','svc','data',old.data==='1'?'enable':'disable');
  if(forwarded)run('forward','--remove','tcp:9229');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
