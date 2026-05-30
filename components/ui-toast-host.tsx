"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { UI_TOAST_EVENT, type UiToastPayload, type UiToastTone } from "@/lib/ui-feedback";

type ToastState = Required<Pick<UiToastPayload, "tone" | "title">> & {
  id: number;
  message?: string;
};

const TOAST_CLASSES: Record<UiToastTone, string> = {
  success: "border-emerald-300/35 bg-emerald-500/16 text-emerald-50",
  error: "border-rose-300/40 bg-rose-500/18 text-rose-50",
  info: "border-cyan-300/35 bg-cyan-500/16 text-cyan-50",
};

const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export function UiToastHost() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    let timer: number | null = null;

    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<UiToastPayload>).detail;
      if (!detail?.title) {
        return;
      }

      if (timer) {
        window.clearTimeout(timer);
      }

      setToast({
        id: Date.now(),
        tone: detail.tone ?? "info",
        title: detail.title,
        message: detail.message,
      });
      timer = window.setTimeout(() => setToast(null), 3200);
    };

    window.addEventListener(UI_TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(UI_TOAST_EVENT, onToast);
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  if (!toast) {
    return null;
  }

  const Icon = TOAST_ICONS[toast.tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+14px)] z-[120] flex justify-center px-4"
    >
      <div
        key={toast.id}
        className={`flex w-full max-w-[390px] items-start gap-2 rounded-2xl border px-3 py-2.5 shadow-[0_18px_44px_rgba(2,6,23,0.45)] backdrop-blur-xl ${TOAST_CLASSES[toast.tone]}`}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-[12px] font-black leading-4">{toast.title}</p>
          {toast.message ? <p className="mt-0.5 text-[10px] font-semibold leading-4 text-slate-100/78">{toast.message}</p> : null}
        </div>
      </div>
    </div>
  );
}
