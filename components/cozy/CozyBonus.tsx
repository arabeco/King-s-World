import CozyArt from "./CozyArt";
import CozySymbol from "./CozySymbol";
import type {CozyAllianceProjectKind} from "@/lib/cozy/types";
import styles from "./cozy-sanctuary.module.css";

export default function CozyBonus({kind,value,size=32}:{kind:CozyAllianceProjectKind;value:number;size?:number}){
 const label=kind==="defense"?"Defesa":"Produção de suprimentos";
 const percent=Math.round(value*100);
 return <span className={styles.bonus} data-cozy-bonus={kind} aria-label={`Bônus: +${percent}% ${label}`}>
  {kind==="defense"?<CozyArt src="/icons/action-defend.png" size={size}/>:<CozySymbol name="supplies" size={size}/>}
  <span><strong>+{percent}%</strong><small>{label}</small></span>
 </span>;
}
