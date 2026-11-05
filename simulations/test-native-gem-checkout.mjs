import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const modules={};for(const name of ['play-subscription','play-gems']){const m={exports:{}};new Function('module','exports',compile(await readFile(new URL(`../supabase/functions/_shared/${name}.ts`,import.meta.url),'utf8')))(m,m.exports);modules[name]=m.exports;}
const authId='00000000-0000-4000-8000-000000000001';let enabled=false,native=true,authenticated=true,options,queries=[];
const config={get GEM_SALES_ENABLED(){return enabled},PLAY_PREMIUM_PRODUCT_ID:'premium_monthly',PLAY_PREMIUM_BASE_PLAN_ID:'monthly'};
const sdk={isBillingSupported:async()=>({isBillingSupported:true}),getProducts:async opts=>{queries.push(opts);return {products:[{identifier:'gems_50',title:'50 Gemas',description:'Pacote',priceString:'R$ 9,99',currencyCode:'BRL'},{identifier:'unknown'}]}},purchaseProduct:async opts=>{options=opts;return {purchaseToken:'fixture',productIdentifier:opts.productIdentifier}},getPurchases:async()=>({purchases:[{productIdentifier:'gems_50'},{productIdentifier:'premium_monthly'},{productIdentifier:'unknown'}]})};
const m={exports:{}};new Function('require','module','exports',compile(await readFile(new URL('../lib/native-purchases-client.ts',import.meta.url),'utf8')))(name=>{
 if(name==='@capacitor/core')return {Capacitor:{isNativePlatform:()=>native,getPlatform:()=>native?'android':'web'}};
 if(name==='@capgo/native-purchases')return {NativePurchases:sdk,PURCHASE_TYPE:{INAPP:'inapp',SUBS:'subs'}};
 if(name.includes('premium-config'))return config;
 if(name.includes('play-gems'))return modules['play-gems'];
 if(name.includes('play-subscription'))return modules['play-subscription'];
 if(name.includes('supabase-browser'))return {getSupabaseBrowserClient:()=>({auth:{getUser:async()=>({data:{user:authenticated?{id:authId}:null},error:null})}})};
 throw Error(name);
},m,m.exports);
const C=m.exports;
await assert.rejects(()=>C.purchaseGemPack('gems_50'),/preparação/);assert.equal(options,undefined);
enabled=true;await assert.rejects(()=>C.purchaseGemPack('gems_999'),/inválido/);assert.equal(options,undefined);
authenticated=false;await assert.rejects(()=>C.purchaseGemPack('gems_50'),/Entre/);assert.equal(options,undefined);
authenticated=true;await C.purchaseGemPack('gems_50');assert.equal(options.productType,'inapp');assert.equal(options.quantity,1);assert.equal(options.isConsumable,false);assert.equal(options.autoAcknowledgePurchases,false);assert.equal(options.appAccountToken,await modules['play-subscription'].playAccountId(authId));
const offers=await C.loadGemProductOffers();assert.equal(offers.length,1);assert.equal(offers[0].priceString,'R$ 9,99');assert.equal(offers[0].currencyCode,'BRL');assert.equal(queries[0].productType,'inapp');assert.deepEqual(queries[0].productIdentifiers,['gems_50','gems_100','gems_250','gems_500']);
assert.deepEqual(await C.pendingGemTransactions(),[{productIdentifier:'gems_50'}]);
native=false;options=undefined;assert.deepEqual(await C.loadGemProductOffers(),[]);assert.deepEqual(await C.pendingGemTransactions(),[]);await assert.rejects(()=>C.purchaseGemPack('gems_50'),/Android/);assert.equal(options,undefined);
console.log('PASS native gem checkout: disabled by default, Android/auth/product guards, one unit, exact auth account hash, server-only consume/ack, localized store price and unconsumed recovery; mocked SDK, no purchase');
