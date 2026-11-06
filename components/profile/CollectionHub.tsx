"use client";

import {collectionRequest} from "@/lib/collection-client";

import {KING_PROGRESSION} from "@/lib/cozy/king-progression";

import {useEffect,useId,useRef,useState} from "react";

import Link from "next/link";

import {Gem,Lock,Package,Crown} from "lucide-react";

import {COLLECTION_PRODUCTS,GEM_PACKS,EQUIPMENT_RARITY_LABELS,kingLevel,effectiveKingStats,type CollectionState,type CollectionSeasonReward} from "@/lib/collection";

import {equipmentDescription} from "@/lib/cozy/equipment";

import {SeasonRewardDetails} from "./SeasonRewardDetails";
import {CollectionDialog} from "./CollectionDialog";
import {SovereignStats} from "./SovereignStats";

import styles from "./collection-hub.module.css";

type Product=typeof COLLECTION_PRODUCTS[number];
type StatAttempt={kingId:string;stat:'administration'|'command'|'exploration';revision:number};


export function CollectionHub({mode,username,seasonId}:{mode:'profile'|'inventory'|'shop';username?:string;seasonId?:string}){

 const [showAll,setShowAll]=useState(false),[detail,setDetail]=useState<Product|null>(null),[statNeedsCheck,setStatNeedsCheck]=useState(false),[notice,setNotice]=useState('');
 const categoryId=useId();
 const [rewardDetail,setRewardDetail]=useState<CollectionSeasonReward|null>(null);
 const openedSeason=useRef<string|null>(null);
 const [loadedSeason,setLoadedSeason]=useState<string|null>(null);

 const [data,setData]=useState<CollectionState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0),[tab,setTab]=useState('king'),[confirm,setConfirm]=useState<Product|null>(null),[requestId,setRequestId]=useState(''),[statConfirm,setStatConfirm]=useState<StatAttempt|null>(null);

 useEffect(()=>{const controller=new AbortController();setError('');const endpoint=seasonId?`/api/me/collection?season=${encodeURIComponent(seasonId)}`:'/api/me/collection';collectionRequest<CollectionState>(endpoint,{cache:'no-store',signal:controller.signal}).then(payload=>{if(!controller.signal.aborted){setData(payload);setLoadedSeason(seasonId??null);}}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[attempt,seasonId]);
 useEffect(()=>{if(mode!=='inventory'||!seasonId||loadedSeason!==seasonId||!data||openedSeason.current===seasonId)return;openedSeason.current=seasonId;const reward=data.seasonRewards?.find(r=>r.worldId===seasonId);if(reward){setNotice('');setRewardDetail(reward);setTab('equipment');}else setNotice('Nenhum prêmio disponível para esta temporada.');},[data,mode,seasonId,loadedSeason]);

 useEffect(()=>{if(mode==='inventory'){const params=new URLSearchParams(location.search);const category=params.get('tab');if(category&&['king','equipment','crest'].includes(category))setTab(category);}},[mode]);

 const [focusedKingId,setFocusedKingId]=useState<string|null>(null);
 const kingRail=useRef<HTMLDivElement>(null);
 const initialKingId=data?.selectedId;

 useEffect(()=>{
  if(mode!=='profile'||!initialKingId||!kingRail.current)return;
  const rail=kingRail.current;
  const card=Array.from(rail.children).find(child=>child.getAttribute('data-king')===initialKingId);
  if(!card)return;
  const offset=card.getBoundingClientRect().left-rail.getBoundingClientRect().left;
  rail.scrollLeft+=offset-(rail.clientWidth-card.clientWidth)/2;
 },[mode,initialKingId]);

 function focusCenteredKing(){
  const rail=kingRail.current;
  if(!rail)return;
  const center=rail.getBoundingClientRect().left+rail.clientWidth/2;
  const nearest=Array.from(rail.children).reduce<Element|null>((best,card)=>{
   const distance=(item:Element)=>{
    const rect=item.getBoundingClientRect();
    return Math.abs(rect.left+rect.width/2-center);
   };
   return !best||distance(card)<distance(best)?card:best;
  },null);
  setFocusedKingId(nearest?.getAttribute('data-king')??null);
 }

 const owned=new Map((data?.inventory??[]).map(i=>[i.id,i]));const selected=COLLECTION_PRODUCTS.find(p=>p.id===data?.selectedId)??COLLECTION_PRODUCTS[0];

 async function select(product:Product){setBusy(true);setError('');try{const state=await collectionRequest<{revision:number}>('/api/me/appearance',{cache:'no-store'});await collectionRequest('/api/me/appearance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({appearance_id:product.id,revision:state.revision})});setData(d=>d?{...d,selectedId:product.id}:d);}catch(e){setError(e instanceof Error?e.message:'Falha ao selecionar.');}finally{setBusy(false);}}

 async function buy(){if(!confirm||!requestId||busy)return;setBusy(true);setError('');try{const result=await collectionRequest<CollectionState>('/api/me/collection',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({productId:confirm.id,requestId})});setData(result);setConfirm(null);}catch(e){setError(e instanceof Error?e.message:'Falha ao comprar.');}finally{setBusy(false);}}

 async function addStat(){
  if(!statConfirm||!data||busy||statNeedsCheck)return;
  setBusy(true);setError('');setNotice('');
  try{
   const result=await collectionRequest<CollectionState>('/api/me/king-stats',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(statConfirm)});
   setData(result);setStatConfirm(null);setNotice('Ponto adicionado. Vale nos próximos reinados.');
  }catch(e){setStatNeedsCheck(true);setError(e instanceof Error?e.message:'Não foi possível confirmar o resultado.');}
  finally{setBusy(false);}
 }

 async function checkStatResult(){
  if(!statConfirm||busy)return;
  setBusy(true);setError('');
  try{
   const result=await collectionRequest<CollectionState>('/api/me/collection',{cache:'no-store'});
   const king=(result as CollectionState).inventory.find(item=>item.id===statConfirm.kingId);
   if(!king)throw Error('Rei não encontrado na coleção.');
   setData(result);setStatNeedsCheck(false);
   if((king.statRevision??0)!==statConfirm.revision){setStatConfirm(null);setNotice('Pontos atualizados. Confira os atributos do rei.');}
   else setError('Nenhuma alteração encontrada. Você pode confirmar o ponto.');
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível conferir. Tente novamente.');}
  finally{setBusy(false);}
 }

 const viewed=mode==='profile'?COLLECTION_PRODUCTS.find(p=>p.id===focusedKingId&&p.kind==='king'&&(showAll||owned.has(p.id)))??selected:selected;
 const viewedItem=owned.get(viewed.id);
 const level=kingLevel(viewedItem?.xp??0),xp=viewedItem?.xp??0,start=(level-1)**2*KING_PROGRESSION.levelXp,end=level**2*KING_PROGRESSION.levelXp;

 const added=viewedItem?.added;const freePoints=Math.max(0,level-1-(added?.administration??0)-(added?.command??0)-(added?.exploration??0));const stats=effectiveKingStats(viewed,viewedItem);

 const visible=COLLECTION_PRODUCTS.filter(p=>p.kind===tab&&(mode==='shop'?p.sale:mode==='profile'?p.kind==='king'&&(showAll||owned.has(p.id)):owned.has(p.id)));

 function changeCategory(key:string){
  setTab(key);
  if(mode==='inventory'){
   const url=new URL(location.href);url.searchParams.set('tab',key);
   history.replaceState(history.state,'',url);
  }
 }

 return <section className={styles.root} data-mode={mode} aria-label={mode==='profile'?'Coleção de reis':mode==='shop'?'Loja da Coroa':'Inventário'}>

 <div className={styles.top}><strong><Gem size={19}/>{data?data.gems:'—'} <small>Gemas</small></strong></div>
 {Boolean(data?.gemDebt)&&<details><summary>Estorno · {data!.gemDebt} Gemas</summary><p>Esta compra foi estornada após o uso das Gemas. Os próximos créditos repõem {data!.gemDebt} Gemas antes de aumentar seu saldo. Seus reis e reinados foram preservados.</p></details>}

 {mode==='inventory'&&Boolean(data?.seasonRewards?.length)&&<details className={styles.rewards}><summary>Prêmios de temporada</summary>{data?.seasonRewards?.map(r=><div key={r.worldId}><button type="button" className={styles.rewardName} aria-label={`Ver prêmios de ${r.worldName}`} onClick={()=>setRewardDetail(r)}><strong>{r.worldName}</strong>{r.rulesVersion===2&&r.place&&<small>{r.place}º / {r.participants}</small>}</button><span><Gem size={16}/> +{r.gems}</span>{Object.values(r.kingXp??{}).reduce((sum,xp)=>sum+xp,0)>0&&<span>+{Object.values(r.kingXp??{}).reduce((sum,xp)=>sum+xp,0)} XP</span>}{r.productIds?.map(id=>{const product=COLLECTION_PRODUCTS.find(p=>p.id===id);return product?<button type="button" key={id} aria-label={`Ver prêmio ${product.name}`} onClick={()=>setDetail(product)}><img src={product.image} alt=""/></button>:null;})}<time dateTime={r.awardedAt}>{new Date(r.awardedAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</time></div>)}</details>}



 {notice&&<p role="status" className={styles.notice}>{notice}</p>}{error&&!statConfirm&&!confirm&&!detail&&<div className={styles.error}><p role="alert">{error}</p><button type="button" disabled={busy} onClick={()=>setAttempt(n=>n+1)}>Tentar novamente</button></div>}{!data&&!error&&<p role="status">Consultando coleção…</p>}

 {mode!=='profile'&&<div className={styles.tabs} role={mode==='inventory'?'tablist':'group'} aria-label="Categoria">{(mode==='shop'?[['king','Reis'],['crest','Brasões'],['gems','Gemas'],['premium','Premium']]:[['king','Reis'],['equipment','Equipamentos'],['crest','Brasões']]).filter(([key])=>mode!=='shop'||key!=='equipment').map(([key,label])=><button key={key} type="button" id={`${categoryId}-${key}`} role={mode==='inventory'?'tab':undefined} aria-controls={mode==='inventory'?`${categoryId}-panel`:undefined} tabIndex={mode==='inventory'&&tab!==key?-1:0} aria-selected={mode==='inventory'?tab===key:undefined} aria-pressed={mode==='inventory'?undefined:tab===key} onKeyDown={event=>{
 if(mode!=='inventory'||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 event.preventDefault();const keys=['king','equipment','crest'],index=keys.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:-1)+3)%3;
 changeCategory(keys[next]);document.getElementById(`${categoryId}-${keys[next]}`)?.focus();
 }} onClick={()=>{if(key==='gems'||key==='premium'){document.getElementById(key==='gems'?'gem-packs':'premium-plan')?.scrollIntoView({behavior:'smooth'});}else changeCategory(key);}}>{label}</button>)}</div>}

 {mode==='profile'&&data&&<h2>Seus reis <small>{data?[...owned.keys()].filter(id=>id.startsWith('sovereign-')).length:'—'} / 22</small></h2>}
 <div className={mode==='profile'?styles.kingRail:styles.grid} ref={mode==='profile'?kingRail:undefined} onScroll={mode==='profile'?focusCenteredKing:undefined} id={`${categoryId}-panel`} role={mode==='inventory'?'tabpanel':undefined} aria-labelledby={mode==='inventory'?`${categoryId}-${tab}`:undefined}>{visible.map(p=>{const item=owned.get(p.id),missing=Math.max(0,p.price-(data?.gems??0));return <article key={p.id} data-king={mode==='profile'?p.id:undefined} data-focused={mode==='profile'&&viewed.id===p.id} data-selected={data?.selectedId===p.id} data-rarity={p.kind==='equipment'?p.rarity:undefined}><button type="button" className={styles.inspectArt} aria-label={mode==='profile'?`Destacar ${p.name}`:`Ver detalhes de ${p.name}`} onClick={event=>{
  if(mode==='profile'){
   event.currentTarget.closest('article')?.scrollIntoView({block:'nearest',inline:'center'});
   setFocusedKingId(p.id);
  }else setDetail(p);
 }}><img loading="lazy" src={p.image} alt=""/></button><strong>{p.name}</strong>{p.kind==='king'&&item&&<small>Nível {kingLevel(item.xp)} · {item.xp} XP</small>}{p.kind==='king'&&p.baseStats&&<SovereignStats compact values={effectiveKingStats(p,item)} label={item?"Stats do rei":"Stats iniciais"}/>}{item?<>{p.kind==='king'?<button type="button" disabled={busy||!data||data.selectedId===p.id} onClick={()=>select(p)}>{data?.selectedId===p.id?'Selecionado':'Selecionar'}</button>:<>{p.kind==='equipment'?<><small>{EQUIPMENT_RARITY_LABELS[p.rarity??'common']}</small><small>{equipmentDescription(p.id)}</small><small>Possuído</small></>:<small>Possuído</small>}</>}</>:<>{mode==='shop'?<><span className={styles.cost}><Gem size={15}/>{p.price}</span><button type="button" className="primary-button" disabled={!data||busy} onClick={()=>{if(missing){document.getElementById('gem-packs')?.scrollIntoView({behavior:'smooth'});return;}setError('');setRequestId(crypto.randomUUID());setConfirm(p);}}>{missing?`Faltam ${missing} Gemas`:'Comprar'}</button></>:<><small><Lock size={12}/> {p.price} Gemas</small><Link href="/premium">Ver na loja</Link></>}</>}</article>;})}</div>

 {mode==='profile'&&data&&<><header className={styles.sovereignHero}><img className={styles.figure} src={viewed.body} alt={viewed.name}/><div><span className={styles.heroEyebrow}>Seu soberano</span><h1>{username}</h1><button type="button" className={styles.selectedKing} onClick={()=>setDetail(viewed)}>{viewed.name} <span aria-hidden="true">›</span></button>{viewedItem?<strong>Nível {level}</strong>:<strong>Não adquirido</strong>}{viewedItem&&<><div className={styles.xp} role="progressbar" aria-label="Experiência deste rei" aria-valuemin={0} aria-valuemax={level===10?1:end-start} aria-valuenow={level===10?1:Math.max(0,xp-start)}><span style={{width:`${level===10?100:Math.min(100,(xp-start)/(end-start)*100)}%`}}/></div><small>{level===10?`${xp} XP · nível máximo`:`${xp-start} / ${end-start} XP`}</small></>}</div></header>{viewed.baseStats&&<><SovereignStats values={stats} label="Stats do rei em destaque"/>{viewedItem&&<details><summary>{freePoints} {freePoints===1?'ponto disponível':'pontos disponíveis'}</summary><small>Base fixa. Pontos adicionados são permanentes e valem ao iniciar outro reinado.</small>{(['administration','command','exploration'] as const).map((key,i)=><div className={styles.statAdd} key={key}><span>{['Administração','Comando','Exploração'][i]} · {viewed.baseStats![key]} base + {added?.[key]??0}</span><button type="button" disabled={busy||freePoints<=0||stats[key]>=10} onClick={()=>{setError('');setNotice('');setStatNeedsCheck(false);setStatConfirm({kingId:viewed.id,stat:key,revision:owned.get(viewed.id)?.statRevision??0});}}>+1</button></div>)}</details>}</>}</>}

 {mode==='profile'&&data&&<button type="button" className={styles.expand} onClick={()=>setShowAll(value=>!value)}>{showAll?'Mostrar só meus reis':'Ver todos os reis (22)'}</button>}

 {mode==='inventory'&&data&&visible.length===0&&<p>Nenhum item nesta categoria.</p>}

 {mode==='shop'&&<section id="gem-packs"><h2><Gem size={20}/> Gemas</h2><div className={styles.packs}>{GEM_PACKS.map(amount=><article key={amount}><Gem/><strong>{amount}</strong><button type="button" disabled>Em preparação</button></article>)}</div><small>Preços e compra dos pacotes serão disponibilizados pela loja Android.</small></section>}

 {rewardDetail&&<SeasonRewardDetails reward={rewardDetail} onClose={()=>setRewardDetail(null)}/>}
 {detail&&<CollectionDialog title={detail.name} busy={busy} onClose={()=>setDetail(null)}><div className={styles.itemDetail} data-kind={detail.kind} data-rarity={detail.rarity}><img src={detail.kind==='king'?detail.body:detail.image} alt=""/>{detail.kind==='equipment'?<><strong>{EQUIPMENT_RARITY_LABELS[detail.rarity??'common']}</strong><p>{equipmentDescription(detail.id)}</p><small>Escolhido na entrada de cada mundo.</small></>:detail.kind==='king'?<>{owned.has(detail.id)&&<strong>Nível {kingLevel(owned.get(detail.id)?.xp??0)} · {owned.get(detail.id)?.xp??0} XP</strong>}<SovereignStats values={effectiveKingStats(detail,owned.get(detail.id))} label="Stats deste rei"/></>:<small>Identifica seu império no mundo.</small>}
 {owned.has(detail.id)?<small>{detail.starter?'Inicial':owned.get(detail.id)?.source==='gems'?'Adquirido com Gemas':detail.kind==='equipment'?'Prêmio de temporada':'Na sua coleção'}</small>:detail.sale?<span className={styles.cost}><Gem size={17}/>{detail.price}</span>:<small>Conquistado no jogo</small>}
 </div>{error&&<p role="alert">{error}</p>}{detail.kind==='king'&&detail.id===data?.selectedId&&<p role="status">Selecionado para seus próximos mundos</p>}{detail.kind==='king'&&owned.has(detail.id)&&detail.id!==data?.selectedId&&<button type="button" className="primary-button" disabled={busy} onClick={async()=>{await select(detail);}}>Selecionar para próximos mundos</button>}<button type="button" disabled={busy} onClick={()=>setDetail(null)}>Voltar</button></CollectionDialog>}
 {statConfirm&&<CollectionDialog title="Adicionar +1%?" label="Confirmar ponto permanente" busy={busy} onClose={()=>setStatConfirm(null)}><p>{({administration:'Administração',command:'Comando',exploration:'Exploração'})[statConfirm.stat]} · {COLLECTION_PRODUCTS.find(p=>p.id===statConfirm.kingId)?.name}</p><p>Este ponto não poderá ser retirado. Vale nos próximos reinados.</p>{error&&<p role="alert">{error}</p>}<button type="button" className="primary-button" disabled={busy} onClick={statNeedsCheck?checkStatResult:addStat}>{busy?'Aguarde…':statNeedsCheck?'Conferir resultado':'Confirmar ponto'}</button><button type="button" disabled={busy} onClick={()=>setStatConfirm(null)}>Voltar</button></CollectionDialog>}
 {confirm&&<CollectionDialog title={confirm.name} label="Confirmar compra" busy={busy} onClose={()=>setConfirm(null)}><p>{confirm.price} Gemas · saldo após compra: {(data?.gems??0)-confirm.price}</p>{error&&<p role="alert">{error}</p>}<button type="button" className="primary-button" disabled={busy} onClick={buy}>{busy?'Comprando…':'Confirmar compra'}</button><button type="button" disabled={busy} onClick={()=>setConfirm(null)}>Voltar</button></CollectionDialog>}

 </section>;

}

