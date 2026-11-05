import {useEffect,useId,useMemo,useRef,useState,type ReactNode} from "react";
import type {CozyCity, CozyTile} from "@/lib/cozy/types";
import {getCityAppearance} from "@/lib/cozy/catalog";
import {mapPoint,cellPath,borderPath} from "@/lib/cozy/map-presentation";
import {mapIdentity} from "@/lib/cozy/map-identity";
import {MAP_MAX_ZOOM} from "@/lib/cozy/map-zoom";
import CozyMapArt from "./CozyMapArt";
import CozyMapTerrain from "./CozyMapTerrain";
import styles from "./cozy-realm.module.css";

export default function CozyRealmPanorama({cities,tiles,owner,royal}:{cities:CozyCity[];tiles:CozyTile[];owner:string;royal?:ReactNode}){
  const frame=useRef<SVGSVGElement>(null);
  const uid=useId().replace(/:/g,"");
  const [size,setSize]=useState({w:360,h:150});
  useEffect(()=>{
    if(!frame.current)return;
    const observer=new ResizeObserver(([entry])=>setSize({w:Math.max(1,entry.contentRect.width),h:Math.max(1,entry.contentRect.height)}));
    observer.observe(frame.current);return ()=>observer.disconnect();
  },[]);
  const land=useMemo(()=>tiles.filter(t=>t.revealed&&(t.ownerId??t.territoryOwnerId)===owner),[tiles,owner]);
  const points=[...land,...cities].map(mapPoint);
  if(!points.length)points.push({x:0,y:0});
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
  const scale=Math.min(MAP_MAX_ZOOM,size.w/(right-left+72),size.h/(bottom-top+68));
  const w=size.w/scale,h=size.h/scale,x=(left+right-w)/2,y=(top+bottom-h)/2;
  const color=mapIdentity(owner).color;
  return (
    <section className={styles.panorama} aria-label="Panorama do reino">
      <div className={styles.terrain} aria-hidden="true" />
      {royal}

      <svg className={styles.atlas} ref={frame} data-realm-scale={scale} viewBox={`${x} ${y} ${w} ${h}`} role="img" aria-label="Mapa do seu império">
        <defs>
          <CozyMapTerrain uid={uid}/>
          <filter id={`${uid}mist`}><feTurbulence type="fractalNoise" baseFrequency=".018 .045" numOctaves="3" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope=".18"/><feFuncG type="linear" slope=".20"/><feFuncB type="linear" slope=".22"/></feComponentTransfer></filter>
          <clipPath id={`${uid}sight`}>
            {tiles.filter(t=>t.revealed||t.terrainVisible).map(t=><path key={t.id} d={cellPath(t)}/>)}
          </clipPath>
        </defs>
        <rect x={x} y={y} width={w} height={h} fill="#151b1d"/>
        <rect x={x} y={y} width={w} height={h} filter={`url(#${uid}mist)`} opacity=".65"/>
        <rect x={x} y={y} width={w} height={h} clipPath={`url(#${uid}sight)`} fill={`url(#${uid}valley)`}/>
        {land.map(t=><path key={t.id} d={cellPath(t)} fill={color+"48"}/>)}
        <path d={borderPath(land)} stroke={color} strokeWidth={1.2/scale} fill="none"/>
        {cities.map(city=>{const p=mapPoint(city),appearance=getCityAppearance(city);
          return <g key={city.id} transform={`translate(${p.x} ${p.y})`} data-realm-city={city.id} data-city-stage={appearance.stage}>
            <title>{city.name}</title>
            <g transform="translate(-25 -25)"><CozyMapArt name={appearance.art} size={50}/></g>
            {scale<.3&&<circle r={2.3/scale} fill={city.capital?"#ffdf96":color} stroke="#252622" strokeWidth={1/scale}/>}
          </g>;
        })}
      </svg>
      <div className={styles.vignette} aria-hidden="true" />
    </section>
  );
}
