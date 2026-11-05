import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {releaseFingerprint} from '../scripts/release-fingerprint.mjs';
const temp=await mkdtemp(path.join(tmpdir(),'kw-release-'));
for(const dir of ['app','components','lib','supabase/functions','scripts'])await mkdir(path.join(temp,dir),{recursive:true});
for(const file of ['package.json','package-lock.json','next.config.mjs','scripts/release-fingerprint.mjs','lib/sample.ts'])await writeFile(path.join(temp,file),'first\nsecond\n');
const first=releaseFingerprint(temp);assert.match(first,/^[a-f0-9]{64}$/);
await writeFile(path.join(temp,'.env.local'),'PRIVATE_TEST_VALUE=never-part-of-the-revision');assert.equal(releaseFingerprint(temp),first);
await writeFile(path.join(temp,'lib/sample.ts'),'first\r\nsecond\r\n');assert.equal(releaseFingerprint(temp),first,'Line endings cannot change release identity');
await writeFile(path.join(temp,'lib/sample.ts'),'changed\nsecond\n');assert.notEqual(releaseFingerprint(temp),first,'Code changes must change identity');
const html=await readFile(new URL('../native-shell/index.html',import.meta.url),'utf8');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
try{
 for(const width of [320,390,430]){
  const page=await browser.newPage({viewport:{width,height:844}}),target=base+'/login?next=%2Flobby';
  await page.goto(base+'/?retry='+encodeURIComponent(target));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const button=page.getByRole('button',{name:'Tentar novamente',exact:true});assert((await button.boundingBox()).height>=44);
  assert.equal(await page.locator('img,iframe,link[rel=stylesheet]').count(),0,'Recovery must not need network assets');
  if(width===390)await page.screenshot({path:new URL('../reports/cozy/native-connection-390.png',import.meta.url).pathname.replace(/^\/(.:\/)/,'$1')});
  await Promise.all([page.waitForURL(target),button.click()]);await page.close();
 }
 for(const bad of ['javascript:alert(1)','http://untrusted.invalid','not a url']){
  const page=await browser.newPage();let requested=false;
  await page.route('https://king-s-world-three.vercel.app/**',route=>{requested=true;return route.fulfill({status:200,body:'Recovered'});});
  await page.goto(base+'/?retry='+encodeURIComponent(bad));
  await Promise.all([page.waitForURL('https://king-s-world-three.vercel.app/'),page.getByRole('button',{name:'Tentar novamente',exact:true}).click()]);
  assert(requested);await page.close();
 }
 console.log('PASS native shell: isolated 320/390/430px recovery, no network art, touch target, configured retry, unsafe-scheme fallback; release fingerprint tracks code and excludes secrets/line endings');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
