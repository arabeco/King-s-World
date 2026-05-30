"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import { emitUiFeedback } from "@/lib/ui-feedback";

const tabs = [
  { key: "empire", label: "Império", iconSrc: "/icons/nav-empire.png", center: false },
  { key: "base", label: "Cidades", iconSrc: "/icons/nav-cities.png", center: false },
  { key: "intelligence", label: "Comando", iconSrc: "/icons/nav-intel.png", center: true },
  { key: "board", label: "Mundo", iconSrc: "/icons/nav-world.png", center: false },
  { key: "guide", label: "Perfil", iconSrc: "/icons/nav-profile.png", center: false },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function BottomNavigation({
  worldId,
  activeTab,
  villageId,
  evolutionMode,
}: {
  worldId: string;
  activeTab: TabKey;
  villageId: string;
  evolutionMode?: string | null;
}) {
  const router = useRouter();
  const [optimisticTab, setOptimisticTab] = useState<TabKey>(activeTab);

  useEffect(() => {
    setOptimisticTab(activeTab);
  }, [activeTab]);

  const hrefByTab = useMemo(() => {
    const entries = new Map<TabKey, string>();
    for (const tab of tabs) {
      const params = new URLSearchParams();
      params.set("v", villageId);
      if (evolutionMode) {
        params.set("m", evolutionMode);
      }
      entries.set(tab.key, `/world/${worldId}/${tab.key}?${params.toString()}`);
    }
    return entries;
  }, [evolutionMode, villageId, worldId]);

  useEffect(() => {
    for (const tab of tabs) {
      const href = hrefByTab.get(tab.key);
      if (href) {
        router.prefetch(href);
      }
    }
  }, [hrefByTab, router]);

  const navigate = (tabKey: TabKey) => {
    const href = hrefByTab.get(tabKey);
    if (!href) {
      return;
    }

    setOptimisticTab(tabKey);
    emitUiFeedback(tabKey === activeTab ? "tap" : "route", tabKey === activeTab ? "light" : "medium");
    if (tabKey === activeTab) {
      return;
    }

    startTransition(() => {
      router.push(href, { scroll: false });
    });
  };

  return (
    <nav
      aria-label="Navegacao principal do mundo"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(4px+env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto w-full max-w-md">
        <div className="kw-hud-panel relative rounded-[22px] px-1.5 py-1">
          <div className="grid grid-cols-5 items-center gap-0.5">
            {tabs.map((tab) => {
              const isActive = tab.key === optimisticTab;

              if (tab.center) {
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => navigate(tab.key)}
                    aria-current={isActive ? "page" : undefined}
                    className={`kw-hud-medallion mx-auto flex h-[54px] w-[54px] flex-col items-center justify-center rounded-full text-white transition active:scale-95 ${
                      isActive ? "text-amber-50" : "text-cyan-100/90"
                    }`}
                  >
                    <img src={tab.iconSrc} alt="" className="h-9 w-9 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]" />
                    <span className="mt-0.5 text-[8px] font-bold tracking-[0.02em]">CMD</span>
                  </button>
                );
              }

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => navigate(tab.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={`world-nav__link flex min-w-[50px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[8px] font-semibold transition active:scale-95 ${
                    isActive
                      ? "world-nav__link--active"
                      : "hover:text-white"
                  }`}
                >
                  <img src={tab.iconSrc} alt="" className="h-6 w-6 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]" />
                  <span className="leading-none">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
