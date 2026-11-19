import Link from "next/link";
import AccountNavigation from "@/components/AccountNavigation";
import CozyArt from "@/components/cozy/CozyArt";
import CozyAscensionMedals from "@/components/cozy/CozyAscensionMedals";
import page from "@/components/sovereign-page.module.css";
import {requireAuthenticatedAppUser} from "@/lib/app-user";
import {ASCENSION_MEDALS,ASCENSION_MEDAL_ART,type CozyAscensionHistory} from "@/lib/cozy/ascension-preview";
import {ASCENSION_PROOFS,ASCENSION_PROOF_LABELS} from "@/lib/cozy/ascension-rite";
import {SECTORS} from "@/lib/cozy/catalog";
import {COLLECTION_PRODUCTS} from "@/lib/collection";
import {looksLikeUuid,supabaseRpc} from "@/lib/supabase-rest";
import LegacyResultButton from "./LegacyResultButton";
import styles from "./legacy.module.css";

export const dynamic = "force-dynamic";

const date = new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium"});
const number = new Intl.NumberFormat("pt-BR");

export default async function LegacyPage({searchParams}:{searchParams:{before?:string}}) {
  const user = await requireAuthenticatedAppUser();
  const before = typeof searchParams.before==="string" && looksLikeUuid(searchParams.before) ? searchParams.before : null;
  const history = await supabaseRpc<CozyAscensionHistory>("kw_cozy_read_ascensions",{
    p_user_id:user.id,
    p_before_id:before,
  }).catch(()=>null);

  return <main className={page.page}><div className={page.stage}>
    <AccountNavigation active="inventory"/>
    <header className={styles.legacyCover}><h1 className={styles.title}>Legado</h1></header>
    {!history ? <div className={styles.empty} role="status">
      <p>Legado indisponível agora.</p>
      <Link href={before ? `/inventory/legacy?before=${before}` : "/inventory/legacy"}>Tentar novamente</Link>
    </div> : <>
      <CozyAscensionMedals medals={history.medals}/>
      <div className={styles.archive}>
        {history.receipts.map(receipt=>{
          const medal=ASCENSION_MEDALS.find(tier=>tier.id===receipt.medal);
          const prize=COLLECTION_PRODUCTS.find(item=>item.id===receipt.rewards.equipmentId);
          return <details key={receipt.id} className={styles.receipt}>
            <summary>
              <CozyArt src={ASCENSION_MEDAL_ART[receipt.medal]} size={42}/>
              <span><strong>{receipt.worldName}</strong><small>{receipt.sovereign} · {receipt.mode==="express"?"Expresso":"Normal"}</small></span>
              <span><b>{medal?.label}</b><time dateTime={new Date(receipt.completedAt).toISOString()}>{date.format(receipt.completedAt)}</time></span>
            </summary>
            <div className={styles.detail}>
              <LegacyResultButton receipt={{worldName:receipt.worldName,medal:receipt.medal,
                sovereign:receipt.sovereign,sovereignId:receipt.sovereignId,score:receipt.score,peak:receipt.peak,
                rewards:receipt.rewards}}/>
              <dl className={styles.figures}>
                <div><dt>Influência final</dt><dd>{number.format(receipt.score)}</dd></div>
                <div><dt>Recorde</dt><dd>{number.format(receipt.peak)}</dd></div>
                <div><dt>Gemas recebidas</dt><dd>+{number.format(receipt.rewards.creditedGems)}</dd></div>
              </dl>
              {receipt.rewards.refundOffset>0 && <p>{receipt.rewards.refundOffset} gemas repuseram o estorno.</p>}
              {receipt.rewards.conversionGems>0 && <p>+{receipt.rewards.conversionGems} gemas por raridade completa.</p>}
              {receipt.rewards.equipmentId && <Link className={styles.prize} href="/inventory?tab=equipment">
                <CozyArt src={prize?.image??"/icons/influence-legacy.png"} size={36}/>{prize?.name??"Equipamento"}
              </Link>}
              <h2>Reinado</h2>
              <p>{date.format(receipt.foundedAt)} – {date.format(receipt.completedAt)} · {receipt.milestones.length} marcos · {receipt.wonders.length} maravilhas</p>
              {receipt.proofs && <p>{ASCENSION_PROOFS.filter(proof=>receipt.proofs?.[proof]!==undefined)
                .map(proof=>ASCENSION_PROOF_LABELS[proof]).join(" · ")}</p>}
              <ul className={styles.cities}>{receipt.cities.map(city=><li key={city.id}>
                <strong>{city.name}</strong>{city.capital&&<small>Capital</small>}
                <span aria-label={SECTORS.map(sector=>`${sector.name} nível ${city.sectors[sector.id]}`).join(", ")}>
                  {SECTORS.reduce((sum,sector)=>sum+city.sectors[sector.id],0)}/50
                </span>
              </li>)}</ul>
            </div>
          </details>;
        })}
        {!history.receipts.length && <p className={styles.empty}>Nenhum reinado arquivado.</p>}
      </div>
      {(before || history.nextCursor) && <nav className={styles.paging} aria-label="Páginas do Legado">
        {before && <Link href="/inventory/legacy">Mais recentes</Link>}
        {history.nextCursor && <Link href={`/inventory/legacy?before=${history.nextCursor}`}>Mais antigos</Link>}
      </nav>}
    </>}
  </div></main>;
}
