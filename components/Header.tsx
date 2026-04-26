"use client";

import { Check, ChevronDown, Crown, Pencil } from "lucide-react";
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { CITY_CLASS_META, type CityClass } from "@/lib/cities";

type Village = {
  id: string;
  name: string;
  type: string;
  cityClass?: CityClass;
  cityClassLocked?: boolean;
  influence: number;
};

function cityClassTone(cityClass: CityClass | undefined) {
  if (cityClass === "metropole") return "border-cyan-300/35 bg-cyan-500/14 text-cyan-100";
  if (cityClass === "posto_avancado") return "border-rose-300/35 bg-rose-500/14 text-rose-100";
  if (cityClass === "bastiao") return "border-amber-300/35 bg-amber-500/14 text-amber-100";
  if (cityClass === "celeiro") return "border-emerald-300/35 bg-emerald-500/14 text-emerald-100";
  return "border-white/15 bg-white/8 text-slate-200";
}

function cityClassShellTone(cityClass: CityClass | undefined) {
  if (cityClass === "metropole") return "border-cyan-300/30 bg-cyan-500/10";
  if (cityClass === "posto_avancado") return "border-rose-300/30 bg-rose-500/10";
  if (cityClass === "bastiao") return "border-amber-300/30 bg-amber-500/10";
  if (cityClass === "celeiro") return "border-emerald-300/30 bg-emerald-500/10";
  return "border-white/25 bg-white/10";
}

export function Header({
  selectedVillageId,
  villages,
  onVillageChange,
  onSaveVillageMeta,
  topOffset,
}: {
  selectedVillageId: string;
  villages: Village[];
  onVillageChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onSaveVillageMeta: (villageId: string, name: string, cityClass: CityClass) => void;
  topOffset?: string;
}) {
  const activeVillage = villages.find((village) => village.id === selectedVillageId) ?? villages[0];
  const activeCityClass = activeVillage?.cityClass ?? "neutral";
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(activeVillage?.name ?? "");
  const [draftCityClass, setDraftCityClass] = useState<CityClass>(activeCityClass);
  const canEditCityClass = !(activeVillage?.cityClassLocked ?? false);

  useEffect(() => {
    setIsEditing(false);
    setDraftName(activeVillage?.name ?? "");
    setDraftCityClass(activeCityClass);
  }, [activeCityClass, activeVillage?.id, activeVillage?.name]);

  const saveMeta = () => {
    const normalizedName = draftName.trim() || activeVillage?.name || "";
    if (!activeVillage) return;
    onSaveVillageMeta(activeVillage.id, normalizedName, canEditCityClass ? draftCityClass : activeCityClass);
    setIsEditing(false);
  };

  const cycleCityClass = () => {
    if (!canEditCityClass) return;
    const sequence: CityClass[] = ["metropole", "posto_avancado", "bastiao", "celeiro"];
    const currentIndex = sequence.indexOf(draftCityClass === "neutral" ? "metropole" : draftCityClass);
    const next = sequence[(currentIndex + 1) % sequence.length] ?? "metropole";
    setDraftCityClass(next);
  };

  return (
    <header className="fixed inset-x-0 z-40 px-3" style={{ top: topOffset ?? "calc(env(safe-area-inset-top) + 4px)" }}>
      <div className="kw-hud-panel relative mx-auto w-full max-w-md rounded-[24px] p-2.5">
        <div className="flex items-center gap-2">
          <div className="kw-hud-medallion flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-amber-100">
            <Crown className="h-4 w-4" />
          </div>
          <label className={`relative block min-w-0 flex-1 rounded-2xl border p-1 shadow-lg backdrop-blur-xl ${cityClassShellTone(activeCityClass)}`}>
            <span className="sr-only">Selecionar cidade</span>
            <div className="kw-hud-chip rounded-xl px-3 py-2 pr-[108px]">
              <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <input
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      className="w-full bg-transparent text-sm font-black text-slate-100 outline-none"
                    />
                  ) : (
                    <p className="truncate text-sm font-black text-slate-100">{activeVillage?.name ?? "-"}</p>
                  )}
                </div>
                <span className="shrink-0 rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                  {activeVillage?.type ?? "Cidade"}
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!isEditing) return;
                    cycleCityClass();
                  }}
                  disabled={!isEditing || !canEditCityClass}
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cityClassTone(isEditing ? draftCityClass : activeCityClass)} disabled:opacity-100`}
                >
                  {CITY_CLASS_META[isEditing ? draftCityClass : activeCityClass].shortLabel}
                </button>
              </div>
            </div>
            <select
              value={selectedVillageId}
              onChange={onVillageChange}
              className={`absolute inset-y-0 left-0 right-[104px] h-full cursor-pointer appearance-none opacity-0 ${isEditing ? "pointer-events-none" : ""}`}
            >
              {villages.map((village) => (
                <option key={village.id} value={village.id}>
                  {village.name}
                </option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (isEditing) {
                    saveMeta();
                    return;
                  }
                  setIsEditing(true);
                }}
                  className="kw-hud-medallion flex h-8 w-8 items-center justify-center rounded-full text-slate-100"
              >
                {isEditing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              </button>
              <span title="Vocacao da cidade" className="kw-hud-chip inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold text-cyan-100">
                {CITY_CLASS_META[activeVillage?.cityClass ?? "neutral"].shortLabel}
              </span>
              <div className="kw-hud-medallion pointer-events-none flex h-8 w-8 items-center justify-center rounded-full text-slate-100">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </label>
        </div>
      </div>
    </header>
  );
}
