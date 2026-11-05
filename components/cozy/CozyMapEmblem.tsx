import {mapIdentity} from '@/lib/cozy/map-identity';
import {crestImage} from '@/lib/cozy/heraldry';
/** SVG stays legible without color: silhouette plus a stable four-character code. */
export default function CozyMapEmblem({ownerId,size=38,crest}:{ownerId:string;size?:number;crest?:{id:string;finish:'plain'|'imperial'}}){
 const {code,shape,color}=mapIdentity(ownerId);
 const paths=['M2 2H38V16L20 23 2 16Z','M7 2H33L39 11 33 21H7L1 11Z','M2 2H38V21H2Z','M20 0L39 7V19L20 24 1 19V7Z'];
 const art=crestImage(crest?.id);
 return <svg width={size} height={size*.6} viewBox="0 0 40 24" aria-hidden="true" data-map-emblem={ownerId}><path d={paths[shape]} fill="#142d26" stroke={crest?.finish==='imperial'?'#f7d481':color} strokeWidth={crest?.finish==='imperial'?3:2}/>{art&&<image href={art} x="2" y="1" width="20" height="22"/>}<text x={art?29:20} y="15.5" textAnchor="middle" fill="#fff0ca" fontFamily="sans-serif" fontWeight="700" fontSize={art?6.5:10}>{code}</text></svg>;
}
