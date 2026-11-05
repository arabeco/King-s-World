import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),P=loadCozyEngine('progression');
const START=1800000000000,DAY=86400000;
const world={id:'zero-model',name:'Novo reino',mode:'classic',status:'running',startsAt:START,influenceVersion:2};
const setup=(w=world,id='player')=>{const save=E.settleCozyState(E.createCozyState(w,id,id,START),E.createCozyShared(w),w,START);if(save.state.progression)delete save.state.progression.balance;return save;};
const view=(save,at=START,w=world)=>E.getCozyComputed(save.state,save.shared,w,at);
const act=(save,action,at=START,w=world)=>E.applyCozyAction(save.state,save.shared,w,action,at);
const settle=(save,at,w=world)=>E.settleCozyState(save.state,save.shared,w,at);
const addCity=(save,id='colony',q=save.state.cities[0].q+3)=>{
 const city={...structuredClone(save.state.cities[0]),id,q,capital:false,heroId:null};
 save.state.cities.push(city);save.shared.claims[`${city.q},${city.r}`]={playerId:save.state.playerId,cityId:id,name:id};return city;
};
// The existing cases below retain the historical v2 scoring contract. New weights have their own regression test.
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS',name);};
test('New realms start at zero in every area, before and after start, with all three royal profiles',()=>{
 for(const mode of ['classic','express'])for(const status of ['open','running']){
  const w={...world,mode,status,startsAt:status==='open'?null:START},save=setup(w);
  assert.deepEqual(Object.values(save.state.cities[0].sectors),[0,0,0,0,0]);
  assert.deepEqual(view(save,START,w).influence,{infrastructure:0,government:0,military:0,society:0,legacy:0,total:0});
  for(const profileId of ['builder','guardian','explorer']){
   const chosen=act(save,{type:'king_choose',profileId,nickname:'Meu Rei'},START,w);assert.equal(view(chosen,START,w).influence.total,0);
   assert.deepEqual(chosen.state.resources,save.state.resources);assert.deepEqual(chosen.state.army,save.state.army);
  }
 }
});
test('Older seasons keep their 182 starting points and are never inferred to use the new model',()=>{
 const w={...world,influenceVersion:1},save=setup(w);assert.equal(save.state.progression,undefined);assert.equal(view(save,START,w).influence.total,182);
 const reread=settle(save,START+1000,w);assert.equal(reread.state.progression,undefined);assert.equal(view(reread,START+1000,w).influence.total,182);
});
test('Infrastructure grows after completed work and still reaches 500',()=>{
 let save=setup(),city=save.state.cities[0];assert.equal(view(save).influenceDetails.cities[city.id],0);
 save=act(save,{type:'upgrade',cityId:city.id,sector:'administration'});assert.equal(view(save).influence.infrastructure,0);
 save=settle(save,save.state.orders[0].arrivesAt);assert(view(save).influence.infrastructure>0);
 for(const value of Object.keys(save.state.cities[0].sectors))save.state.cities[0].sectors[value]=10;
 for(let i=1;i<10;i++)addCity(save,`full-${i}`,city.q+i);
 assert.equal(view(save).influence.infrastructure,500);
 save.state.cities.pop();assert.equal(view(save).influence.infrastructure,450);
 const reclaimed=addCity(save,'reclaimed',city.q+9);assert.equal(view(save).influenceDetails.cities[reclaimed.id],50);assert.equal(view(save).influence.infrastructure,500);
 reclaimed.integrity=0;assert.equal(view(save).influence.infrastructure,500,'Integrity alone does not double-penalize built-level prestige; destroyed levels are scored separately');
});
test('Retained capital levels feed the city, Crown, total and player ranking',()=>{
 const {settleWorld}=loadCozyEngine('settlement');
 for(const [weight,expected] of [[null,5],[100,10],[150,15]]){
  const save=setup(),state=save.state,city=state.cities[0];
  for(const sector of Object.keys(city.sectors))city.sectors[sector]=1;
  state.progression.capitalLevels={...city.sectors}; // saved before zero-level foundations
  if(weight!==null)state.progression.balance={...P.newProgressionBalance(true),infrastructureWeights:[weight]};
  const players=[{playerId:state.playerId,state,influence:0}];
  const shared=settleWorld(players,save.shared,world,START);
  const c=E.getCozyComputed(players[0].state,shared,world,START);
  assert.equal(c.influenceDetails.cities[city.id],expected);
  assert.equal(c.influence.infrastructure,expected);
  assert.equal(c.influence.total,Object.entries(c.influence).filter(([key])=>key!=='total').reduce((sum,[,v])=>sum+v,0));
  assert.equal(players[0].influence,c.influence.total);
  city.sectors.economy=0;
  assert.equal(P.infrastructureContribution(state,city),Math.floor(4*(weight??50)/50));
 }
});
test('Government recognizes valid duties and finished research, without assignment farming',()=>{
 let save=setup();save.state.resources.gold=10000;const capital=save.state.cities[0];
 save=act(save,{type:'hire',role:'engineer'});const hero=save.state.heroes[0];assert.equal(view(save).influence.government,0);
 save=act(save,{type:'assign',heroId:hero.id,cityId:capital.id});assert.equal(view(save).influence.government,30);
 save=act(save,{type:'assign',heroId:hero.id,cityId:capital.id});assert.equal(view(save).influence.government,30);
 save=act(save,{type:'assign',heroId:hero.id,cityId:null});assert.equal(view(save).influence.government,0);
 save=act(save,{type:'research',research:'economy'});assert.equal(view(save).influence.government,0);
 save=settle(save,save.state.orders[0].arrivesAt);assert.equal(view(save).influence.government,10);
 assert.equal(view(save).influenceDetails.government.research,10);
});
test('Military measures available capacity above its gift and rebuilding cannot farm lifetime points',()=>{
 const save=setup();save.state.army.militia+=60;const grown=view(save).influence.military;assert.equal(grown,10);
 save.state.army.militia=0;assert.equal(view(save).influence.military,0);
 save.state.army.militia=85;assert.equal(view(save).influence.military,grown);
});
test('Council starts with no credit for initial trust and uses local rather than global confidence',()=>{
 let save=setup();save=settle(save,START+6*DAY);assert.equal(view(save).influence.society,0);
 const fresh=setup(),city=fresh.state.cities[0],decision=view(fresh).cityLife[city.id].decision;
 save=act(fresh,{type:'city_decision',cityId:city.id,decisionId:decision.id,optionId:'meal'});assert.equal(view(save).influence.society,6);
 save.state.satisfaction=100;save.state.cities[0].life.contentment=20;assert.equal(view(save).influence.society,0);
 save.state.cities[0].life.contentment=76;assert.equal(view(save).influence.society,6);
 assert.throws(()=>act(save,{type:'city_decision',cityId:city.id,decisionId:decision.id,optionId:'meal'}),/resolvida|mudou/);
});
test('Self-inflicted damage and exact recovery create no legitimacy or passive stability credit',()=>{
 const save=setup(),city=save.state.cities[0];
 for(let i=0;i<10;i++){city.life.contentment-=8;P.recordCityCare(save.state,city,i+1,-8,false);city.life.contentment+=8;P.recordCityCare(save.state,city,i+1,8,false);}
 assert.equal(save.state.progression.council.merit,0);assert.deepEqual(save.state.progression.council.careSince,{});
 P.recordStableAdministration(save.state,city,100);assert.equal(view(save).influence.society,0);
});
test('Decrees use each city trust even when the global indicator is full, and harmful choices earn no merit',()=>{
 let save=setup();save.state.satisfaction=100;save.state.cities[0].life.contentment=20;
 let decree=view(save).decree,care=decree.options.find(o=>o.id==='care');
 const delta=care.effects.localSatisfaction[save.state.cities[0].id];assert(delta>0);
 save=act(save,{type:'decree',decreeId:decree.id,optionId:'care'});assert.equal(save.state.cities[0].life.contentment,20+delta);
 assert.equal(save.state.progression.council.merit,0,'An unresolved crisis does not earn decree merit');
 save=setup();
 // Select a non-generous representative through the actual catalog, not an assumed identity.
 const catalog=loadCozyEngine('catalog');save.state.counselors[0]=catalog.COUNSELORS.find(c=>c.seat==='political'&&!['helena','ines'].includes(c.id)).id;
 decree=view(save).decree;assert(decree.options.find(o=>o.id==='invest').effects.satisfaction<0);
 save=act(save,{type:'decree',decreeId:decree.id,optionId:'invest'});assert.equal(save.state.progression.council.merit,0);
});
test('Society resists actual trust losses and the local choice preview matches its effect',()=>{
 let save=setup();save.state.cities[0].sectors.society=10;save=settle(save,START+2*DAY);
 const city=save.state.cities[0],decision=view(save,START+2*DAY).cityLife[city.id].decision;
 assert.equal(decision.options.find(o=>o.id==='levy').contentment,-6);
 save=act(save,{type:'city_decision',cityId:city.id,decisionId:decision.id,optionId:'levy'},START+2*DAY);
 assert.equal(save.state.cities[0].life.contentment,64);assert.equal(save.state.progression.council.merit,0);
});
test('Useful administration supports peaceful growth and offline civic progress matches daily settlement',()=>{
 let save=setup();const city=save.state.cities[0],decision=view(save).cityLife[city.id].decision;
 save=act(save,{type:'city_decision',cityId:city.id,decisionId:decision.id,optionId:'meal'});
 const batch=settle(save,START+10*DAY);let daily=structuredClone(save);for(let i=1;i<=10;i++)daily=settle(daily,START+i*DAY);
 assert.deepEqual(batch.state.progression,daily.state.progression);assert(view(batch).influence.society>6);
 assert.equal(settle(batch,START+10*DAY).state.progression.council.merit,batch.state.progression.council.merit);
});
test('Collection credit follows real volume rather than number of orders and never repeats on reload',()=>{
 const run=amounts=>{let save=setup();save.state.orders=amounts.map((amount,i)=>({id:`collect-${i}`,kind:'collect',createdAt:START,arrivesAt:START+1000,q:0,r:1,collectResource:'materials',collectAmount:amount}));return settle(save,START+1000);};
 const split=run([250,250]),whole=run([500]);assert.equal(view(split).influence.legacy,4);assert.equal(view(whole).influence.legacy,4);
 assert.equal(view(settle(split,START+2000)).influence.legacy,4);
});
test('Support is recognized only after use and each resolved request contributes once',()=>{
 let save=setup();save.shared.support.push({id:'support-once',allianceId:'alliance',requesterId:'recipient',waveDay:20,arrivesAt:START+19*DAY,requestedAt:START,supporterId:save.state.playerId,power:20,acceptedAt:START});
 save=settle(save,START+1000);assert.equal(view(save).influence.legacy,0);
 save.shared.support[0].resolvedAt=START+2000;
 save=settle(save,START+2000);assert.equal(view(save).influence.legacy,12);
 save=settle(save,START+3000);assert.equal(view(save).influence.legacy,12);
});
test('Only genuine survey advancement earns points, including another cell in the same completed area',()=>{
 let save=setup(),now=START;save.state.resources.supplies=100000;
 const tiles=()=>E.getCozyTiles(save.state,save.shared,world,now),tile=tiles().find(t=>t.clue.includes('brilho'));assert(tile);
 for(let i=0;i<3;i++){
  save=act(save,{type:'explore',q:tile.q,r:tile.r},now);now=save.state.orders[0].arrivesAt;save=settle(save,now);
 }
 assert.equal(view(save,now).influenceDetails.conquests.cooperation,12);
 const area=Object.values(save.shared.areas).find(a=>a.cells.includes(tile.id));assert(area);
 const other=tiles().find(t=>t.id!==tile.id&&t.clue.includes('brilho')&&area.cells.includes(t.id)&&!save.state.explored.includes(t.id));assert(other);
 save=act(save,{type:'explore',q:other.q,r:other.r},now);now=save.state.orders[0].arrivesAt;save=settle(save,now);
 assert.equal(view(save,now).influenceDetails.conquests.cooperation,12);
});
test('Losing a colony stops its stability clock without erasing its history or self-inflicted debt',()=>{
 const C=loadCozyEngine('city-crisis'),save=setup(),city=addCity(save),site=`${city.q},${city.r}`;
 save.state.progression.council.careSince[site]=1;save.state.progression.council.selfHarm[site]=8;
 save.state.progression.council.episodes.push('retained-history');
 assert(C.releaseCity(save.state,save.shared,city,START,'separation'));
 assert.equal(save.state.progression.council.careSince[site],undefined);
 assert.equal(save.state.progression.council.selfHarm[site],8);
 assert(save.state.progression.council.episodes.includes('retained-history'));
 P.recordStableAdministration(save.state,city,20);assert.equal(save.state.progression.council.merit,0);
});
test('Constructed wonders remain feats after a colony is lost and inherited wonders are not construction',()=>{
 let save=setup();save.state.resources.materials=100000;const colony=addCity(save);for(const sector of Object.keys(colony.sectors))colony.sectors[sector]=10;
 save=act(save,{type:'wonder',cityId:colony.id});assert.equal(view(save).influence.legacy,60);
 save.state.cities=save.state.cities.filter(c=>c.id!==colony.id);assert.equal(view(save).influence.legacy,60);
 const inherited=addCity(save,'inherited');inherited.wonder=true;assert.equal(view(save).influenceDetails.conquests.wonders,1);
 assert.throws(()=>act(save,{type:'wonder',cityId:inherited.id}),/desenvolvimento|Maravilha|maravilha/);
});
test('The zero model awards and preserves a 1500 seal without altering an older recorded season',()=>{
 let save=setup();for(const sector of Object.keys(save.state.cities[0].sectors))save.state.cities[0].sectors[sector]=10;
 for(let i=1;i<10;i++)addCity(save,`city-${i}`,save.state.cities[0].q+i);
 save.state.heroes=save.state.cities.map((city,i)=>{city.heroId=`hero-${i}`;return{id:city.heroId,name:'Herói',role:'engineer',cityId:city.id};});
 for(const research of Object.keys(save.state.research))save.state.research[research]=5;save.state.army.militia=10000;
 save=settle(save,START);assert.equal(save.state.portalCrossedAt,START);
 save.state.army.militia=0;save.state.cities=save.state.cities.slice(0,1);save=settle(save,START+1000);assert.equal(save.state.portalCrossedAt,START);
});
console.log(`PASS ${checks} zero-influence scenarios.`);
