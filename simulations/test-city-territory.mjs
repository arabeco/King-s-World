import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),T=loadCozyEngine('city-territory'),C=loadCozyEngine('city-crisis'),V=loadCozyEngine('map-visibility'),L=loadCozyEngine('landmarks');
const START=1800000000000,world={id:'city-domains',name:'City domains',mode:'express',economyVersion:2,influenceVersion:2,status:'running',startsAt:START};
const capitalCells=['-32,11','-31,12'],colonyCells=['-27,12','-26,11','-25,12','-26,13'];
function setup(){
 let s=E.createCozyState(world,'domain-owner','Owner',START),shared=E.createCozyShared(world);const capital=s.cities[0];capital.q=-32;capital.r=12;
 const colony={...structuredClone(capital),id:'colony',name:'Bairro do Rio',q:-26,r:12,capital:false,cityClass:'agrarian',integrity:35,heroId:'hero',renamedBy:[s.playerId]};s.cities.push(colony);s.heroes=[{id:'hero',name:'Hero',role:'general',cityId:colony.id}];s.explored=[`${capital.q},${capital.r}`,'-26,12'];s.resources={gold:100000,materials:100000,supplies:100000};s.army.militia=100000;
 shared.claims={};for(const city of s.cities)shared.claims[`${city.q},${city.r}`]={playerId:s.playerId,cityId:city.id,name:city.name};shared.territories={};for(const id of [...capitalCells,...colonyCells])shared.territories[id]=s.playerId;
 shared.territories['-25,11']='ally';shared.territoryCities={'-25,11':{playerId:'ally',cityId:'ally-city'}};
 shared.areas={reserve:{id:'reserve',resource:'materials',cells:['-26,11','-26,12'],reserve:{id:'reserve',resource:'materials',capacity:100,remaining:37,surveys:3,contributors:[s.playerId]},owners:[s.playerId],ownerCities:{[s.playerId]:colony.id},annexedAt:START}};
 T.bindCityTerritories(s,shared);return {s,shared,capital,colony};
}
{
 const {s,shared,colony,capital}=setup();const archived=structuredClone(shared);delete archived.territoryCities;const archiveCopy=structuredClone(archived);assert.equal(T.cityTerritoryCells(s,archived,colony.id).length,5);assert.deepEqual(archived,archiveCopy,'Reading archived land does not migrate its snapshot');assert.equal(T.cityTerritoryCells(s,shared,colony.id).length,5);assert.equal(T.cityTerritoryCells(s,shared,capital.id).length,3);
 const links=structuredClone(shared.territoryCities);s.cities.push({...structuredClone(colony),id:'new-nearer',q:-27,r:12});T.bindCityTerritories(s,shared);assert.deepEqual(shared.territoryCities,links,'New cities never steal existing attribution');
 const reversed={...structuredClone(s),cities:[...s.cities].reverse()};const a=structuredClone(shared),b=structuredClone(shared);delete a.territoryCities;delete b.territoryCities;T.bindCityTerritories(s,a);T.bindCityTerritories(reversed,b);assert.deepEqual(a.territoryCities,b.territoryCities,'Legacy assignment is independent of city array order');
}
for(const reason of ['separation','horde']){
 const {s,shared,colony,capital}=setup();const before=s.resources.materials,explored=s.explored.length;
 s.orders=[{id:'active',kind:'upgrade',cityId:colony.id,sector:'economy',arrivesAt:START+10000,planned:{startsAt:START,expectedLevel:0,cost:{materials:90},started:true}},{id:'queued',kind:'upgrade',cityId:colony.id,sector:'economy',arrivesAt:START+20000,planned:{startsAt:START+10000,expectedLevel:1,cost:{materials:70},started:false}}];
 assert(C.releaseCity(s,shared,colony,START,reason));assert.equal(s.cities.length,1);assert.equal(s.heroes[0].cityId,null);assert.equal(s.orders.length,0);assert.equal(s.resources.materials,before+70);assert.equal(s.explored.length,explored);
 for(const id of colonyCells){assert.equal(shared.territories[id],undefined);assert(V.knownMapCells(s,shared).has(id),'Losing ownership never forgets already known land');}
 for(const id of capitalCells)assert.equal(shared.territories[id],s.playerId);assert.equal(shared.territories['-25,11'],'ally');assert.equal(shared.territoryCities['-25,11'].cityId,'ally-city');
 assert.equal(shared.areas.reserve.reserve.remaining,37);assert.equal(shared.areas.reserve.reserve.surveys,3);assert.deepEqual(shared.areas.reserve.owners,[]);assert.equal(shared.independentCities['-26,12'].territory.length,5);
 const after=structuredClone({s,shared});assert.equal(C.releaseCity(s,shared,colony,START+1,reason),false);assert.deepEqual({s,shared},after,'Repeated loss never refunds twice');assert.equal(C.releaseCity(s,shared,capital,START,reason),false,'Cozy capital/last city remains protected');
 // Someone takes two pieces before reconquest; neither is overwritten.
 shared.territories['-27,12']='other';shared.territoryCities['-27,12']={playerId:'other',cityId:'other-city'};shared.claims['-25,12']={playerId:'other',cityId:'foreign-city',name:'Foreign'};
 const monument=L.ALL_SANCTUARIES[0];shared.independentCities['-26,12'].territory.push(`${monument.q},${monument.r}`);
 const sent=E.applyCozyAction(s,shared,world,{type:reason==='horde'?'attack':'annex',conquest:true,q:-26,r:12,heroId:'hero'},START+1);const beforeSettle=structuredClone(sent);const at=sent.state.orders.find(o=>o.kind==='attack').arrivesAt;
 const arrived=E.settleCozyState(sent.state,sent.shared,world,at);assert.deepEqual(sent,beforeSettle,'Settlement leaves input immutable');const restored=arrived.state.cities.find(c=>c.q===-26&&c.r===12);assert(restored);assert.equal(restored.name,colony.name);assert.equal(restored.cityClass,colony.cityClass);assert.deepEqual(restored.renamedBy,colony.renamedBy);
 assert.equal(arrived.shared.territories['-27,12'],'other');assert.equal(arrived.shared.claims['-25,12'].playerId,'other');assert.equal(arrived.shared.territories[`${monument.q},${monument.r}`],undefined);
 assert.equal(arrived.shared.territories['-26,11'],s.playerId);assert.equal(arrived.shared.territoryCities['-26,11'].cityId,restored.id);assert.equal(arrived.shared.areas.reserve.reserve.remaining,37);assert.deepEqual(arrived.shared.areas.reserve.owners,[s.playerId]);
 assert.deepEqual(E.settleCozyState(arrived.state,arrived.shared,world,at),arrived,'Arrival/reconquest is idempotent');
}
{
 const {s,shared,colony}=setup();shared.areas.reserve.owners.push('ally');shared.areas.reserve.ownerCities.ally='ally-city';assert(C.releaseCity(s,shared,colony,START,'horde'));assert.deepEqual(shared.areas.reserve.owners,['ally']);assert.equal(shared.areas.reserve.ownerCities.ally,'ally-city');assert.equal(shared.areas.reserve.reserve.remaining,37);
}
{
 const {s,shared,colony}=setup();assert(C.releaseCity(s,shared,colony,START,'separation'));shared.areas.reserve.owners=['other'];shared.areas.reserve.ownerCities={other:'other-city'};
 const city={...structuredClone(colony),id:'restored'};s.cities.push(city);T.restoreCityTerritory(s,shared,city,shared.independentCities['-26,12']);assert.equal(shared.territories['-26,11'],undefined,'A foreign reserve is protected even without a colored land cell');assert.deepEqual(shared.areas.reserve.owners,['other']);assert.equal(shared.areas.reserve.reserve.remaining,37);
}
{
 let {s,shared}=setup();s.explored=E.getCozyTiles(s,shared,world,START).map(t=>t.id);let save={state:s,shared},now=START;const tile=E.getCozyTiles(s,shared,world,now).find(t=>(t.kind==='gold'||t.kind==='materials')&&!t.ownerId);assert(tile);
 for(let i=0;i<3;i++){save=E.applyCozyAction(save.state,save.shared,world,{type:'explore',q:tile.q,r:tile.r},now);now=save.state.orders.find(o=>o.kind==='explore').arrivesAt;save=E.settleCozyState(save.state,save.shared,world,now);}
 const city=T.nearestTerritoryCity(save.state,tile);save=E.applyCozyAction(save.state,save.shared,world,{type:'area_annex',q:tile.q,r:tile.r},now);const areas=Object.values(save.shared.areas).filter(a=>a.owners.includes(s.playerId)&&a.cells.includes(tile.id));assert(areas.some(a=>a.ownerCities[s.playerId]===city.id));assert(Object.values(save.shared.territoryCities).some(link=>link.playerId===s.playerId&&link.cityId===city.id));
}
console.log('PASS city domains: stable attribution, both loss causes, exact regional loss, foreign land protection, resource stock/access, known fog memory without survey credit, queue refunds once, Cozy protection and real annexation/restoration');
