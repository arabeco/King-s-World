"use client";

import { Crown, KeyRound, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import { SectionCard, StatusBadge } from "@/components/ui";
import type { WorldSummary } from "@/lib/mock-data";

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
  const firstPlayableWorld = worlds.find((world) => world.status !== "Finalizado") ?? worlds[0] ?? null;
  const hasPlayableWorld = worlds.some((world) => world.status !== "Finalizado");
  const storageKey = `kw:last-world:${username}`;
  const [selectedWorldId, setSelectedWorldId] = useState(firstPlayableWorld?.id ?? "");
  const [creatingWorld, setCreatingWorld] = useState(false);
  const [createWorldError, setCreateWorldError] = useState<string | null>(null);
  const [newWorldName, setNewWorldName] = useState("");
  const [createdWorld, setCreatedWorld] = useState<{ code: string; href: string } | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joiningCode, setJoiningCode] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const selectedWorld = useMemo(
    () => worlds.find((world) => world.id === selectedWorldId) ?? firstPlayableWorld,
    [firstPlayableWorld, selectedWorldId, worlds],
  );

  useEffect(() => {
    const savedWorldId = window.localStorage.getItem(storageKey);
    if (savedWorldId && worlds.some((world) => world.id === savedWorldId)) {
      setSelectedWorldId(savedWorldId);
    }
  }, [storageKey, worlds]);

  const enterWorld = () => {
    if (!selectedWorld) return;
    window.localStorage.setItem(storageKey, selectedWorld.id);
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
        window.localStorage.setItem(storageKey, payload.world.slug);
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
        body: JSON.stringify({ name }),
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
    if (!code) return;
    setJoiningCode(true);
    setJoinError(null);
    try {
      const response = await fetch("/api/worlds/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = (await response.json()) as { world?: { slug?: string; href?: string }; error?: string };
      if (!response.ok || !payload.world?.href) {
        throw new Error(payload.error ?? "Código inválido.");
      }
      if (payload.world.slug) {
        window.localStorage.setItem(storageKey, payload.world.slug);
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
    <div className="dashboard-grid lobby-world-grid">
      <SectionCard title={username} eyebrow="Sua conta" mediaSrc="/images/card-premium.jpg" accent="gold" className="lobby-card lobby-card--account">
        <div className="world-card lobby-compact-card" style={{ background: "rgba(2,6,23,0.42)", borderColor: "rgba(255,255,255,0.16)" }}>
          <div className="card-row">
            <div>
              <strong>Passe da Coroa</strong>
              <p className="list-meta">Progresso de conta, cosmeticos e reis desbloqueaveis.</p>
            </div>
            <StatusBadge label="Teste" tone="warning" />
          </div>
          <div className="metric-grid lobby-metric-grid" style={{ marginTop: "1rem" }}>
            <div>
              <span>Nivel</span>
              <strong>1</strong>
            </div>
            <div>
              <span>Temporada</span>
              <strong>Alpha</strong>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Entrar no mundo" eyebrow="Seletor" mediaSrc="/images/capital.jpg" className="lobby-card lobby-card--entry">
        <div className="form-stack">
          <label className="list-meta" htmlFor="lobby-world-picker">
            Mundo ativo da campanha
          </label>
          <select
            id="lobby-world-picker"
            value={selectedWorldId}
            onChange={(event) => setSelectedWorldId(event.target.value)}
            data-smoke="lobby-world-picker"
          >
            {worlds.map((world) => (
              <option key={world.id} value={world.id}>
                {world.name} - {world.status} - Dia {world.day}
              </option>
            ))}
          </select>

          {!hasPlayableWorld ? (
            <div className="world-card lobby-compact-card" style={{ background: "rgba(120,53,15,0.24)", borderColor: "rgba(251,191,36,0.28)", textAlign: "center" }}>
              <strong>Todos os mundos estao arquivados</strong>
              <p className="list-meta">Voce ainda pode abrir o relatorio/leitura. Para jogar uma campanha nova, precisamos criar ou reativar um mundo no Supabase.</p>
            </div>
          ) : null}

          {selectedWorld ? (
            <div className="world-card lobby-compact-card lobby-selected-world" style={{ background: "rgba(2,6,23,0.46)", borderColor: "rgba(255,255,255,0.16)" }}>
              <div className="card-row">
                <div>
                  <strong>{selectedWorld.name}</strong>
                  <p className="list-meta">
                    Dia {selectedWorld.day}/{selectedWorld.durationDays ?? 120} - {selectedWorld.phase} - x{selectedWorld.speedMultiplier ?? 1} - {selectedWorld.players} jogadores
                  </p>
                </div>
                <StatusBadge label={selectedWorld.status} tone={toneForWorld(selectedWorld)} />
              </div>
            </div>
          ) : null}

          <button className="primary-button" type="button" onClick={enterWorld} disabled={!selectedWorld} data-smoke="lobby-enter-world">
            {selectedWorld?.status === "Finalizado" ? "Ver relatorio" : "Entrar"}
          </button>
          {process.env.NODE_ENV !== "production" ? (
            <div className="inline-actions lobby-dev-actions">
              <button className="secondary-button" type="button" onClick={() => createTestWorld("classic")} disabled={creatingWorld} data-smoke="create-test-world">
                {creatingWorld ? "Criando..." : "Alpha classica"}
              </button>
              <button className="secondary-button" type="button" onClick={() => createTestWorld("express")} disabled={creatingWorld} data-smoke="create-express-world">
                {creatingWorld ? "Criando..." : "Alpha expressa x4"}
              </button>
            </div>
          ) : null}
          {createWorldError ? <p role="alert" className="list-meta">{createWorldError}</p> : null}
        </div>
      </SectionCard>

      <SectionCard title="Criar mundo" eyebrow="Novo" accent="gold" className="lobby-card lobby-card--join">
        <div className="form-stack">
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
              <p className="list-meta">Crie seu mundo — você vira o dono e começa quando quiser.</p>
              <div className="inline-actions" style={{ alignItems: "flex-start" }}>
                <input
                  type="text"
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
                  disabled={creatingWorld || newWorldName.trim().length < 2}
                  data-smoke="create-world-submit"
                >
                  {creatingWorld ? "Criando..." : "Criar"}
                </button>
              </div>
              {createWorldError ? <p role="alert" className="list-meta" style={{ color: "#fecaca" }}>{createWorldError}</p> : null}
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Entrar por código" eyebrow="Beta" accent="gold" className="lobby-card lobby-card--join">
        <div className="form-stack">
          <p className="list-meta">Recebeu um código de acesso? Cola aqui e entra direto no mundo.</p>
          <div className="inline-actions" style={{ alignItems: "flex-start" }}>
            <input
              type="text"
              placeholder="KW-XXXXXX"
              value={joinCode}
              maxLength={9}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && joinByCode()}
              style={{ letterSpacing: "0.1em", fontWeight: 700, flex: 1 }}
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
          {joinError ? <p role="alert" className="list-meta" style={{ color: "#fecaca" }}>{joinError}</p> : null}
        </div>
      </SectionCard>

      <SectionCard title="Atalhos" eyebrow="Conta" accent="cyan" className="lobby-card lobby-card--shortcuts">
        <div className="world-card lobby-compact-card lobby-flow-card" style={{ marginBottom: "1rem", background: "rgba(2,6,23,0.42)", borderColor: "rgba(255,255,255,0.14)" }}>
          <strong>Fluxo da campanha</strong>
          <p className="list-meta">Entrar no mundo - escolher a Coroa - evoluir a Capital - explorar o mapa - fechar 1500 de influencia.</p>
        </div>
        <div className="metric-grid lobby-metric-grid">
          <div>
            <span>Premium</span>
            <strong>
              <Sparkles aria-hidden="true" size={18} /> Android
            </strong>
          </div>
          <div>
            <span>Legado</span>
            <strong>
              <Trophy aria-hidden="true" size={18} /> 0
            </strong>
          </div>
          <div>
            <span>Conta</span>
            <strong>
              <ShieldCheck aria-hidden="true" size={18} /> OK
            </strong>
          </div>
          <div>
            <span>Coroa</span>
            <strong>
              <Crown aria-hidden="true" size={18} /> Livre
            </strong>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
