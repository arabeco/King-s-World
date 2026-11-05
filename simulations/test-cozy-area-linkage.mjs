import assert from 'node:assert/strict';
import {loadCozyEngine} from './lib/load-cozy-engine.mjs';
const E=loadCozyEngine(),P=loadCozyEngine('progression'),now=1800000000000;
for(const mode of ['classic','express']){
 const world={id:'linked-'+mode,name:'Linked areas',mode,economyVersion:2,status:'running',startsAt:now,influenceVersion:2};
 const state=E.createCozyState(world,'p','p',now),shared=E.createCozyShared(world),city=state.cities[0];
 const view=()=>E.getCozyComputed(state,shared,world,now);
 const base=view();
 city.sectors.defense=10;state.army.militia=200;
 assert.equal(view().fortificationPower,180);
 const army=view().armyPower,production=view().productionPerDay.materials;
 for(let level=0;level<=5;level++){
  for(const id of Object.keys(state.research))state.research[id]=level;
  const c=view();
  assert.equal(c.influence.government,level*40);
  assert.equal(c.armyPower,Math.floor(army*(1+level*.2)));
  assert.equal(c.fortificationPower,Math.floor(180*(1+level*.15)));
  assert.ok(Math.abs(c.productionPerDay.materials-production*(1+level*.08))<1e-7);
  assert.equal(c.influenceDetails.military.capacity,c.armyPower+c.fortificationPower);
 }
 state.heroes=[{id:'general',role:'general',name:'General',cityId:null}];
 const unassigned=view();city.heroId='general';state.heroes[0].cityId=city.id;
 assert.equal(view().influence.government,unassigned.influence.government+30);
 assert.ok(view().armyPower>unassigned.armyPower);
 city.integrity=50;assert.equal(view().fortificationPower,Math.floor(90*1.75));
 state.hordesWon=6;const wins=view().influence.military;state.army.militia=0;city.integrity=0;
 assert.ok(view().influence.military<wins);assert.equal(view().influence.military,200);
 state.progression.council.merit=200;city.life={contentment:70,lastDecisionDay:null};assert.equal(view().influence.society,200);
 city.life.contentment=35;assert.equal(view().influence.society,0);
 city.life.contentment=70;assert.equal(view().influence.society,200);
 state.quests=[E.QUESTS[0].id];state.progression.feats.wonders=['one'];state.progression.feats.supports=['used-support'];
 const c=view();assert.equal(c.influence.legacy,E.QUESTS[0].points+P.PROGRESSION.wonder+P.PROGRESSION.support);
 assert.equal(c.influence.total,Object.entries(c.influence).filter(([key])=>key!=='total').reduce((n,[,v])=>n+v,0));
 assert.equal(base.influence.total,0);
 console.log('PASS',mode,'research levels, assigned heroes, military damage/victories, council stability, conquests and total');
}
