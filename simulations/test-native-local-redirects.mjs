import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const code=ts.transpileModule(readFileSync(new URL('../middleware.ts',import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
function load(mode,user){
 let authCalls=0;
 const module={exports:{}};
 new Function('require','module','exports','process',code)(name=>{
  if(name==='@supabase/ssr')return {createServerClient:()=>({auth:{getUser:async()=>{authCalls++;return {data:{user}};}}})};
  if(name==='next/server')return {NextResponse:{next:()=>({kind:'next'}),redirect:url=>({kind:'redirect',url:String(url)}),json:(value,options)=>({kind:'json',value,...options})}};
  throw Error('Unexpected middleware dependency '+name);
 },module,module.exports,{env:{NODE_ENV:mode,NEXT_PUBLIC_SUPABASE_URL:'http://fixture.invalid',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'local-key'}});
 return {middleware:module.exports.middleware,calls:()=>authCalls};
}
function request(path,host,{devCookie=false,smoke=false,origin='http://localhost:3318'}={}){
 return {nextUrl:new URL(path,origin),headers:new Headers({host,...(smoke?{'x-kw-smoke':'1'}:{})}),cookies:{get:name=>name==='kw_dev_auth'&&devCookie?{value:'1'}:undefined,getAll:()=>[],set:()=>{}}};
}
for(const mode of ['development','production']){
 for(const host of ['127.0.0.1:3318','localhost:3318']){
  const signedOut=load(mode,null);
  const login=await signedOut.middleware(request('/lobby',host));
  assert.equal(login.url,`http://${host}/login?next=%2Flobby`);
  const signedIn=load(mode,{id:'user'});
  const lobby=await signedIn.middleware(request('/login?next=%2Flobby',host));
  assert.equal(lobby.url,`http://${host}/lobby`);
 }
}
const production=load('production',null);
for(const options of [{devCookie:true},{smoke:true}]){
 const out=await production.middleware(request('/world/private','127.0.0.1:3318',options));
 assert.equal(new URL(out.url).pathname,'/login','Local redirects must never enable development authentication in production');
}
assert.equal(production.calls(),2);
const publicOrigin='https://king-s-world-three.vercel.app';
const publicLogin=await production.middleware(request('/lobby','king-s-world-three.vercel.app',{origin:publicOrigin}));
assert.equal(publicLogin.url,publicOrigin+'/login?next=%2Flobby');
const api=await production.middleware(request('/api/worlds/private','127.0.0.1:3318'));
assert.equal(api.kind,'json');assert.equal(api.status,401);assert.equal(api.value.code,'UNAUTHORIZED');
const configSource=readFileSync(new URL('../next.config.mjs',import.meta.url),'utf8').replace('export default nextConfig;','return nextConfig;');
const config=env=>new Function('process',configSource)({env});
assert.equal(config({NODE_ENV:'production'}).skipMiddlewareUrlNormalize,false,'Deployed builds retain the Next default');
assert.equal(config({NODE_ENV:'production',KW_LOCAL_WEBVIEW_QA:'1'}).skipMiddlewareUrlNormalize,true,'Explicit local optimized QA preserves redirect origins');
assert.equal(config({NODE_ENV:'development'}).skipMiddlewareUrlNormalize,true);
console.log('PASS native redirects: both modes retain exact loopback origin, real origin unchanged, production bypass blocked and API remains 401');
