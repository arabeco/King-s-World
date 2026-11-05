"use client";
import {Gem} from "lucide-react";
import {COLLECTION_PRODUCTS,EQUIPMENT_RARITY_LABELS,type CollectionSeasonReward} from "@/lib/collection";
import {CollectionDialog} from "./CollectionDialog";
import styles from "./collection-hub.module.css";
export function SeasonRewardDetails({reward,onClose}:{reward:CollectionSeasonReward;onClose:()=>void}){
 const modern=reward.rulesVersion===2;
 const lines:[string,number][]=[["Participação",reward.participationGems??0],["Vitória",reward.victoryGems??0],["Colocação",reward.placementGems??0],["Item convertido",reward.conversionGems??0]];
 return <CollectionDialog title="Prêmios da temporada" label={`Prêmios de ${reward.worldName}`} onClose={onClose}>
  <div className={styles.rewardDetail}>
   <strong>{reward.worldName}</strong>
   {modern&&reward.place&&reward.participants&&<span>{reward.place}º / {reward.participants} participantes elegíveis</span>}
   <dl>{modern&&lines.filter(([,value])=>value>0).map(([name,value])=><div key={name}><dt>{name}</dt><dd><Gem size={16}/>+{value}</dd></div>)}<div className={styles.rewardTotal}><dt>Total de Gemas</dt><dd><Gem size={18}/>+{reward.gems}</dd></div></dl>
   {reward.productIds.map(id=>{const item=COLLECTION_PRODUCTS.find(p=>p.id===id);return item?<div className={styles.rewardItem} key={id}><img src={item.image} alt=""/><span><strong>{item.name}</strong><small>{EQUIPMENT_RARITY_LABELS[item.rarity??'common']}</small></span></div>:null;})}
   {modern&&(reward.conversionGems??0)>0&&<small>A coleção da raridade {EQUIPMENT_RARITY_LABELS[reward.rarity??'common']} já estava completa.</small>}
   {modern&&Object.keys(reward.kingXp??{}).length>0&&<><h3>XP por colocação · +{reward.xpPercent}%</h3><dl aria-label="XP de cada rei">{Object.entries(reward.kingXp??{}).map(([id,xp])=>{const king=COLLECTION_PRODUCTS.find(p=>p.id===id);return <div key={id}><dt>{king?.name??'Rei'}</dt><dd>+{xp} XP</dd></div>;})}</dl></>}
   <time dateTime={reward.awardedAt}>{new Date(reward.awardedAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</time>
  </div><button type="button" onClick={onClose}>Voltar</button>
 </CollectionDialog>;
}
