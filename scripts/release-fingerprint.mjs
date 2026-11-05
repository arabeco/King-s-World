import {createHash} from 'node:crypto';
import {readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
/** Code identity only. Never includes .env, credentials, user data or generated bundles. */
export function releaseFingerprint(base=root){
 const files=['package.json','package-lock.json','next.config.mjs','scripts/release-fingerprint.mjs'];
 function scan(dir){for(const entry of readdirSync(path.join(base,dir),{withFileTypes:true})){
  const name=dir+'/'+entry.name;if(entry.isDirectory())scan(name);else if(entry.isFile()&&/\.(?:ts|tsx|js|mjs|css|json)$/.test(name))files.push(name);
 }}
 for(const dir of ['app','components','lib','supabase/functions'])scan(dir);
 for(const name of readdirSync(base))if(/^\d+_SQL_.*\.sql$/.test(name))files.push(name);
 const hash=createHash('sha256').update('kingsworld-code-v1\0');
 for(const name of files.sort()){
  // Git's CRLF checkout setting must not change a release identity.
  const content=readFileSync(path.join(base,name),'utf8').replace(/\r\n/g,'\n');
  hash.update(name+'\0'+Buffer.byteLength(content)+'\0').update(content);
 }
 return hash.digest('hex');
}
