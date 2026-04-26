"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { KingdomOverviewPanel } from "@/components/base/KingdomOverviewPanel";
import { mergeImperialVillages, useImperialState } from "@/lib/imperial-state";
import { useLiveWorld } from "@/lib/world-runtime";

export default function EmpirePage({ params }: { params: { worldId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { world } = useLiveWorld(params.worldId);
  const { imperialState, setImperialState } = useImperialState(params.worldId, world.villages);
  const villages = useMemo(() => mergeImperialVillages(world.villages, imperialState), [imperialState, world.villages]);
  const selectedVillageId = searchParams.get("v") ?? world.activeVillageId;
  const activeVillage = villages.find((village) => village.id === selectedVillageId) ?? villages[0];

  return (
    <KingdomOverviewPanel
      villages={villages}
      activeVillage={activeVillage}
      worldDay={world.day}
      worldPhase={world.phase}
      activeAlerts={world.activeAlerts}
      tribe={world.tribe}
      sovereignty={world.sovereignty}
      imperialState={imperialState}
      setImperialState={setImperialState}
      onOpenCityView={(villageId) => {
        const paramsString = new URLSearchParams(searchParams.toString());
        paramsString.set("v", villageId ?? activeVillage.id);
        paramsString.set("sb", "city");
        router.push(`/world/${params.worldId}/base?${paramsString.toString()}`);
      }}
    />
  );
}
