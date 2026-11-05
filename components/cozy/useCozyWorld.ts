"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {newerCozySnapshot} from "@/lib/cozy/snapshot-order";
import type { CozyAction, CozyPayload } from "@/lib/cozy/types";

export type CozyCommand = CozyAction | { type: "start_world" };
type PendingCommand = { action: CozyCommand; requestId: string };

function pendingKey(worldId: string, playerId: string) {
  return `kw-cozy-pending:${encodeURIComponent(worldId)}:${encodeURIComponent(playerId)}`;
}
function restorePending(key: string): PendingCommand | null {
  for (const store of [() => localStorage, () => sessionStorage]) {
    try {
      const storage = store(), raw = storage.getItem(key);
      if (!raw) continue;
      const value = raw.length <= 4096 ? JSON.parse(raw) : null;
      if (value && typeof value === "object" && !Array.isArray(value) &&
          typeof value.requestId === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(value.requestId) &&
          value.action && typeof value.action === "object" && !Array.isArray(value.action) &&
          typeof value.action.type === "string" && value.action.type.length > 0 && value.action.type.length <= 64) {
        if(value.action.type==='read_reports'){storage.removeItem(key);continue;}
        return { action: value.action, requestId: value.requestId };
      }
      storage.removeItem(key);
    } catch { /* Disabled storage or an invalid receipt must not prevent entry. */ }
  }
  return null;
}
function savePending(key: string, command: PendingCommand | null) {
  for (const store of [() => localStorage, () => sessionStorage]) {
    try {
      const storage = store();
      if (command) storage.setItem(key, JSON.stringify(command));
      else storage.removeItem(key);
    } catch { /* In-memory recovery and server idempotency remain available. */ }
  }
}

/** The browser sends intentions only. Even arrival timers are settled by the API. */
export function useCozyWorld(worldId: string) {
  const [payload, setPayload] = useState<CozyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState<PendingCommand | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastAction, setLastAction] = useState<PendingCommand | null>(null);
  const alive = useRef(true);
  const inFlight = useRef(false);
  const serverOffset = useRef(0);
  const epoch=useRef(0),readingEpoch=useRef<number|null>(null),currentPayload=useRef<CozyPayload|null>(null);
  const receiptScope = useRef<string | null>(null);
  const acknowledging=useRef<{epoch:number;promise:Promise<boolean>}|null>(null);
  const endpoint = `/api/worlds/${encodeURIComponent(worldId)}/cozy`;

  const accept = useCallback((next:CozyPayload,requestEpoch:number)=>{
    if(!alive.current||requestEpoch!==epoch.current||!newerCozySnapshot(currentPayload.current,next))return;
    const scope = pendingKey(worldId, next.state.playerId);
    if (receiptScope.current !== scope) {
      receiptScope.current = scope;
      setUncertain(restorePending(scope));
    }
    currentPayload.current=next;serverOffset.current=next.serverNow-Date.now();setClock(next.serverNow);setPayload(next);setLastSyncedAt(Date.now());
  },[worldId]);

  const refresh = useCallback(async () => {
    const requestEpoch=epoch.current;
    if(inFlight.current||readingEpoch.current===requestEpoch)return;
    readingEpoch.current=requestEpoch;
    const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),20_000);
    setRefreshing(true);
    try {
      const response = await fetch(endpoint, { cache: "no-store",signal:controller.signal });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "O reino não respondeu. Tente novamente.",
        );
      accept(result as CozyPayload,requestEpoch);
      if (alive.current&&requestEpoch===epoch.current) setError(null);
    } catch (reason) {
      if (alive.current&&requestEpoch===epoch.current)
        setError(
          controller.signal.aborted
            ? "O reino demorou a responder. Tente sincronizar novamente."
            : reason instanceof TypeError
            ? "Não foi possível alcançar o reino. Verifique a conexão e tente sincronizar novamente."
            : reason instanceof SyntaxError
            ? "A resposta do reino chegou incompleta. Tente sincronizar novamente."
            : reason instanceof Error
            ? reason.message
            : "Não foi possível sincronizar o reino.",
        );
    } finally {
      window.clearTimeout(timeout);
      if(readingEpoch.current===requestEpoch)readingEpoch.current=null;
      if (alive.current&&requestEpoch===epoch.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [accept, endpoint]);

  useEffect(() => {
    alive.current = true;
    epoch.current+=1;inFlight.current=false;readingEpoch.current=null;currentPayload.current=null;serverOffset.current=0;
    setPayload(null);setLoading(true);setError(null);setUncertain(null);setPending(false);setLastAction(null);setLastSyncedAt(null);
    receiptScope.current = null;
    void refresh();
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30_000);
    const clockInterval = window.setInterval(
      () => setClock(Date.now() + serverOffset.current),
      1000,
    );
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      alive.current = false;
      window.clearInterval(interval);
      window.clearInterval(clockInterval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    if (!payload || pending) return;
    const arrivals = payload.state.orders.map((order) => order.arrivesAt);
      for(const benefit of payload.state.allianceBenefits??[])if(benefit.allianceId===payload.state.allianceId)arrivals.push(benefit.until);
    for(const benefit of payload.state.sanctuaryBenefits??[])arrivals.push(benefit.until);
    for(const threat of payload.computed.sanctuaryThreats??[])arrivals.push(threat.arrivesAt);
    if(payload.computed.endsAt)arrivals.push(payload.computed.endsAt);
    for(const city of Object.values(payload.computed.cityLife))if(city.effectEndsAt)arrivals.push(city.effectEndsAt);
    if (payload.computed.nextHorde)
      arrivals.push(payload.computed.nextHorde.arrivesAt);
    const next = Math.min(...arrivals.filter((at) => at > payload.serverNow));
    if (!Number.isFinite(next)) return;
    const timer = window.setTimeout(
      () => void refresh(),
      Math.max(
        1000,
        Math.min(30_000, next - (Date.now() + serverOffset.current) + 1200),
      ),
    );
    return () => window.clearTimeout(timer);
  }, [payload, pending, refresh]);

  const execute = useCallback(
    async (command: PendingCommand) => {
      if (inFlight.current || !currentPayload.current?.state.playerId) return false;
      const commandKey = pendingKey(worldId, currentPayload.current.state.playerId);
      const requestEpoch=epoch.current;
      const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),20_000);
      inFlight.current = true;
      setPending(true);
      setError(null);
      setLastAction(null);
      savePending(commandKey, command);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          signal:controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        });
        const result = await response.json();
        if(!alive.current||requestEpoch!==epoch.current)return false;
        if (!response.ok) {
          if (response.status >= 500) {
            // The write may have committed before a later read or proxy failed.
            // Preserve the receipt so a retry can never spend twice.
            setUncertain(command);
            setError(
              result.error ||
                "O reino ainda não confirmou esta ação. Consulte o mesmo pedido novamente.",
            );
            return false;
          }
          // A definitive rejection contains no successful client-side state change.
          setError(result.error || "Não foi possível concluir esta ação.");
          setUncertain(null);
          savePending(commandKey, null);
          return false;
        }
        accept(result as CozyPayload,requestEpoch);
        setUncertain(null);
        setLastAction(command.action.type==='read_reports'?null:command);
        savePending(commandKey, null);
        return true;
      } catch {
        if(!alive.current||requestEpoch!==epoch.current)return false;
        setUncertain(command);
        setError(
          "A conexão caiu antes da confirmação. Confira a mesma ação abaixo para receber o resultado com segurança.",
        );
        return false;
      } finally {
        window.clearTimeout(timeout);
        if (alive.current&&requestEpoch===epoch.current){inFlight.current=false;setPending(false);}
      }
    },
    [accept, endpoint, worldId],
  );

  // Read acknowledgement has no spending intent to recover. It must never reserve
  // the gameplay command slot or overwrite its persisted receipt/error/feedback.
  const acknowledgeReports=useCallback(()=>{
    const requestEpoch=epoch.current;
    if(!alive.current||!currentPayload.current)return Promise.resolve(false);
    if(acknowledging.current?.epoch===requestEpoch)return acknowledging.current.promise;
    const promise=(async()=>{
      const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),5000);
      try{
        const response=await fetch(endpoint,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({action:{type:'read_reports'},requestId:crypto.randomUUID()})});
        if(!response.ok)return false;
        const next=await response.json();
        if(!alive.current||requestEpoch!==epoch.current)return false;
        accept(next as CozyPayload,requestEpoch);return true;
      }catch{return false;}
      finally{window.clearTimeout(timeout);if(acknowledging.current?.epoch===requestEpoch)acknowledging.current=null;}
    })();
    acknowledging.current={epoch:requestEpoch,promise};return promise;
  },[accept,endpoint]);

  const act = useCallback(
    (action: CozyCommand) => {
      if (uncertain || inFlight.current) return Promise.resolve(false);
      if(action.type==='read_reports')return acknowledgeReports();
      return execute({ action, requestId: crypto.randomUUID() });
    },
    [execute, uncertain,acknowledgeReports],
  );

  return {
    payload,
    loading,
    refreshing,
    pending,
    error,
    uncertain,
    clock,
    lastSyncedAt,
    lastAction,
    refresh,
    act,
    retryCommand: () =>
      uncertain ? execute(uncertain) : Promise.resolve(false),
    clearError: () => setError(null),
  };
}
