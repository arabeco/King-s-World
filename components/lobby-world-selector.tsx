"use client";

import {seasonDisplay} from "@/lib/cozy/season-display";
import { KeyRound, Lock, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import { SectionCard, StatusBadge } from "@/components/ui";
import Link from "next/link";
import type { WorldSummary } from "@/lib/mock-data";
import styles from "./lobby.module.css";

type DiscoverableWorld = {slug:string;name:string;status:string;mode:string;combatMode?:"cozy"|"competitive";capacity:number;players:number;startsAt:string;locked:boolean};

function rememberWorld(key:string,value:string){try{window.localStorage.setItem(key,value);}catch{/* Remembering a selection must never block entering a world. */}}
function worldDay(world: DiscoverableWorld): number {
  if (world.status === "open") return 0;
  const start = Date.parse(world.startsAt);
  const duration = world.mode === "express" ? 30 : 120;
  return Number.isFinite(start) ? Math.min(duration, Math.max(1, Math.floor((Date.now()-start)/86_400_000)+1)) : 0;
}

function hrefForWorld(world: WorldSummary): string {
  if (world.status === "Finalizado") return `/world/${world.id}/report`;
  return `/world/${world.id}/${world.status === "Em Andamento" ? "intelligence" : "empire"}`;
}

function toneForWorld(world: WorldSummary): "success" | "neutral" | "warning" {
  if (world.status === "Em Andamento") return "success";
  if (world.status === "Finalizado") return "neutral";
  return "warning";
}

export function LobbyWorldSelector({
  username,
  worlds,
}: {
  username: string;
  worlds: WorldSummary[];
}) {
  const router = useRouter();
  const [view,setView]=useState<"mine"|"search"|"create">(worlds.length?"mine":"create");
  const firstPlayableWorld = worlds.find((world) => world.rulesVersion === 2 && world.status !== "Finalizado") ?? worlds.find(world=>world.rulesVersion===2) ?? worlds[0] ?? null;
  const storageKey = `kw:last-world:${username}`;
  const [selectedWorldId, setSelectedWorldId] = useState(firstPlayableWorld?.id ?? "");
  const [creatingWorld, setCreatingWorld] = useState(false);
  const [createWorldError, setCreateWorldError] = useState<string | null>(null);
  const [newWorldName, setNewWorldName] = useState("");
  const [combatMode,setCombatMode]=useState<"cozy"|"competitive">("cozy");
  const [worldMode, setWorldMode] = useState<"normal" | "express">("express");
  const [createdWorld, setCreatedWorld] = useState<{ code: string; href: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [benefits,setBenefits]=useState<{active:boolean;worldLimit:number;activeWorlds:number;canCreate:boolean;canPasswordWorld:boolean}|null>(null);
  const [joinPassword, setJoinPassword] = useState("");
  const [searchWorld, setSearchWorld] = useState("");
  const [directory, setDirectory] = useState<DiscoverableWorld[]>([]);
  const [directoryError, setDirectoryError] = useState(false);
  const [selectedDiscovery, setSelectedDiscovery] = useState<DiscoverableWorld | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joiningCode, setJoiningCode] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const selectedWorld = useMemo(
    () => worlds.find((world) => world.id === selectedWorldId) ?? firstPlayableWorld,
    [firstPlayableWorld, selectedWorldId, worlds],
  );

  const duration=selectedWorld?.durationDays??(selectedWorld?.seasonMode==='express'?30:120);
  const speed=selectedWorld?.speedMultiplier??(selectedWorld?.seasonMode==='express'&&duration===120?4:1);
  const calendar=seasonDisplay(selectedWorld?.day??0,duration,duration/Math.max(1,speed));
  useEffect(() => {
    let savedWorldId:string|null=null;try{savedWorldId=window.localStorage.getItem(storageKey);}catch{/* Optional selection preference. */}
    if (savedWorldId && worlds.some((world) => world.id === savedWorldId && world.rulesVersion === 2)) {
      setSelectedWorldId(savedWorldId);
    }
  }, [storageKey, worlds]);

  useEffect(() => {
    let active = true;
    fetch("/api/me/entitlements",{cache:"no-store"}).then(async response=>{
      if(response.ok){const result=await response.json();if(active&&result.benefits)setBenefits(result.benefits);}
    }).catch(()=>undefined);
    fetch("/api/worlds/discover", {cache:"no-store"}).then(async response => {
      if (!response.ok) throw new Error("directory");
      const result = await response.json();
      if (active) setDirectory(result.worlds);
    }).catch(() => { if (active) setDirectoryError(true); });
    return () => { active = false; };
  }, []);
  const filteredWorlds = directory.filter(world => world.name.toLocaleLowerCase("pt-BR").includes(searchWorld.trim().toLocaleLowerCase("pt-BR")));

  const enterWorld = () => {
    if (!selectedWorld) return;
    rememberWorld(storageKey, selectedWorld.id);
    startTransition(() => {
      router.push(hrefForWorld(selectedWorld));
    });
  };

  const createTestWorld = async (mode: "classic" | "express") => {
    setCreatingWorld(true);
    setCreateWorldError(null);
    try {
      const response = await fetch("/api/worlds/alpha", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const payload = (await response.json()) as { world?: { slug?: string; href?: string }; error?: string };
      if (!response.ok || !payload.world?.href) {
        throw new Error(payload.error ?? "Nao foi possivel criar a campanha Alpha.");
      }
      if (payload.world.slug) {
        rememberWorld(storageKey, payload.world.slug);
      }
      router.push(payload.world.href);
      router.refresh();
    } catch (error) {
      setCreateWorldError(error instanceof Error ? error.message : "Nao foi possivel criar a campanha Alpha.");
    } finally {
      setCreatingWorld(false);
    }
  };

  const createWorld = async () => {
    const name = newWorldName.trim();
    if (name.length < 2) {
      setCreateWorldError("Dê um nome ao mundo (mín. 2 letras).");
      return;
    }
    setCreatingWorld(true);
    setCreateWorldError(null);
    try {
      const response = await fetch("/api/worlds/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, mode: worldMode, combatMode, password: newPassword }),
      });
      const payload = (await response.json()) as { world?: { joinCode?: string; href?: string }; error?: string };
      if (!response.ok || !payload.world?.href) {
        throw new Error(payload.error ?? "Não foi possível criar o mundo.");
      }
      setCreatedWorld({ code: payload.world.joinCode ?? "", href: payload.world.href });
    } catch (error) {
      setCreateWorldError(error instanceof Error ? error.message : "Não foi possível criar o mundo.");
    } finally {
      setCreatingWorld(false);
    }
  };

  const enterCreatedWorld = () => {
    if (!createdWorld) return;
    startTransition(() => {
      router.push(createdWorld.href);
      router.refresh();
    });
  };

  const joinByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code && !selectedDiscovery) return;
    setJoiningCode(true);
    setJoinError(null);
    try {
      const response = await fetch("/api/worlds/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(selectedDiscovery ? {slug:selectedDiscovery.slug,password:joinPassword} : {code,password:joinPassword}),
      });
      const payload = (await response.json()) as { world?: { slug?: string; href?: string }; error?: string };
      if (!response.ok || !payload.world?.href) {
        throw new Error(payload.error ?? "Código inválido.");
      }
      if (payload.world.slug) {
        rememberWorld(storageKey, payload.world.slug);
      }
      router.push(payload.world.href);
      router.refresh();
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Código inválido.");
    } finally {
      setJoiningCode(false);
    }
  };

  return (
    <div className={styles.worlds}>
      <nav className={styles.tabs} aria-label="Mundos"><button type="button" aria-pressed={view==="mine"} onClick={()=>setView("mine")}>Meus mundos</button><button type="button" aria-pressed={view==="search"} onClick={()=>setView("search")}>Buscar</button><button type="button" aria-pressed={view==="create"} onClick={()=>setView("create")}>Criar</button></nav>
      {view==="mine"&&<>
      <SectionCard title="Seus mundos" className="lobby-card lobby-card--entry">
        <div className="form-stack">
          {worlds.length>0&&<label className={worlds.length===1&&process.env.NODE_ENV==="production"?styles.onlyWorld:undefined}>
          <span className="list-meta">Trocar mundo</span>
          <select
            aria-label="Trocar mundo"
            value={selectedWorldId}
            onChange={(event) => setSelectedWorldId(event.target.value)}
            data-smoke="lobby-world-picker"
          >
            {worlds.map((world) => (
              <option key={world.id} value={world.id}>
                {world.name}
              </option>
            ))}
          </select></label>}

          {!selectedWorld ? (
            <div className="world-card lobby-compact-card" style={{ background: "rgba(120,53,15,0.24)", borderColor: "rgba(251,191,36,0.28)", textAlign: "center" }}>
              <strong>Seu próximo reino começa aqui</strong>
              <button type="button" className="primary-button" onClick={()=>setView("create")}>Criar meu mundo</button><button type="button" className="secondary-button" onClick={()=>setView("search")}>Buscar um mundo</button>
            </div>
          ) : null}

          {selectedWorld ? (
            <div className="world-card lobby-compact-card lobby-selected-world" style={{ background: "rgba(2,6,23,0.46)", borderColor: "rgba(255,255,255,0.16)" }}>
              <div className="card-row">
                <div>
                  <strong>{selectedWorld.name}</strong>
                  <p className="list-meta">
                    {selectedWorld.seasonMode==='express'?'Expresso':'Normal'} · {selectedWorld.status==='Em Aberto'?'Aguardando abertura':`Dia ${calendar.day}/${calendar.duration} reais`} · {selectedWorld.players} {selectedWorld.players===1?'jogador':'jogadores'}
                  </p>
                </div>
                <StatusBadge label={selectedWorld.status} tone={toneForWorld(selectedWorld)} />
              </div>
            </div>
          ) : null}

          {selectedWorld&&<button className="primary-button" type="button" onClick={enterWorld} data-smoke="lobby-enter-world">
            {selectedWorld?.status === "Finalizado" ? "Ver resultado" : selectedWorld?.status === "Em Andamento" ? "Continuar reinado" : "Entrar no mundo"}
          </button>}
          {process.env.NODE_ENV !== "production" ? (
            <div className="inline-actions lobby-dev-actions">
              <button className="secondary-button" type="button" onClick={() => createTestWorld("classic")} disabled={creatingWorld} data-smoke="create-test-world">
                {creatingWorld ? "Criando..." : "Alpha clássica (legado)"}
              </button>
              <button className="secondary-button" type="button" onClick={() => createTestWorld("express")} disabled={creatingWorld} data-smoke="create-express-world">
                {creatingWorld ? "Criando..." : "Alpha expressa (legado)"}
              </button>
            </div>
          ) : null}
          {createWorldError ? <p role="alert" className="list-meta">{createWorldError}</p> : null}
        </div>
      </SectionCard>

      </>}
      {view==="create"&&<SectionCard title="Criar mundo novo" accent="gold" className="lobby-card lobby-card--join lobby-card--create">
        <div className="form-stack">
          {benefits&&<div className="card-row"><strong>{benefits.activeWorlds}/{benefits.worldLimit} mundos ativos</strong><Link href="/premium">{benefits.active?'Premium':'Ver Premium'}</Link></div>}
          {createdWorld ? (
            <>
              <p className="list-meta">Mundo criado! Compartilhe o código pra convidar:</p>
              <div className="inline-actions" style={{ alignItems: "center" }}>
                <input
                  type="text"
                  readOnly
                  value={createdWorld.code}
                  onFocus={(e) => e.target.select()}
                  style={{ letterSpacing: "0.1em", fontWeight: 800, flex: 1 }}
                />
                <button className="primary-button" type="button" onClick={enterCreatedWorld} data-smoke="enter-created-world">
                  Entrar no mundo
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="inline-actions">
                <button
                  type="button"
                  className={worldMode === "normal" ? "primary-button" : "secondary-button"}
                  onClick={() => setWorldMode("normal")}
                  style={{ flex: 1 }}
                  data-smoke="create-world-normal"
                >
                  Clássico · 120 dias reais
                </button>
                <button
                  type="button"
                  className={worldMode === "express" ? "primary-button" : "secondary-button"}
                  onClick={() => setWorldMode("express")}
                  style={{ flex: 1 }}
                  data-smoke="create-world-express"
                >
                  Expresso · 30 dias reais
                </button>
              </div>
              <div className="inline-actions" role="group" aria-label="Confrontos no mundo"><button type="button" disabled={creatingWorld} aria-pressed={combatMode==='cozy'} className={combatMode==='cozy'?'primary-button':'secondary-button'} onClick={()=>setCombatMode('cozy')}>Cozy · sem PvP</button><button type="button" disabled={creatingWorld} aria-pressed={combatMode==='competitive'} className={combatMode==='competitive'?'primary-button':'secondary-button'} onClick={()=>setCombatMode('competitive')}>Competitivo · PvP</button></div>
              {combatMode==='competitive'&&<p className="list-meta" role="status">Cidades e capital podem ser conquistadas. Perder a última cidade encerra seu império nesse mundo.</p>}
              <input type="password" autoComplete="new-password" placeholder="Senha opcional · Premium" aria-label="Senha opcional do mundo" disabled={benefits!==null&&!benefits.canPasswordWorld} value={newPassword} maxLength={64} onChange={event=>setNewPassword(event.target.value)}/>
              <div className="inline-actions" style={{ alignItems: "flex-start" }}>
                <input
                  type="text"
                  aria-label="Nome do novo mundo"
                  placeholder="Nome do mundo"
                  value={newWorldName}
                  maxLength={40}
                  onChange={(e) => setNewWorldName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createWorld()}
                  style={{ flex: 1 }}
                  data-smoke="create-world-name"
                />
                <button
                  className="primary-button"
                  type="button"
                  onClick={createWorld}
                  disabled={creatingWorld || newWorldName.trim().length < 2 || benefits?.canCreate===false}
                  data-smoke="create-world-submit"
                >
                  {creatingWorld ? "Criando..." : "Criar"}
                </button>
              </div>
              {createWorldError ? <p role="alert" className="list-meta" style={{ color: "#fecaca" }}>{createWorldError}</p> : null}
            </>
          )}
        </div>
      </SectionCard>}
      {view==="search"&&<>
      <SectionCard title="Buscar mundos" eyebrow="Temporadas" accent="gold" className="lobby-card lobby-card--join lobby-card--discover">
        <div className="form-stack">
          <label htmlFor="world-search">Nome do mundo</label>
          <div className="inline-actions"><Search size={19}/><input id="world-search" type="search" value={searchWorld} onChange={event=>setSearchWorld(event.target.value)} placeholder="Buscar mundo" /></div>
          {directoryError && <p role="status">A busca está indisponível. Você ainda pode entrar com um código.</p>}
          {!directoryError && !filteredWorlds.length && <p>Nenhum mundo encontrado.</p>}
          {filteredWorlds.map(world=><button key={world.slug} type="button" className="world-card lobby-compact-card" onClick={()=>{setSelectedDiscovery(world);setJoinPassword("");setJoinError(null);}} style={{textAlign:"left"}}>
            <strong>{world.name} {world.locked && <Lock size={15} aria-label="Com senha"/>}</strong>
            <span className="list-meta" style={{display:"block"}}>{world.mode==="express"?"Expresso · 30 dias":"Clássico · 120 dias"} · {world.players}/{world.capacity} jogadores · {world.status==="open"?"Aguardando":`Dia ${worldDay(world)}`} · {world.combatMode==='competitive'?'Competitivo · PvP':'Cozy · sem PvP'}</span>
          </button>)}
          {selectedDiscovery && <div className="world-card lobby-compact-card"><strong>{selectedDiscovery.name}</strong><p className="list-meta">{selectedDiscovery.locked ? "Senha necessária" : "Entrada sem senha"}</p>
            {selectedDiscovery.locked && <input type="password" autoComplete="off" aria-label="Senha do mundo" value={joinPassword} maxLength={64} onChange={event=>setJoinPassword(event.target.value)}/>}
            <button type="button" className="primary-button" disabled={joiningCode || (selectedDiscovery.locked && !joinPassword)} onClick={joinByCode}>Entrar no mundo</button>
            <button type="button" className="secondary-button" onClick={()=>{setSelectedDiscovery(null);setJoinError(null);}}>Voltar</button>
            {joinError && <p role="alert">{joinError}</p>}
          </div>}
        </div>
      </SectionCard>

      <SectionCard title="Entrar por código" eyebrow="Beta" accent="gold" className="lobby-card lobby-card--join">
        <div className="form-stack">
          <p className="list-meta">Código do mundo</p>
          <div className="inline-actions" style={{ alignItems: "flex-start" }}>
            <input
              type="text"
              placeholder="KW-XXXXXX"
              value={joinCode}
              maxLength={9}
              onChange={(e) => {setJoinCode(e.target.value.toUpperCase());setSelectedDiscovery(null);}}
              onKeyDown={(e) => e.key === "Enter" && joinByCode()}
              style={{ letterSpacing: "0.1em", fontWeight: 700, flex: 1 }}
              onFocus={() => setSelectedDiscovery(null)}
              data-smoke="join-code-input"
            />
            <button
              className="primary-button"
              type="button"
              onClick={joinByCode}
              disabled={joiningCode || !joinCode.trim()}
              data-smoke="join-code-submit"
            >
              {joiningCode ? "Buscando..." : <><KeyRound size={15} /> Entrar</>}
            </button>
          </div>
          <input type="password" autoComplete="off" placeholder="Senha, se houver" aria-label="Senha para entrar por código" value={joinPassword} maxLength={64} onChange={event=>setJoinPassword(event.target.value)}/>
          {joinError && !selectedDiscovery ? <p role="alert" className="list-meta" style={{ color: "#fecaca" }}>{joinError}</p> : null}
        </div>
      </SectionCard>

      </>}
    </div>
  );
}
