"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { COUNSELORS, HERO_ROLES } from "@/lib/cozy/catalog";
import type { CozyHeroRole, CozyPayload, CozyTile } from "@/lib/cozy/types";
import { COLLECTION_PRODUCTS, effectiveKingStats, type CollectionState } from "@/lib/collection";
import { collectionRequest } from "@/lib/collection-client";
import { SovereignStats } from "../profile/SovereignStats";
import { CrownButton, CrownCost } from "./CozyCrownUI";
import CozyMapArt from "./CozyMapArt";
import CozyMapScene from "./CozyMapScene";
import CozyArt from "./CozyArt";
import { counselorPortraits, heroPortraits } from "./cozy-portraits";
import { WorldCrestPicker } from "./WorldCrestPicker";
import { WorldEquipmentSlots } from "./WorldEquipmentSlots";
import type { CozyCommand } from "./useCozyWorld";
import styles from "./cozy-founding.module.css";

type Props = {
  data: CozyPayload;
  act: (command: CozyCommand) => Promise<boolean>;
  locked: boolean;
  feedback: ReactNode;
  now: number;
};

function readSiteDraft(key: string): { tileId: string | null; name: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null");
    if (saved && typeof saved.name === "string" && saved.name.length <= 32 &&
      (saved.tileId === null || /^-?\d{1,2},-?\d{1,2}$/.test(saved.tileId))) return saved;
  } catch { /* Resuming from the server remains available. */ }
  return { tileId: null, name: "" };
}

export default function CozyFounding({ data, act, locked, feedback, now }: Props) {
  const { state, computed, world } = data;
  const [collection, setCollection] = useState<CollectionState>();
  const [collectionError, setCollectionError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [kingId, setKingId] = useState("");
  const [role, setRole] = useState<CozyHeroRole>("engineer");
  const [equipment, setEquipment] = useState<string[]>(["", "", ""]);
  const [crestId, setCrestId] = useState("empire-crest-01");
  const [crestFinish, setCrestFinish] = useState<"plain" | "imperial">("plain");
  const draftKey = `kw-foundation:${world.id}:${state.playerId}`;
  const [draft] = useState(() => readSiteDraft(draftKey));
  const [tileId, setTileId] = useState(draft.tileId);
  const [center, setCenter] = useState(() => data.tiles.find(tile => tile.id === draft.tileId) ?? data.tiles[0] ?? state.founding!.origin);
  const [scale, setScale] = useState(1);
  const [name, setName] = useState(draft.name);
  const page = useRef<HTMLElement>(null);

  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify({ tileId, name })); } catch { /* Optional draft. */ }
  }, [draftKey, name, tileId]);

  const choosingKing = !state.king?.alive;
  useEffect(() => {
    if (!choosingKing) return;
    const controller = new AbortController();
    setCollectionError(false);
    collectionRequest<CollectionState>("/api/me/collection", { signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        setCollection(result);
        setKingId(result.selectedId);
      })
      .catch(() => { if (!controller.signal.aborted) setCollectionError(true); });
    return () => controller.abort();
  }, [choosingKing, attempt]);

  const sovereigns = COLLECTION_PRODUCTS.filter(product =>
    product.kind === "king" && collection?.inventory.some(item => item.id === product.id));
  const sovereign = sovereigns.find(product => product.id === kingId) ?? sovereigns[0];
  const owned = collection?.inventory.find(item => item.id === sovereign?.id);
  const hero = state.heroes.find(item => !item.cityId && !state.orders.some(order => order.heroId === item.id));
  const tile = data.tiles.find(item => item.id === tileId && item.foundation?.canFound)
    ?? data.tiles.find(item => item.foundation?.canFound);
  const courtReady = state.counselors.every(Boolean);
  const roleInfo = HERO_ROLES.find(entry => entry.id === role)!;
  const step = choosingKing ? 1 : hero ? 3 : 2;
  useEffect(() => { if (page.current) page.current.scrollTop = 0; }, [step]);

  function selectTile(next: CozyTile) {
    if (!next.foundation?.canFound) return;
    setTileId(next.id);
    setCenter(next);
  }

  function counselorChoices() {
    return (["political", "internal"] as const).map((seat, slot) => (
      <fieldset key={seat} disabled={locked}>
        <legend>{slot === 0 ? "Política" : "Vida do povo"}</legend>
        <div className={styles.compactChoices}>
          {COUNSELORS.filter(person => person.seat === seat).map(person => (
            <button type="button" key={person.id} aria-pressed={state.counselors[slot] === person.id}
              onClick={() => void act({ type: "counselor", slot: slot as 0 | 1, counselorId: person.id })}>
              <CozyArt src={counselorPortraits[person.id]} size={32}/>
              <span><strong>{person.name}</strong><small>{person.moral}</small></span>
            </button>
          ))}
        </div>
      </fieldset>
    ));
  }

  return (
    <main ref={page} className={styles.page} aria-label="Fundação da capital">
      <header className={styles.header}>
        <Link href="/lobby">Mundos</Link>
        <strong>{world.name}</strong>
        <CrownCost kind="gold" amount={state.resources.gold} />
      </header>
      {feedback}
      {computed.readOnly ? <p>Este mundo encerrou a entrada.</p> : choosingKing ? (
        <section className={styles.content}>
          <div className={styles.step}><h1>Escolha seu soberano</h1><span aria-label="Etapa 1 de 3">1/3</span></div>
          {collectionError && <CrownButton onClick={() => setAttempt(value => value + 1)}>Recarregar coleção</CrownButton>}
          {!collection && !collectionError && <p role="status">Abrindo sua coleção…</p>}
          {collection && !sovereign && <p role="alert">Sua coleção precisa de um soberano para começar.</p>}
          {sovereign && <>
            <div className={styles.choices} aria-label="Soberanos disponíveis">
              {sovereigns.map(product => <button key={product.id} type="button" disabled={locked}
                aria-pressed={sovereign.id === product.id} onClick={() => setKingId(product.id)}>
                <img src={product.image} alt="" />{product.name}
              </button>)}
            </div>
            <SovereignStats values={effectiveKingStats(sovereign, owned)} label="Atributos do soberano" />
            <details>
              <summary>Brasão e equipamentos</summary>
              <WorldCrestPicker value={crestId} finish={crestFinish} disabled={locked} onChange={(id, finish) => {
                setCrestId(id);
                setCrestFinish(finish);
              }} />
              <WorldEquipmentSlots value={equipment} onChange={setEquipment} disabled={locked} />
            </details>
            <CrownButton disabled={locked} onClick={() => void act({
              type: "king_choose", profileId: "builder", nickname: state.playerName, kingId: sovereign.id,
              statRevision: owned?.statRevision, crestId, crestFinish, equipment,
            })}>Escolher {sovereign.name}</CrownButton>
          </>}
        </section>
      ) : !hero ? (
        <section className={styles.content}>
          <div className={styles.step}><h1>Forme sua corte</h1><span aria-label="Etapa 2 de 3">2/3</span></div>
          {courtReady ? <details className={styles.courtSeats}>
            <summary>Conselheiros <span>{state.counselors.map(id => COUNSELORS.find(person => person.id === id)?.name).join(" · ")}</span></summary>
            {counselorChoices()}
          </details> : counselorChoices()}
          {courtReady && <fieldset disabled={locked}>
            <legend>Primeiro herói</legend>
            <div className={styles.compactChoices}>
              {HERO_ROLES.map(heroRole => <button type="button" key={heroRole.id} aria-pressed={role === heroRole.id}
                onClick={() => setRole(heroRole.id)}>
                <CozyArt src={heroPortraits[heroRole.id]} size={32}/>
                <strong>{heroRole.name}</strong>
              </button>)}
            </div>
            <p className={styles.heroBenefit} aria-live="polite">Na capital · {roleInfo.description.replace("Designado a uma cidade: ", "")}</p>
            <CrownButton disabled={locked || state.resources.gold < computed.heroCost}
              onClick={() => void act({ type: "hire", role })}>
              Contratar <CrownCost kind="gold" amount={computed.heroCost} />
            </CrownButton>
            {state.resources.gold < computed.heroCost && <p>Faltam {computed.heroCost - state.resources.gold} de ouro.</p>}
          </fieldset>}
        </section>
      ) : (
        <section className={styles.content}>
          <div className={styles.step}><h1>Onde nasce sua capital?</h1><span aria-label="Etapa 3 de 3">3/3</span></div>
          {tile ? <>
            <div className={styles.map}>
              <CozyMapScene data={data} center={center} onCenter={setCenter} onSelect={selectTile}
                onUnknown={() => {}} onChoose={tiles => tiles[0] && selectTile(tiles[0])}
                selectedId={tile.id} unknownCoord={null} selectionOpen={false} scale={scale} founding
                onScaleChange={setScale} now={now} />
            </div>
            <form className={styles.foundation} onSubmit={async event => {
              event.preventDefault();
              if (locked || !tile?.foundation?.canFound || name.trim().length < 2) return;
              setTileId(tile.id);
              if (await act({ type: "found_capital", q: tile.q, r: tile.r, name, heroId: hero.id })) {
                try { localStorage.removeItem(draftKey); } catch { /* Optional draft. */ }
              }
            }}>
              <div className={styles.site}>
                <CozyMapArt name="cityConstructionStage1" size={42}/>
                <span><strong>{tile.name}</strong><small>{tile.q}, {tile.r}</small></span>
              </div>
              <label>Nome da capital<input value={name} disabled={locked} required minLength={2} maxLength={32}
                placeholder="Ex. Vale Verde" onChange={event => setName(event.target.value)}/></label>
              <CrownButton type="submit" aria-label={`Fundar capital com ${hero.name}`} disabled={locked || name.trim().length < 2}>
                <CozyArt src={heroPortraits[hero.role]} size={26}/>
                <span>Fundar capital <small>{hero.name}</small></span>
              </CrownButton>
            </form>
          </> : <p role="status">Nenhum terreno disponível na região inicial.</p>}
        </section>
      )}
    </main>
  );
}
