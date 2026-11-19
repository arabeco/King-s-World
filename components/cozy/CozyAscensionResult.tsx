"use client";

import {useEffect,useRef,useState} from "react";
import Image from "next/image";
import Link from "next/link";
import {Gem} from "lucide-react";
import {ASCENSION_MEDALS,ASCENSION_MEDAL_ART,type CozyAscensionPreview,type CozyAscensionReceipt} from "@/lib/cozy/ascension-preview";
import {COLLECTION_PRODUCTS,EQUIPMENT_RARITY_LABELS} from "@/lib/collection";
import CozyArt from "./CozyArt";
import {CrownButton,crownNumber} from "./CozyCrownUI";
import styles from "./cozy-achievements.module.css";

const pages=[
  {label:"Travessia",title:"Ascensão concluída"},
  {label:"Recompensas",title:"Recompensas recebidas"},
  {label:"Legado",title:"Para os próximos reinados"},
];

export default function CozyAscensionResult({result,progress,onClose}:{
  result:Pick<CozyAscensionReceipt,"worldName"|"medal"|"sovereign"|"sovereignId"|"score"|"peak"|"rewards">;
  progress?:CozyAscensionPreview["sovereign"];
  onClose?:()=>void;
}) {
  const [page,setPage]=useState(0);
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[page]);

  const {rewards}=result;
  const medal=ASCENSION_MEDALS.find(tier=>tier.id===result.medal);
  const item=COLLECTION_PRODUCTS.find(product=>product.id===rewards.equipmentId);
  const king=COLLECTION_PRODUCTS.find(product=>product.id===result.sovereignId);

  return <div className={styles.resultWizard} data-tier={medal?.id}>
    <ol className={styles.riteSteps} aria-label="Etapas do resultado">
      {pages.map((entry,index)=><li key={entry.label} aria-current={page===index?"step":undefined}>{entry.label}</li>)}
    </ol>
    <h3 ref={heading} tabIndex={-1}>{pages[page].title}</h3>
    {page===0&&<>
      <figure className={styles.resultScene}>
        <Image src="/rewards/ascensao/portal-travessia.jpg" alt="" fill sizes="(max-width: 464px) 85vw, 398px"/>
        <span className={styles.resultMedal}><CozyArt src={ASCENSION_MEDAL_ART[result.medal]} size={76}/></span>
        <figcaption><strong>{medal?.label}</strong><span>{result.worldName}</span></figcaption>
      </figure>
      <dl className={styles.resultScores}>
        <div><dt>Influência final</dt><dd>{crownNumber(result.score)}</dd></div>
        <div><dt>Recorde</dt><dd>{crownNumber(result.peak)}</dd></div>
      </dl>
    </>}
    {page===1&&<ul className={styles.resultPrizes} aria-label="Prêmios creditados">
      <li><span className={styles.resultItem}><Gem size={28} aria-hidden="true"/></span>
        <span><strong>+{crownNumber(rewards.creditedGems)} Gemas</strong><small>Carteira da conta</small>
          {rewards.conversionGems>0&&<small>Inclui +{rewards.conversionGems} pela raridade completa.</small>}
          {rewards.refundOffset>0&&<small>{rewards.refundOffset} Gemas repuseram o estorno.</small>}
        </span>
      </li>
      {rewards.equipmentId&&<li><span className={styles.resultItem}>
        <CozyArt src={item?.image??"/icons/influence-legacy.png"} size={46}/>
      </span><span><strong>{item?.name??"Equipamento"}</strong>
        <small>Inventário da conta · {EQUIPMENT_RARITY_LABELS[medal?.rarity??"common"]}</small>
      </span></li>}
    </ul>}
    {page===2&&<>
      <div className={styles.resultSovereign}>
        <span className={styles.resultPortrait}><CozyArt src={king?.image??"/icons/influence-government.png"} size={52}/></span>
        <div><strong>{result.sovereign}</strong>
          {progress&&<small>Nível {progress.level} · {crownNumber(progress.xp)} XP · {progress.availablePoints} {progress.availablePoints===1?"ponto livre":"pontos livres"}</small>}
          <small>XP, pontos de atributo e equipamento ficam disponíveis para outros reinados.</small>
        </div>
      </div>
      <div className={styles.riteNav}>
        <Link className={styles.riteSecondary} href="/profile">Ver soberanos</Link>
        {onClose ? <Link className={styles.riteSecondary} href="/lobby">Voltar aos mundos</Link>
          : <Link className={styles.riteSecondary} href="/inventory/legacy">Ver Legado</Link>}
      </div>
    </>}
    <footer className={styles.riteNav}>
      <CrownButton quiet disabled={page===0} onClick={()=>setPage(page-1)}>Anterior</CrownButton>
      {page<pages.length-1 ? <CrownButton onClick={()=>setPage(page+1)}>Próximo</CrownButton>
        : onClose ? <CrownButton onClick={onClose}>Concluir</CrownButton>
          : <Link className={styles.ascensionLegacyLink} href="/lobby">Voltar aos mundos</Link>}
    </footer>
  </div>;
}
