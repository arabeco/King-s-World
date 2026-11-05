"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {CollectionHub} from "../profile/CollectionHub";
import { ArrowRight, Crown, Medal, RefreshCw, Trophy } from "lucide-react";
import type { CozyAccount } from "@/lib/cozy/types";
import styles from "./cozy-account.module.css";
import {AccountAppearance} from "../profile/AccountAppearance";

type AccountData = {
  account: CozyAccount;
  victoryBadgeCount:number;
  history: {
    worldId: string;
    worldName: string;
    rank: number | null;
    score: number | null;
    xp: number;
    seal: boolean;
    trophy: boolean;
    finished: boolean;
  }[];
  hallOfFame: {
    worldId: string;
    worldName: string;
    playerName: string;
    score: number;
  }[];
};
export function CozyAccountPanel({username}:{username?:string}={}) {
  const [data, setData] = useState<AccountData | null>(null),
    [error, setError] = useState<string | null>(null);
  const [attempt,setAttempt]=useState(0),[loading,setLoading]=useState(true);
  useEffect(() => {
    const controller = new AbortController();
    let disposed=false;
    const timeout=window.setTimeout(()=>controller.abort(),20_000);
    setLoading(true);setError(null);
    void (async()=>{
      try{
        const response=await fetch("/api/me/cozy",{cache:"no-store",signal:controller.signal});
        const result=await response.json();
        if(disposed)return;
        if(!response.ok){setError(typeof result.error==="string"?result.error:"Não foi possível consultar seu histórico.");return;}
        setData(result);
      }catch{
        if(!disposed)setError(controller.signal.aborted?"A consulta demorou a responder. Tente novamente.":"Não foi possível consultar seu histórico. Confira a conexão e tente novamente.");
      }finally{window.clearTimeout(timeout);if(!disposed)setLoading(false);}
    })();
    return()=>{disposed=true;window.clearTimeout(timeout);controller.abort();};
  }, [attempt]);
  return (
    <section
      className={styles.root}
      data-profile={Boolean(username)||undefined}
      aria-label="Histórico da conta"
      aria-busy={loading}
    >
      {username?<CollectionHub mode="profile" username={username}/>:<div className={styles.sectionHeading}><h2>Suas jornadas</h2><Link href="/profile">Coleção de reis</Link></div>}
      {error ? (
        <div className={styles.recovery}><p role="status">{error}</p><button type="button" onClick={()=>setAttempt(value=>value+1)} disabled={loading}><RefreshCw size={16}/>Tentar consultar novamente</button></div>
      ) : !data || loading ? (
        <p role="status" className={styles.footnote}>Consultando as suas jornadas…</p>
      ) : (
        <>

          {!username&&<div className={styles.metrics}>
            <div>
              <small>Temporadas concluídas</small>
              <strong>{data.account.seasons}</strong>
              <small>
                {data.account.seasons} {data.account.seasons===1?"temporada":"temporadas"}
              </small>
            </div>
            <div>
              <small>Selos de Vitória</small>
              <strong>
                <Medal size={21} /> {data.account.seals}
              </strong>
            </div>
            <div>
              <small>Primeiros lugares</small>
              <strong>
                <Trophy size={21} /> {data.account.trophies}
              </strong>
            </div>
          </div>}
          {username&&<Link href="/premium">Coroa Premium</Link>}
          {username&&<h2 className={styles.legacyTitle}>Legado</h2>}
          <div className={styles.awards} aria-label="Coleção de temporada">
            {[
              {art:"victory-seal",name:"Insígnia de Vitória",count:data.victoryBadgeCount,rule:"Encerre uma temporada com o Selo de Vitória."},
              {art:"champion-cup",name:"Troféu do Campeão",count:data.account.trophies,rule:"Termine a temporada em primeiro lugar."}
            ].map(item=><details key={item.art} data-earned={item.count>0}>
              <summary aria-label={item.name+(item.count>0?` · ${item.count} obtido(s)`:" · bloqueado")}>
                <span className={styles.awardArt}><img src={"/rewards/"+item.art+".svg"} alt=""/>{item.count>1&&<b>×{item.count}</b>}</span><strong>{item.name}</strong>
                <small>{item.count>0?"Conquistado":"Bloqueado"}</small>
              </summary><p>{item.rule}</p>
            </details>)}
          </div>
          {data.history.length > 0 && (
            <details>
              <summary>Minhas temporadas <span>{data.history.length}</span></summary>
              <div className={styles.rankList}>
                {data.history.map((item) => (
                  <div key={item.worldId}>
                    <div>
                      <strong>{item.worldName}</strong>
                      <small>
                        {item.finished
                          ? `${item.rank===null?"Resultado registrado":`${item.rank}º lugar`}${item.score===null?"":` · ${item.score} Influência`}`
                          : "Selo de Vitória registrado; temporada em andamento"}
                      </small>
                      <Link href={`/world/${encodeURIComponent(item.worldId)}/intelligence`} aria-label={`Rever reino: ${item.worldName}`}>Rever reino <ArrowRight size={14}/></Link>
                    </div>
                    {item.seal && <Medal size={18} />}
                  </div>
                ))}
              </div>
            </details>
          )}
          {data.hallOfFame.length > 0 && (
            <details style={{ marginTop: 14 }}>
              <summary>Hall da Fama <span>{data.hallOfFame.length}</span></summary>
              <div className={styles.rankList}>
                {data.hallOfFame.map((item) => (
                  <div key={item.worldId}>
                    <Trophy size={18} />
                    <div>
                      <strong>{item.playerName}</strong>
                      <small>
                        {item.worldName} · {item.score} Influência
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}
