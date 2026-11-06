"use client";
import {useEffect,useId,useMemo,useRef,useState} from 'react';
import type {CozyCoord,CozyPayload,CozyTile} from '@/lib/cozy/types';
import {MAP_GROUND_Y,borderPath,cellPath,mapCoord,mapPoint,roundMapCoord,resourceRegions} from '@/lib/cozy/map-presentation';
import {mapIdentity} from '@/lib/cozy/map-identity';
import CozyMapEmblem from './CozyMapEmblem';
import CozyMapTerrain from './CozyMapTerrain';
import {MAP_MAX_ZOOM} from '@/lib/cozy/map-zoom';
import {Grid3X3, Castle} from 'lucide-react';
import CozyMapArt from './CozyMapArt';
import {journeyOrigin} from '@/lib/cozy/map-navigation';
import {explorationPath,explorationCorridor} from '@/lib/cozy/exploration-route';
import {getCityAppearance} from '@/lib/cozy/catalog';
import {ALL_SANCTUARIES} from '@/lib/cozy/landmarks';
import styles from './cozy-map-scene.module.css';

const worldHalfHeight = 1663 * MAP_GROUND_Y;


type Props={data:CozyPayload;center:CozyCoord;onCenter:(c:CozyCoord)=>void;onSelect:(t:CozyTile)=>void;onUnknown:(c:CozyCoord)=>void;onChoose:(tiles:CozyTile[])=>void;onEmpires:()=>void;selectedId:string|null;unknownCoord:CozyCoord|null;selectionOpen:boolean;scale:number;onScaleChange:(scale:number)=>void;now:number};
export default function CozyMapScene({data,center,onCenter,onSelect,onUnknown,onChoose,onEmpires,selectedId,unknownCoord,selectionOpen,scale,onScaleChange:setScale,now}:Props){
 const diagonal=data.computed.worldDiagonalLimit??40;
 const edge=40.5,cut=diagonal-40;
 const worldOutline='M'+[[-cut,-edge],[edge,-edge],[edge,cut],[cut,edge],[-edge,edge],[-edge,-cut]].map(([q,r])=>{const p=mapPoint({q,r});return p.x+','+p.y;}).join(' L')+'Z';
 const worldWidth=96*(edge+cut/2);
 const row=mapPoint({q:0,r:1}).y;
 const root=useRef<HTMLDivElement>(null),svg=useRef<SVGSVGElement>(null);
 const [size,setSize]=useState({w:390,h:520}),[offset,setOffset]=useState({x:0,y:0});
 const [grid,setGrid]=useState(true);
 useEffect(()=>{try{setGrid(localStorage.getItem('kw.hex-grid')!=='off');}catch{}},[]);
 function toggleGrid(){const next=!grid;setGrid(next);try{localStorage.setItem('kw.hex-grid',next?'on':'off');}catch{}}
 const pointers=useRef(new Map<number,{x:number;y:number}>()),gesture=useRef(false),start=useRef({x:0,y:0}),scaleRef=useRef(scale),offsetRef=useRef(offset);
 scaleRef.current=scale;offsetRef.current=offset;
 const uid=useId().replace(/:/g,''),point=mapPoint(center);
 // Leave room around the world and its labels, including the controls above and below it.
 const minimum=Math.min(Math.max(100,size.w-42)/worldWidth,Math.max(100,size.h-150)/(2*worldHalfHeight));
 const clamp=(value:number)=>Math.max(minimum,Math.min(MAP_MAX_ZOOM,value));
 useEffect(()=>{if(scale<minimum)setScale(minimum);},[minimum,scale,setScale]);
 // In the full-world view, move the artwork below the scale selector.
 const camera={x:point.x+offset.x,y:point.y+offset.y+(selectionOpen?Math.min(110,size.h*.22)/scale:0)-(scale<=minimum+.001?30/scale:0)},vw=size.w/scale,vh=size.h/scale;
 useEffect(()=>{setOffset({x:0,y:0});},[center]);
 useEffect(()=>{const el=root.current;if(!el)return;const observer=new ResizeObserver(([entry])=>setSize({w:entry.contentRect.width,h:entry.contentRect.height}));observer.observe(el);return()=>observer.disconnect();},[]);
 const zoomAt=(factor:number,x=size.w/2,y=size.h/2)=>{
  const old=scaleRef.current,next=clamp(old*factor),off=offsetRef.current;
  if(next<=minimum+.001){offsetRef.current={x:0,y:0};setOffset({x:0,y:0});onCenter({q:0,r:0});setScale(minimum);scaleRef.current=minimum;return;}
  const moved={x:off.x+(x-size.w/2)*(1/old-1/next),y:off.y+(y-size.h/2)*(1/old-1/next)};offsetRef.current=moved;setOffset(moved);setScale(next);scaleRef.current=next;
 };
 const regions=useMemo(()=>resourceRegions(data.tiles),[data.tiles]);
 const regionAnchors=useMemo(()=>new Set(regions.map(region=>{const points=region.cells.map(mapPoint),middle={x:points.reduce((sum,p)=>sum+p.x,0)/points.length,y:points.reduce((sum,p)=>sum+p.y,0)/points.length};return [...region.cells].sort((a,b)=>{const p=mapPoint(a),q=mapPoint(b);return Math.hypot(p.x-middle.x,p.y-middle.y)-Math.hypot(q.x-middle.x,q.y-middle.y);})[0].id;})),[regions]);
 const owners=useMemo(()=>Array.from(new Set(data.tiles.filter(t=>t.revealed).flatMap(t=>(t.ownerId??t.territoryOwnerId)?[t.ownerId??t.territoryOwnerId!]:[]))).sort(),[data.tiles]);
 const territories=useMemo(()=>owners.map(id=>{
  const cells=data.tiles.filter(t=>t.revealed&&(t.ownerId??t.territoryOwnerId)===id);
  const mid=cells.reduce((m,t)=>({x:m.x+mapPoint(t).x/cells.length,y:m.y+mapPoint(t).y/cells.length}),{x:0,y:0});
  const anchor=cells.reduce((a,b)=>Math.hypot(mapPoint(a).x-mid.x,mapPoint(a).y-mid.y)<Math.hypot(mapPoint(b).x-mid.x,mapPoint(b).y-mid.y)?a:b);
  return {id,path:borderPath(cells),anchor:{...anchor,ownerId:id}};
 }),[data.tiles,owners]);
 const ownerColor=(id:string)=>mapIdentity(id).color;
 const near=(t:CozyCoord,pad=80)=>{const p=mapPoint(t);return Math.abs(p.x-camera.x)<vw/2+pad&&Math.abs(p.y-camera.y)<vh/2+pad;};
 const visible=data.tiles.filter(t=>near(t));
 const selected=data.tiles.find(t=>t.id===selectedId)??(unknownCoord?{...unknownCoord,id:`${unknownCoord.q},${unknownCoord.r}`}:undefined);
 const routeTarget=unknownCoord??data.tiles.find(t=>t.id===selectedId&&!t.revealed&&!t.landmarkId);
 const preview=useMemo(()=>routeTarget?explorationPath(data.state,routeTarget):[],[data.state,routeTarget?.q,routeTarget?.r]);
 const corridor=useMemo(()=>explorationCorridor(preview,diagonal).map(id=>{const [q,r]=id.split(',').map(Number);return {q,r};}),[preview,diagonal]);
 const knownTowers=new Set(data.tiles.filter(t=>t.revealed&&t.landmarkId).map(t=>t.landmarkId));
 const towers=ALL_SANCTUARIES.filter(s=>knownTowers.has(s.id));
 // A silhouette is only a navigation hint; it grants no survey or tower actions.
 const distantSignals=useMemo(()=>{
  const unseen=ALL_SANCTUARIES.filter(t=>t.id!=='sanctuary-central'&&!data.tiles.some(cell=>cell.landmarkId===t.id&&cell.revealed));
  const distance=(t:CozyCoord)=>data.state.cities.reduce((best,c)=>Math.min(best,Math.max(Math.abs(c.q-t.q),Math.abs(c.r-t.r),Math.abs(c.q+c.r-t.q-t.r))),Infinity);
  const nearest=unseen.sort((a,b)=>distance(a)-distance(b))[0];
  return ALL_SANCTUARIES.filter(t=>t.id==='sanctuary-central'||t.id===nearest?.id);
 },[data.tiles,data.state.cities]);
 const centered=roundMapCoord(mapCoord(camera)),cq=centered.q,cr=centered.r;
 const centeredTile=data.tiles.find(t=>t.q===cq&&t.r===cr);
 const finish=()=>{
  if(gesture.current){const c=mapCoord({x:point.x+offsetRef.current.x,y:point.y+offsetRef.current.y});onCenter({q:Math.max(-40,Math.min(40,c.q)),r:Math.max(-40,Math.min(40,c.r))});setOffset({x:0,y:0});}
 };
 const reset=()=>{setOffset({x:0,y:0});setScale(1);const capital=data.state.cities.find(c=>c.capital)??data.state.cities[0];if(capital)onCenter(capital);};
 const journeys=data.state.orders.filter(o=>o.q!==undefined&&o.r!==undefined);
 return <div className={styles.scene} ref={root} data-map-scale={scale}>
  <div className={styles.scales} aria-label="Escala do mapa">
   <button onClick={()=>{setScale(minimum);onCenter({q:0,r:0});setOffset({x:0,y:0});}} aria-pressed={scale<.2}>Mundo</button>
   <button onClick={()=>{setScale(.55);setOffset({x:0,y:0});}} aria-pressed={scale>=.2&&scale<.85}>Região</button>
   <button onClick={()=>setScale(1)} aria-pressed={scale>=.85}>Detalhe</button>
   <button onClick={onEmpires}>Reinos</button>
  </div>
  <div className={styles.surface} role="grid" aria-label="Territórios próximos" tabIndex={0}
   onKeyDown={e=>{const d:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(d[e.key]){e.preventDefault();onCenter({q:Math.max(-40,Math.min(40,cq+d[e.key][0])),r:Math.max(-40,Math.min(40,cr+d[e.key][1]))});}else if((e.key==='Enter'||e.key===' ')&&centeredTile){e.preventDefault();onSelect(centeredTile);}}}
   onPointerDown={e=>{if(e.button!==0&&e.pointerType==='mouse')return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.current.size===1){gesture.current=false;start.current={x:e.clientX,y:e.clientY};}else{gesture.current=true;for(const id of pointers.current.keys())e.currentTarget.setPointerCapture(id);}}}
   onPointerMove={e=>{const old=pointers.current.get(e.pointerId);if(!old)return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.current.size>1){gesture.current=true;return;}else if(Math.hypot(e.clientX-start.current.x,e.clientY-start.current.y)>6||gesture.current){gesture.current=true;e.currentTarget.setPointerCapture(e.pointerId);const off=offsetRef.current;const next={x:Math.max(-2880-point.x,Math.min(2880-point.x,off.x-(e.clientX-old.x)/scaleRef.current)),y:Math.max(-1680*MAP_GROUND_Y-point.y,Math.min(1680*MAP_GROUND_Y-point.y,off.y-(e.clientY-old.y)/scaleRef.current))};offsetRef.current=next;setOffset(next);}}}
   onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);pointers.current.delete(e.pointerId);if(!pointers.current.size)finish();}}
   onPointerCancel={()=>{pointers.current.clear();gesture.current=true;finish();}}
   onClickCapture={e=>{
    if(e.detail===0)return;
    e.preventDefault();e.stopPropagation();
    if(gesture.current){gesture.current=false;return;}
    const rect=e.currentTarget.getBoundingClientRect(),worldPoint={x:camera.x+(e.clientX-rect.left-rect.width/2)/scale,y:camera.y+(e.clientY-rect.top-rect.height/2)/scale};
    const cities=visible.filter(t=>t.revealed&&t.kind==='city'&&Math.hypot(mapPoint(t).x-worldPoint.x,mapPoint(t).y-worldPoint.y)*scale<=26).sort((a,b)=>Math.hypot(mapPoint(a).x-worldPoint.x,mapPoint(a).y-worldPoint.y)-Math.hypot(mapPoint(b).x-worldPoint.x,mapPoint(b).y-worldPoint.y));
    if(cities.length>1){onChoose(cities);return;}
    if(cities.length===1){onSelect(cities[0]);return;}
    const coord=roundMapCoord(mapCoord(worldPoint));
    const hit=visible.find(t=>t.q===coord.q&&t.r===coord.r);
    if(hit)onSelect(hit);
    else if(Math.abs(coord.q)<=40&&Math.abs(coord.r)<=40&&Math.abs(coord.q+coord.r)<=diagonal)onUnknown(coord);
   }}>
   <svg ref={svg} className={styles.map} viewBox={`${camera.x-vw/2} ${camera.y-vh/2} ${vw} ${vh}`} aria-label="Mapa dos reinos">
    <defs>
     <radialGradient id={`${uid}cloud`}><stop stopColor="#bac6bf" stopOpacity=".13"/><stop offset="1" stopColor="#bac6bf" stopOpacity="0"/></radialGradient>
     <pattern id={`${uid}fogClouds`} width="560" height="360" patternUnits="userSpaceOnUse"><ellipse cx="130" cy="100" rx="120" ry="80" fill={`url(#${uid}cloud)`}/><ellipse cx="420" cy="260" rx="130" ry="85" fill={`url(#${uid}cloud)`}/></pattern>
     <radialGradient id={`${uid}mist`}><stop stopColor="#4a5357"/><stop offset=".6" stopColor="#38454b"/><stop offset="1" stopColor="#29373e"/></radialGradient>
     <pattern id={`${uid}mesh`} width={48} height={2*row} patternUnits="userSpaceOnUse">
       <path d={`M0 ${2*row/3}l24 ${-row/3}v${-2*row/3} M24 ${row/3}l24 ${row/3}v${2*row/3} M0 ${2*row/3}v${2*row/3}l24 ${row/3}l24 ${-row/3} M24 ${5*row/3}V${2*row}`} fill="none" stroke="#f4f2e8" strokeWidth={.7/scale}/>
     </pattern>
     <clipPath id={`${uid}world`}><path d={worldOutline}/></clipPath>
     <CozyMapTerrain uid={uid}/>
     <pattern id={`${uid}forest`} width="12" height="12" viewBox="0 0 38 36" patternUnits="userSpaceOnUse"><path d="M19 4l10 20H9Z" fill="#2d5845"/><path d="M19 4v20H9Z" fill="#52775b"/><path d="M19 22v7" stroke="#78765a"/></pattern>
     <pattern id={`${uid}gold`} width="44" height="39" patternUnits="userSpaceOnUse"><path d="M8 24l9-15 12 2 9 14-15 7Z" fill="#867f65"/><path d="M8 24l9-15 12 2-8 14Z" fill="#bab08b"/><path d="M29 11l-8 14 2 7" fill="none" stroke="#e2bf70" strokeWidth="1.5"/></pattern>
    </defs>
    <path data-world-outline d={worldOutline} fill={`url(#${uid}mist)`} stroke="#c4ba9c" strokeWidth={1.2/scale} />
    <path d={worldOutline} fill={`url(#${uid}fogClouds)`} opacity={scale<.3?.12:.55} pointerEvents="none"/>
    <defs><clipPath id={`${uid}known`}>{visible.filter(t=>t.revealed).map(t=><path key={t.id} d={cellPath(t)}/>)}</clipPath></defs>
    <defs><clipPath id={`${uid}sight`}>{visible.filter(t=>t.terrainVisible||t.revealed).map(t=><path key={t.id} data-visible-ground={t.id} d={cellPath(t)}/>)}</clipPath></defs>
    <g data-explored-terrain clipPath={`url(#${uid}sight)`} pointerEvents="none" aria-hidden="true">
     <rect x="-2904" y={-1691*MAP_GROUND_Y} width="5808" height={3382*MAP_GROUND_Y} fill={`url(#${uid}valley)`}/>
    </g>
    <g clipPath={`url(#${uid}known)`} opacity=".32" aria-hidden="true">{regions.map(region=><g key={region.id}>{region.cells.filter(t=>near(t,140)).map(t=>{const p=mapPoint(t);return <circle key={t.id} cx={p.x} cy={p.y} r="65" fill={region.kind==='gold'?'#bda15c':'#40705b'}/>;})}</g>)}</g>
    {visible.map(t=><path key={`land-${t.id}`} d={cellPath(t)} fill={!t.revealed?'transparent':(t.ownerId??t.territoryOwnerId)?ownerColor((t.ownerId??t.territoryOwnerId)!)+"66":'#ffffff29'} stroke="none"/>)}
    <path data-hex-grid d={worldOutline} fill={grid?`url(#${uid}mesh)`:'none'} opacity={Math.max(.075,Math.min(.30,scale*.36))} pointerEvents="none"/>
    {regions.map(region=>{
     const footprint=region.footprint??region.cells;if(!footprint.some(t=>near(t)))return null;
     return <g key={`area-${region.id}`} data-resource-region={region.id} aria-hidden="true">
      <g clipPath={`url(#${uid}known)`}>{footprint.filter(t=>near(t)).map(t=><path key={`${t.q},${t.r}`} d={cellPath(t)} fill={`url(#${uid}${region.kind==='gold'?'gold':'forest'})`} opacity=".7"/>)}</g>
      <path clipPath={`url(#${uid}known)`} d={borderPath(footprint)} fill="none" stroke={region.kind==='gold'?'#e2c47d':'#91c3af'} strokeDasharray={`${3/scale} ${4/scale}`} strokeWidth={1/scale}/>
     </g>;
    })}
    {territories.map(({id,path})=>{return <g key={id} data-owner-border={id} aria-hidden="true" fill="none" pointerEvents="none"><path d={path} stroke="#122c29" strokeWidth={4/scale}/><path d={path} stroke={ownerColor(id)} strokeWidth={1.6/scale}/></g>;})}
    {towers.filter(s=>near(s,230)).map(s=>{const p=mapPoint(s);return <g key={s.id} data-sanctuary={s.id} aria-label={`${s.name}: distrito reservado`}>
      {s.cells.map(c=><path key={`${c.q},${c.r}`} d={cellPath(c)} fill="#c2ad6820"/>)}
      <path d={borderPath(s.cells)} fill="none" stroke="#d4b96f" strokeDasharray={`${4/scale} ${4/scale}`} strokeWidth={1/scale}/>
      {scale<.2?<g transform={`translate(${p.x} ${p.y}) scale(${1/scale})`} data-tower-marker={s.id} pointerEvents="none">
       <circle r="10" fill="#142e2a" stroke="#f0cf7c" strokeWidth="1.5"/>
       <path d="M-5 5h10v2H-5zm1-1v-7h2v-2h2v2h2v-2h2v9H1V1h-2v3z" fill="#f6d889"/>
       <text y="23" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff0c4" stroke="#102b26" strokeWidth="3" paintOrder="stroke">{s.id==='sanctuary-central'?'Torre central':`Torre ${s.id.replace('sanctuary-','')}`}</text>
      </g>:<><image href={s.id==='sanctuary-central'?'/landmarks/observatory-study-v1.png':'/landmarks/sanctuary-district-v1.png'} x={p.x-165} y={p.y-185} width="330" height="330" pointerEvents="none"/>
      <text x={p.x} y={p.y+150} textAnchor="middle" fontSize={11/scale} fill="#e6d39d" stroke="#173229" strokeWidth={3/scale} paintOrder="stroke">{s.name}</text></>}
    </g>;})}
    {distantSignals.filter(t=>!knownTowers.has(t.id)&&near(t)).map(t=>{
      const p=mapPoint(t);
      return <g key={t.id} data-tower-signal={t.id} aria-label={`Torre avistada: ${t.name}`} transform={`translate(${p.x} ${p.y}) scale(${1/scale})`} pointerEvents="none">
        {t.id==='sanctuary-central'&&<path d="M0 -15L15 0 0 15 -15 0Z" fill="#16171c" stroke="#bca984"/>}
        <circle r="11" fill="#16171c" stroke="#bdb4ad" strokeDasharray="2 2"/>
        <Castle x={-7} y={-7} width={14} height={14} stroke="#ded4bc"/>
        {(scale>=.2||t.id==='sanctuary-central')&&<text y="24" fill="#ded4bc" fontSize="11" textAnchor="middle">{t.id==='sanctuary-central'?'Central':'Torre avistada'}</text>}
      </g>;
    })}
    {preview.length>0&&<g data-exploration-preview="true" pointerEvents="none" aria-hidden="true">
      <path d={borderPath(corridor)} fill="#e0cf8f12" stroke="#e0cf8f" strokeWidth={1/scale} strokeDasharray={`${4/scale} ${4/scale}`}/>
      <path d={preview.map((c,i)=>{const p=mapPoint(c);return `${i?'L':'M'}${p.x} ${p.y}`;}).join(' ')} fill="none" stroke="#ffe4a0" strokeWidth={1.5/scale}/>
    </g>}
    {journeys.filter(()=>scale>=.3).map(order=>{
     const origin=order.expeditionOrigin??order.explorationPath?.[0]??journeyOrigin(data.state.cities,{q:order.q!,r:order.r!});if(!origin)return null;
     const from=mapPoint(origin),to=mapPoint({q:order.q!,r:order.r!});
     const progress=Math.max(0,Math.min(1,(now-order.createdAt)/Math.max(1,order.arrivesAt-order.createdAt)));
     const x=from.x+(to.x-from.x)*progress,y=from.y+(to.y-from.y)*progress;
     return <g key={`journey-${order.id}`} data-map-journey={order.id} aria-hidden="true" pointerEvents="none">
      <path d={`M${from.x} ${from.y} L${to.x} ${to.y}`} fill="none" stroke="#102c26" strokeWidth={4/scale}/>
      <path d={`M${from.x} ${from.y} L${to.x} ${to.y}`} fill="none" stroke={order.returning?'#a9cba2':order.kind==='attack'?'#dcad8c':'#e0cf8f'} strokeWidth={1.4/scale} strokeDasharray={`${5/scale} ${5/scale}`}/>
      <g transform={`translate(${x} ${y}) scale(${1/scale})`} data-journey-kind={order.kind}>
       <circle r="8" fill="#142e26" stroke="#e0cf8f" strokeWidth="1"/>
       {order.kind==='attack'?<path d="M-4 -4L4 4M4 -4L-4 4" stroke="#ffe9be" strokeWidth="2"/>:order.kind==='collect'?<path d="M0 -5L5 3H-5Z" fill="#ffe9be"/>:<circle r="3" fill="#ffe9be"/>}
      </g>
     </g>;
    })}
    {selected&&<g data-selection-hex={selected.id} pointerEvents="none" aria-hidden="true">
     <path d={cellPath(selected)} fill="#f3d27b25" stroke="#192722" strokeWidth={5/scale}/>
     <path d={cellPath(selected)} fill="none" stroke="#ffdf87" strokeWidth={2/scale} strokeLinejoin="round"/>
    </g>}
    {visible.filter(t=>scale>=.3||t.kind==='city'||t.id===selectedId||(t.q===cq&&t.r===cr)).map(t=>{const p=mapPoint(t),own=t.ownerId===data.state.playerId,small=scale<.3;
     const resourceCell=(t.kind==='gold'||t.kind==='materials')&&!regionAnchors.has(t.id)&&t.id!==selectedId;
     const quiet=resourceCell||(scale<.85&&!t.ownerId&&!regionAnchors.has(t.id)&&t.kind!=='abandoned');
     const work=own&&!data.computed.readOnly&&data.state.orders.some(o=>o.kind==='upgrade'&&o.cityId===t.cityId);
     const city=own?data.state.cities.find(c=>c.id===t.cityId):undefined;
     const appearance=city?getCityAppearance(city):null;
     const spent=Boolean(t.deposit&&t.deposit.remaining<=0&&!t.ownerId);
     const art=spent?null:t.kind==='city'?(appearance?.art??'city'):t.kind==='gold'?'mine':t.kind==='materials'?'materials':t.kind==='abandoned'?'abandoned':t.kind==='npc'?'npc':t.kind==='portal'?'landmark':t.kind==='ruin'?'ruin':null;
     const box=t.kind==='city'&&!small?Math.max(52,44/scale):(small?22:46)/scale;return <foreignObject key={t.id} x={p.x-box/2} y={p.y-box/2} width={box} height={box} overflow="visible">
      <button type="button" role="gridcell" style={{width:box,height:box}} className={styles.tile} data-cozy-tile={t.id} data-centered={t.q===cq&&t.r===cr} aria-selected={t.id===selectedId} aria-label={`${t.name}, ${t.q}, ${t.r}. ${t.kind==='city'?'Cidade':t.clue}${appearance?` · ${appearance.label}`:""}${work?" · obra em andamento":""}`} tabIndex={t.q===cq&&t.r===cr?0:-1} onClick={()=>onSelect(t)}>
       {t.landmarkId||(quiet&&t.kind==='plain')?null:small||quiet?<span className={styles.dot} style={{width:(quiet?3:small?3:9)/scale,height:(quiet?3:small?3:9)/scale,opacity:t.revealed?1:0,background:t.ownerId?ownerColor(t.ownerId):spent?'#899f81':t.kind==='npc'?'#c18d73':t.kind==='gold'?'#ddbc69':t.kind==='materials'?'#8ab6a0':'#899f81'}}/>:art&&t.revealed?<CozyMapArt name={art} size={t.kind==='city'?50:(regionAnchors.has(t.id)?32:25)/scale}/>:<span className={styles.fog} style={{fontSize:13/scale}}>{t.revealed?'·':(!selectionOpen&&t.q===cq&&t.r===cr)?'?':''}</span>}
      </button>
     </foreignObject>;
    })}
    {scale>=.3&&data.state.cities.filter(city=>city.capital&&near(city)).map(city=>{
     const p=mapPoint(city);
     return <text key={city.id} x={p.x} y={p.y-21-4/scale} textAnchor="middle" fontSize={12/scale} fontWeight="bold" fill="#fff2cb" stroke="#19261e" strokeWidth={3/scale} paintOrder="stroke" pointerEvents="none">{city.name}</text>;
    })}
    {(()=>{
     const cities=visible.filter(t=>t.revealed&&t.kind==='city'&&t.ownerId);
     const labels:{x:number;y:number}[]=[];
     const sources=scale<.3?territories.map(t=>t.anchor):[...cities];
     if(scale>=.3){
      const labeled=new Set(cities.filter(t=>near(t,-20)).map(t=>t.ownerId));
      const nearest=new Map<string,{tile:CozyTile;distance:number}>();
      for(const tile of visible){
       const owner=tile.ownerId??tile.territoryOwnerId;
       if(!tile.revealed||!owner||labeled.has(owner)||!near(tile,-30/scale))continue;
       const point=mapPoint(tile),distance=Math.hypot(point.x-camera.x,point.y-camera.y);
       if(distance<(nearest.get(owner)?.distance??Infinity))nearest.set(owner,{tile,distance});
      }
      for(const [owner,entry] of nearest)sources.push({...entry.tile,ownerId:owner});
     }
     return sources.filter(t=>near(t)).map(t=>{const p=mapPoint(t),x=p.x*scale,y=p.y*scale+27;
      if(scale<.2&&towers.some(s=>{const tower=mapPoint(s);return Math.abs(tower.x*scale-x)<45&&Math.abs(tower.y*scale+10-y)<30;}))return null;
      if(labels.some(l=>Math.abs(l.x-x)<48&&Math.abs(l.y-y)<25)||(scale>=.3&&cities.some(other=>other.id!==t.id&&Math.abs(mapPoint(other).x*scale-x)<36&&Math.abs(mapPoint(other).y*scale-y)<22)))return null;
      labels.push({x,y});return <foreignObject key={`emblem-${t.id}`} x={p.x-19/scale} y={p.y+18+2/scale} width={38/scale} height={24/scale} pointerEvents="none"><CozyMapEmblem ownerId={t.ownerId!} crest={data.shared.realmCrests?.[t.ownerId!]} size={38/scale}/></foreignObject>;
     });
    })()}

   </svg>
  </div>
  <div className={styles.zoom}><button type="button" onClick={toggleGrid} aria-label="Mostrar grade de hexágonos" aria-pressed={grid}><Grid3X3 size={19}/></button><button aria-label="Aproximar mapa" disabled={scale>=MAP_MAX_ZOOM} onClick={()=>zoomAt(1.4)}>+</button><button aria-label="Afastar mapa" disabled={scale<=minimum+.001} onClick={()=>zoomAt(1/1.4)}>−</button><button aria-label="Restaurar visão da capital" onClick={reset}>⌂</button></div>
  {!selectionOpen&&<div className={styles.legend}><span>━ Fronteira</span><span>┄ Recursos</span><span>● Névoa</span>{journeys.length>0&&<span>┄ Suas rotas {journeys.length}</span>}</div>}

 </div>;
}
