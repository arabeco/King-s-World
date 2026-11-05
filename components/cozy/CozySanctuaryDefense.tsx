import type {CozySanctuaryPact} from '@/lib/cozy/types';
import {ALL_SANCTUARIES} from '@/lib/cozy/landmarks';
import CozyArt from './CozyArt';
import CozySymbol from './CozySymbol';
import {CrownButton,CrownProgress,crownNumber as number,crownRemaining as remaining,type CrownPanelProps} from './CozyCrownUI';
import styles from './cozy-sanctuary.module.css';

export default function CozySanctuaryDefense({pact,data,act,locked,now}:{pact:CozySanctuaryPact}&CrownPanelProps){
 if(!pact.raids||pact.completedAt===null)return null;
 const threat=data.computed.sanctuaryThreats?.find(t=>t.pactId===pact.id);
 const last=pact.raids.waves.filter(w=>w.outcome).at(-1);
 const tower=ALL_SANCTUARIES.find(t=>t.id===pact.sanctuaryId)!;
 if(!threat&&!last)return <p className={styles.riskTag}><CozyArt src="/icons/status-success.png" size={20}/>Sem horda prevista neste prazo</p>;
 const pending=pact.raids.waves.find(w=>!w.outcome);
 return <section className={styles.towerDefense} data-tower-defense="true" aria-label={`Defesa da torre: ${tower.name}`}>
  {threat&&<>
   <header><CozyArt src="/icons/action-defend.png" size={30}/><span><strong>Horda a caminho</strong><small>{tower.name} · dia {threat.day}</small></span><span className={styles.raidTime}><CozySymbol name="time" size={20}/>{remaining(threat.arrivesAt,now)}</span></header>
   <div className={styles.powerCompare}>
    <span><CozyArt src="/icons/action-defend.png" size={30}/><small>Defesa confirmada</small><b>{number(threat.defense)}</b></span>
    <span><CozyArt src="/icons/action-attack.png" size={30}/><small>Horda</small><b>{number(threat.power)}</b></span>
   </div>
   <CrownProgress value={threat.defense} max={threat.power} label="Preparação da defesa da torre"/>
   <span className={styles.riskTag} data-ready={threat.defense>=threat.power}><CozyArt src={threat.defense>=threat.power?'/icons/status-success.png':'/icons/status-warning.png'} size={20}/>{threat.defense>=threat.power?'Defesa preparada':`Faltam ${number(threat.power-threat.defense)} de defesa · bônus em risco`}</span>
   <CrownButton disabled={locked||!threat.canDefend||now>=threat.arrivesAt} aria-label={`Defender ${tower.name}: +${number(threat.offer)} de defesa`} onClick={()=>void act({type:'sanctuary_pact_defend',pactId:pact.id,waveDay:threat.day})}>
    <CozyArt src={threat.pledgedPower?'/icons/status-success.png':'/icons/action-defend.png'} size={25}/>{threat.pledgedPower?`Apoio confirmado +${number(threat.pledgedPower)}`:`Confirmar apoio +${number(threat.offer)}`}
   </CrownButton>
   <span className={styles.riskTag} aria-label="Custo: zero suprimentos. Nenhuma tropa se desloca."><CozySymbol name="supplies" size={20}/>0 · sem deslocar tropas</span>
   {!threat.canDefend&&!threat.pledgedPower&&<p className={styles.reason}>{threat.reason}{threat.availableAt>now&&<> {remaining(threat.availableAt,now)}</>}</p>}
   <details><summary>O que está em risco?</summary><p>Se a horda vencer, termina somente o bônus desta sintonia. Não há perdas de tropas ou dano às cidades neste confronto; a horda do reino continua independente. Se este bônus for de defesa, perdê-lo também muda a proteção do reino. Recursos já usados no pacto não voltam. Cada reino protege uma torre por onda; o intervalo é compartilhado com o apoio aos aliados.</p></details>
   {!!pending?.defenders.length&&<details><summary>Apoios confirmados · {pending.defenders.length}</summary><ul>{pending.defenders.map(d=><li key={d.playerId}><span>{data.players.find(p=>p.playerId===d.playerId)?.playerName??'Reino'}</span><strong>+{number(d.power)}</strong></li>)}</ul><p>O apoio fica registrado, inclusive se o reino sair da aliança.</p></details>}
  </>}
  {last&&<div className={styles.raidResult} role="status">
   <CozyArt src={last.outcome==='won'?'/icons/status-success.png':'/icons/status-warning.png'} size={28}/><div><strong>{last.outcome==='won'?'Torre protegida':last.outcome==='lost'?'Bônus interrompido':'Defesa encerrada'}</strong><small>{tower.name} · dia {last.day} · {number(last.defense??0)} defesa / {number(last.power)} horda</small></div>
  </div>}
 </section>;
}
