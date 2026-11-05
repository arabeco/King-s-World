import CozySanctuaryPact from "./CozySanctuaryPact";
import {CheckCircle2, MapPin} from "lucide-react";
import type {CozyComputed} from "@/lib/cozy/types";
import CozyArt from "./CozyArt";
import CozySymbol from "./CozySymbol";
import {CrownButton,crownNumber,crownRemaining,type CrownPanelProps} from "./CozyCrownUI";
import styles from "./cozy-sanctuary.module.css";

export default function CozySanctuaryCard({tower,data,act,locked,now,onLocate}:CrownPanelProps & {
  tower:CozyComputed["sanctuaries"][number];onLocate?:()=>void;
}) {
  const {state,computed}=data;
  const visited=tower.visitedAt!==null;
  const reason=computed.readOnly?"A temporada terminou.":!computed.started?"Aguarde o início da temporada.":locked?"Aguarde a confirmação.":visited?"Reconhecimento registrado.":tower.arrivesAt?"Expedição em andamento.":state.orders.some(o=>o.kind==="explore")?"Conclua a exploração atual antes de enviar outra.":computed.endsAt!==null&&now+tower.travelMs>computed.endsAt?"Não há tempo para chegar antes do fim da temporada.":state.resources.supplies<tower.supplyCost?`Faltam ${crownNumber(Math.ceil(tower.supplyCost-state.resources.supplies))} suprimentos.`:"";
  return <article className={styles.card} aria-label={`Torre: ${tower.name}`}>
    <div className={styles.heading}>
      <CozyArt src={tower.id==="sanctuary-central"?"/landmarks/observatory-study-v1.png":"/landmarks/sanctuary-district-v1.png"} size={72}/>
      <div><small>{tower.q}, {tower.r}</small><h4>{tower.name}</h4><span>{visited?"Reconhecida":tower.arrivesAt?"Expedição a caminho":"Localização conhecida"}</span></div>
    </div>
    {visited?null:tower.arrivesAt?<p className={styles.visited}><CozySymbol name="time" size={20}/>{crownRemaining(tower.arrivesAt,now)}</p>:<>
      <CrownButton disabled={!!reason} onClick={()=>void act({type:"sanctuary_explore",sanctuaryId:tower.id})} aria-label={`Explorar ${tower.name}`}>
        Explorar torre <span className={styles.quote}><CozySymbol name="supplies" size={23}/>{crownNumber(tower.supplyCost)}<CozySymbol name="time" size={19}/>{crownRemaining(now+tower.travelMs,now)}</span>
      </CrownButton>
      {reason&&<p className={styles.reason}>{reason}</p>}
    </>}
    {(visited||(data.shared.sanctuaryPacts??[]).some(p=>p.sanctuaryId===tower.id&&(p.ownerPlayerId===state.playerId||p.allianceId!==null&&p.allianceId===state.allianceId)))&&<CozySanctuaryPact data={data} act={act} locked={locked} now={now} sanctuaryId={tower.id}/>}
    {onLocate&&<button type="button" className={styles.locate} onClick={onLocate}><MapPin size={16}/>Ver no mapa</button>}
  </article>;
}
