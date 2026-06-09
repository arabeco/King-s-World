"use client";

import { useEffect } from "react";

import { triggerHaptic } from "@/lib/ui-feedback";

/**
 * Haptic instantâneo no PRESS (pointerdown) de qualquer botão/link clicável.
 * Dá feedback tátil imediato — o clique deixa de parecer "travado".
 * Renderiza nada.
 */
export function PressHaptics() {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      // Só vibra em coisas clicáveis (não no pan do mapa nem em texto).
      if (target.closest("button:not(:disabled), a[href], [role='button'], [data-map-hud]")) {
        triggerHaptic("light");
      }
    };
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return null;
}
