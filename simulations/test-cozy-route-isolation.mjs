import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Check the server branches, including which client modules are loaded. A null
// child is intentional: CozyWorldClient owns navigation in the cozy layout.
const params={worldId:'world-fixture'},children={type:'legacy-child'};
const payload={world:{id:'legacy'}};
const jsx=(type,props)=>({type,props});
function load(file,cozy){
 const imports=[];
 const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
 }).outputText;
 const module={exports:{}};
 const dependencies={
  'react/jsx-runtime':{jsx,jsxs:jsx},
  '@/lib/cozy/server':{isCozyWorld:async id=>{assert.equal(id,params.worldId);return cozy;}},
  '@/components/cozy/CozyWorldClient':{CozyWorldClient:'cozy-screen'},
  '@/components/legacy-world-entry':{default:'legacy-shell'},
  '@/lib/world-data':{getWorldPayload:async id=>{assert.equal(id,params.worldId);return payload;}},
  './intelligence-client':{IntelligenceClient:'legacy-intelligence'},
  '@/lib/season-audit-analytics':{seasonAuditAnalytics:{profileHealth:'legacy-analytics'}},
  './empire-client':{default:'legacy-empire'},
 };
 new Function('require','module','exports',code)(name=>{
  imports.push(name);assert.ok(name in dependencies,'Unexpected import '+name);return dependencies[name];
 },module,module.exports);
 return {render:module.exports.default,imports};
}
for(const cozy of [true,false]){
 const layout=load('app/world/[worldId]/layout.tsx',cozy);
 const screen=await layout.render({params,children});
 assert.equal(screen.type,cozy?'cozy-screen':'legacy-shell');
 assert.equal(screen.props.worldId,params.worldId);
 assert.equal(layout.imports.includes('@/components/legacy-world-entry'),!cozy);
 assert.equal(layout.imports.includes('@/lib/world-data'),!cozy);
 assert.equal(layout.imports.includes('@/components/cozy/CozyWorldClient'),cozy);
 if(!cozy){assert.equal(screen.props.children,children);assert.equal(screen.props.initialPayload,payload);}
 for(const route of ['empire','intelligence']){
  const page=load(`app/world/[worldId]/${route}/page.tsx`,cozy);
  const content=await page.render({params});
  if(cozy){assert.equal(content,null);assert.deepEqual(page.imports,['react/jsx-runtime','@/lib/cozy/server']);}
  else{assert.equal(content.type,'legacy-'+route);assert.equal(content.props.params,params);if(route==='intelligence')assert.equal(content.props.profileHealth,'legacy-analytics');}
 }
}
{
 const imports=[];let factory;
 const lazyClient=()=>{};
 const code=ts.transpileModule(readFileSync(new URL('../components/legacy-world-entry.tsx',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
 }).outputText;
 const module={exports:{}};
 new Function('require','module','exports',code)(name=>{
  imports.push(name);
  if(name==='react/jsx-runtime')return {jsx};
  if(name==='next/dynamic')return loader=>{factory=loader;return lazyClient;};
  if(name==='./world-shell')return {WorldShell:'real-legacy-shell'};
  throw Error('Unexpected legacy entry dependency '+name);
 },module,module.exports);
 assert.equal(imports.includes('./world-shell'),false,'Legacy client must not be an eager runtime dependency');
 const props={worldId:params.worldId,initialPayload:payload,children};
 const rendered=module.exports.default(props);assert.equal(rendered.type,lazyClient);assert.deepEqual(rendered.props,props);
 assert.equal(await factory(),'real-legacy-shell','Legacy client loader preserves named WorldShell export');
}
console.log('PASS route isolation: cozy layout/entries avoid legacy clients and analytics; legacy entries preserve payload, params and children');
