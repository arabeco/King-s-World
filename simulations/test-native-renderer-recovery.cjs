// Run after the connection test, with the disposable emulator's WebView open.
const assert=require('node:assert/strict'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{writeFileSync}=require('node:fs');
const {chromium}=require('playwright');
const adb=path.join(process.env.LOCALAPPDATA,'Android/Sdk/platform-tools/adb.exe'),device='emulator-5556';
const run=(...args)=>execFileSync(adb,['-s',device,...args],{encoding:'utf8',windowsHide:true,timeout:30000});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const report=path.resolve(__dirname,'../reports/cozy/native-renderer-recovery.json');
(async()=>{
 assert(run('emu','avd','name').includes('KingsWorld_Cozy_QA'));
 const pid=run('shell','pidof','com.kingsworld.app').trim();assert(pid);
 let browser;writeFileSync(report,JSON.stringify({status:'RUNNING',scope:'Controlled renderer crash in disposable native emulator'}));
 try{
  run('forward','tcp:9229','localabstract:webview_devtools_remote_'+pid);
  browser=await chromium.connectOverCDP('http://127.0.0.1:9229');const page=browser.contexts()[0].pages()[0];assert(page);
  const session=await page.context().newCDPSession(page);
  await Promise.race([session.send('Page.crash').catch(()=>{}),sleep(2000)]);
  for(let i=0;i<20&&!run('shell','dumpsys','window').includes('com.kingsworld.app.RecoveryActivity');i++)await sleep(500);
  assert(run('shell','dumpsys','window').includes('com.kingsworld.app.RecoveryActivity'));
  assert.equal(run('shell','pidof','com.kingsworld.app').trim(),pid);
  run('shell','uiautomator','dump','/sdcard/kw-renderer.xml');const xml=run('shell','cat','/sdcard/kw-renderer.xml');
  assert(xml.includes('Não foi possível manter o jogo aberto.'));
  writeFileSync(path.resolve(__dirname,'../reports/cozy/native-renderer-recovery.png'),execFileSync(adb,['-s',device,'exec-out','screencap','-p'],{windowsHide:true}));
  await sleep(2000);assert.equal(run('shell','pidof','com.kingsworld.app').trim(),pid,'No crash or automatic restart while recovery is visible');
  const node=xml.match(/<node[^>]*resource-id="com\.kingsworld\.app:id\/recovery_retry"[^>]*>/)?.[0];assert(node);
  const box=node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).slice(1).map(Number);
  run('shell','input','tap',String((box[0]+box[2])/2),String((box[1]+box[3])/2));await sleep(3000);
  assert.equal(run('shell','pidof','com.kingsworld.app').trim(),pid);assert(run('shell','dumpsys','window').includes('com.kingsworld.app/com.kingsworld.app.MainActivity'));
  const result={status:'PASS',scope:'Native emulator, controlled renderer crash, native recovery without app-process death, explicit native retry; not proof of general low-memory performance',pid};writeFileSync(report,JSON.stringify(result,null,2));console.log(result);
 }catch(error){writeFileSync(report,JSON.stringify({status:'FAIL',error:error.message}));throw error;}
 finally{if(browser)await browser.close();run('forward','--remove','tcp:9229');}
})().catch(error=>{console.error(error);process.exitCode=1;});
