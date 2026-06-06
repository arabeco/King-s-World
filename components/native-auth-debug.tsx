"use client";

import { useEffect, useState } from "react";

import { isNativeApp, subscribeAuthLog } from "@/lib/native-auth";

// Overlay TEMPORÁRIO de diagnóstico do login nativo. Mostra cada passo do fluxo
// OAuth na tela, só quando roda como app (Capacitor). Remover quando o Google
// estiver confirmado funcionando no device.
const ENABLED = true;

export function NativeAuthDebug() {
  const [lines, setLines] = useState<string[]>([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!ENABLED || !isNativeApp()) {
      return;
    }
    return subscribeAuthLog(setLines);
  }, []);

  if (!ENABLED || hidden || lines.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        left: 8,
        right: 8,
        bottom: 8,
        zIndex: 99999,
        maxHeight: "40vh",
        overflowY: "auto",
        padding: "8px 10px",
        borderRadius: 12,
        background: "rgba(2,6,23,0.92)",
        border: "1px solid rgba(148,163,184,0.4)",
        color: "#e2e8f0",
        font: "11px/1.45 monospace",
        whiteSpace: "pre-wrap",
        boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <strong style={{ color: "#38bdf8" }}>native-auth debug</strong>
        <button
          type="button"
          onClick={() => setHidden(true)}
          style={{
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}
