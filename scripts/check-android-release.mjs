import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {releaseFingerprint} from './release-fingerprint.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8', windowsHide: true}).trim();
const report={at:new Date().toISOString(),status:'PENDING',scope:'Release code identity and native target only; not Play billing, device performance or database verification'};
try{
 const expected=releaseFingerprint();report.expectedCodeRevision=expected;
 const config=JSON.parse(await readFile(new URL('../android/app/src/main/assets/capacitor.config.json',import.meta.url),'utf8'));
 const url=new URL(config.server?.url??'');
 if(config.appId!=='com.kingsworld.app'||url.protocol!=='https:')throw Error('Release requires the KingsWorld package and an HTTPS server');
 report.package=config.appId;report.url=url.origin;
 const response=await fetch(new URL('/api/release',url),{redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Cache-Control':'no-cache'}});
 report.httpStatus=response.status;
 if(!response.ok)throw Error('The configured app server does not expose this release identity yet');
 const deployed=await response.json();report.deployedCodeRevision=deployed.codeRevision;
 if (deployed.application !== 'kingsworld') throw Error('The configured server does not identify itself as KingsWorld');
 if (deployed.gitRevision !== undefined) {
  report.deployedGitRevision = deployed.gitRevision;
  report.expectedGitRevision = git('rev-parse', 'HEAD');
  if (deployed.gitRevision !== report.expectedGitRevision) throw Error('The configured app server is running a different Git commit');
  const changes = git('status', '--porcelain', '--untracked-files=all', '--', 'app', 'components', 'lib', 'public',
   'supabase/functions', 'scripts', 'native-shell', 'middleware.ts', 'next.config.mjs', 'package.json', 'package-lock.json',
   'postcss.config.js', 'tailwind.config.js', 'tsconfig.json', 'capacitor.config.ts', '*_SQL_*.sql');
  if (changes) throw Error('Commit the local application changes before packaging the deployed release');
  report.verifiedBy = 'git-commit';
 } else {
  if (deployed.codeRevision !== expected) throw Error('The configured app server has a different code revision');
  report.verifiedBy = 'source-fingerprint';
 }
 report.status='PASS';
}catch(error){report.reason=error instanceof Error?error.message:'Release verification unavailable';}
await mkdir(new URL('../reports/cozy/',import.meta.url),{recursive:true});
await writeFile(new URL('../reports/cozy/android-release-gate.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exitCode=1;
