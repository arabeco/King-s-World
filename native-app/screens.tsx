import { useEffect, useState, type ReactNode } from "react";

import AccountNavigation from "@/components/AccountNavigation";
import { AuthSignOutButton } from "@/components/auth-signout-button";
import { CozyWorldClient } from "@/components/cozy/CozyWorldClient";
import LobbyAccountBanner from "@/components/LobbyAccountBanner";
import { LobbyWorldSelector } from "@/components/lobby-world-selector";
import lobbyStyles from "@/components/lobby.module.css";
import { PremiumPaywallCard } from "@/components/premium-paywall-card";
import { ProfileClient } from "@/components/profile-client";
import { CollectionHub } from "@/components/profile/CollectionHub";
import pageStyles from "@/components/sovereign-page.module.css";
import type { WorldSummary } from "@/lib/mock-data";

import { useLocation } from "./router";

type LobbyData = { username: string; worlds: WorldSummary[]; persistentPreview: boolean };

const cacheKey = (name: string) => `kw-app-cache:${name}`;

function readCache<T>(name: string): T | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(name));
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function writeCache(name: string, value: unknown) {
  try { window.localStorage.setItem(cacheKey(name), JSON.stringify(value)); } catch { /* cache is optional */ }
}

export function clearScreenCache() {
  try {
    for (const key of Object.keys(window.localStorage)) if (key.startsWith("kw-app-cache:")) window.localStorage.removeItem(key);
  } catch { /* cache is optional */ }
}

/**
 * Shows the last known data right away (like Elite/Glyph) and refreshes it from the server.
 * `tick` changes when a screen calls router.refresh().
 */
function useScreenData<T>(name: string, path: string, tick: number): { data: T | null; error: string | null; retry: () => void } {
  const [data, setData] = useState<T | null>(() => readCache<T>(name));
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    fetch(path, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "O reino não respondeu. Tente novamente.");
        return body as T;
      })
      .then((next) => {
        if (!active) return;
        setData(next);
        writeCache(name, next);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "O reino não respondeu.");
      });
    return () => { active = false; };
  }, [name, path, tick, attempt]);
  return { data, error, retry: () => setAttempt((value) => value + 1) };
}

function ScreenMessage({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return <main className={lobbyStyles.page}><div className={lobbyStyles.stage}>
    <h1 className={lobbyStyles.brand}>KING’S WORLD</h1>
    <p role="status" style={{ textAlign: "center", marginTop: 32 }}>{children}</p>
    {onRetry && <button type="button" className="primary-button" onClick={onRetry} style={{ margin: "16px auto", display: "block" }}>Tentar novamente</button>}
  </div></main>;
}

export function LobbyScreen() {
  const { tick } = useLocation();
  const { data, error, retry } = useScreenData<LobbyData>("lobby", "/api/lobby", tick);
  if (!data) return <ScreenMessage onRetry={error ? retry : undefined}>{error ?? "Abrindo seus mundos…"}</ScreenMessage>;
  return <main className={lobbyStyles.page}><div className={lobbyStyles.stage}>
    <h1 className={lobbyStyles.brand}>KING’S WORLD</h1>
    <AccountNavigation active="worlds" />
    <LobbyAccountBanner username={data.username} />
    <LobbyWorldSelector key={data.worlds.map((world) => world.id).join(",")} username={data.username} worlds={data.worlds} persistentPreview={data.persistentPreview} />
    {error && <p role="status" className="list-meta" style={{ textAlign: "center" }}>Sem conexão agora. Mostrando seus últimos dados.</p>}
    <footer className={lobbyStyles.footer}><AuthSignOutButton /></footer>
  </div></main>;
}

export function WorldScreen({ worldId }: { worldId: string }) {
  return <CozyWorldClient worldId={worldId} />;
}

export function ProfileScreen() {
  const { tick } = useLocation();
  const { data, error, retry } = useScreenData<{ profile: { username: string } }>("profile", "/api/me/profile", tick);
  if (!data) return <ScreenMessage onRetry={error ? retry : undefined}>{error ?? "Abrindo seu perfil…"}</ScreenMessage>;
  return <ProfileClient initialUsername={data.profile.username} />;
}

export function InventoryScreen() {
  const { search } = useLocation();
  const season = new URLSearchParams(search).get("season") ?? undefined;
  return <main className={pageStyles.page}><div className={pageStyles.stage}>
    <AccountNavigation active="inventory" />
    <h1>Inventário</h1>
    <CollectionHub mode="inventory" seasonId={season} />
  </div></main>;
}

export function PremiumScreen() {
  return <main className={pageStyles.page}>
    <AccountNavigation active="shop" />
    <CollectionHub mode="shop" />
    <PremiumPaywallCard />
  </main>;
}
