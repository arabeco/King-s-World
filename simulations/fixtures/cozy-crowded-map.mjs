// Presentation stress fixture only. Never submitted to the game API.
export function crowdedMap(source){
 const data=structuredClone(source),me=data.state.playerId,now=Date.now();
 const ids=Array.from({length:20},(_,i)=>i?`stress-player-${i}`:me);
 const centers=ids.map((id,i)=>({q:-24+(i%5)*10,r:-18+Math.floor(i/5)*10}));
 data.players=ids.map((playerId,i)=>({playerId,playerName:`Reino ${String(i+1).padStart(2,'0')}`,allianceId:`league-${Math.floor(i/5)}`,influence:1500,cities:10,portalCrossedAt:null,finalized:false}));
 data.state.allianceId='league-0';
 const template=data.tiles[0],cityTemplate=data.state.cities[0];
 const offsets=[[0,0],[1,0],[-2,0],[0,2],[2,-2],[-2,2],[5,0],[0,-3],[-4,0],[1,3]];
 const cityAt=new Map();
 data.state.cities=[];
 centers.forEach((c,i)=>offsets.forEach(([q,r],j)=>{
  const city={...structuredClone(cityTemplate),id:`stress-city-${i}-${j}`,name:`Cidade ${i+1}.${j+1}`,q:c.q+q,r:c.r+r,capital:j===0,sectors:Object.fromEntries(Object.keys(cityTemplate.sectors).map(k=>[k,10]))};
  cityAt.set(`${city.q},${city.r}`,{city,i});if(i===0)data.state.cities.push(city);
 }));
 const distance=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
 data.tiles=[];
 for(let q=-40;q<=40;q++)for(let r=-40;r<=40;r++){
  const key=`${q},${r}`,at={q,r},i=centers.reduce((best,c,index)=>distance(at,c)<distance(at,centers[best])?index:best,0),entry=cityAt.get(key);
  const owner=distance(at,{q:32,r:30})<=2?ids[1]:distance(at,centers[i])<=6?ids[i]:null;
  data.tiles.push({...structuredClone(template),id:key,q,r,kind:entry?'city':'plain',name:entry?.city.name??'Terreno',revealed:true,ownerId:entry?ids[entry.i]:null,territoryOwnerId:owner,cityId:entry?.city.id??null,landmarkId:null,area:null,deposit:null,power:null,combat:null,attackable:false,clue:'',distance:distance(at,centers[0])});
 }
 const area=data.tiles.filter(t=>t.q>=-21&&t.q<=-18&&t.r>=-15&&t.r<=-12&&!t.ownerId),cells=area.map(t=>`${t.q},${t.r}`);
 for(const t of area){t.kind='gold';t.name='Reserva compartilhada';t.deposit={id:'stress-reserve',resource:'gold',remaining:12000,capacity:12000,surveys:3,contributors:[ids[0],ids[1]]};t.area={id:'stress-shared',cells,owners:[ids[0],ids[1]],canCollect:true,canAnnex:false};}
 data.state.orders=Array.from({length:24},(_,i)=>({id:`stress-order-${i}`,kind:['explore','attack','collect'][i%3],q:-24+(i%6)*2,r:-18+Math.floor(i/6)*2,createdAt:now-60000*(i+1),arrivesAt:now+600000,materials:0,supplies:0}));
 return data;
}
