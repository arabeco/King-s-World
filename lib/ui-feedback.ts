"use client";

import { getUiSettings } from "@/lib/ui-settings";

type HapticTone = "light" | "medium" | "heavy";
type UiTone = "tap" | "open" | "close" | "route";
export type UiToastTone = "success" | "error" | "info";
export type UiToastPayload = {
  tone?: UiToastTone;
  title: string;
  message?: string;
};

export const UI_TOAST_EVENT = "kw-ui-toast";

let audioContextRef: AudioContext | null = null;

function resolveAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const Ctor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    return null;
  }

  if (!audioContextRef) {
    audioContextRef = new Ctor();
  }

  return audioContextRef;
}

export function triggerHaptic(tone: HapticTone = "light") {
  const settings = getUiSettings();
  if (settings.silentMode || !settings.hapticsEnabled) {
    return;
  }
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }

  if (tone === "heavy") {
    navigator.vibrate([16, 12, 18]);
    return;
  }

  if (tone === "medium") {
    navigator.vibrate(20);
    return;
  }

  navigator.vibrate(12);
}

export function playUiTone(tone: UiTone = "tap") {
  const settings = getUiSettings();
  if (settings.silentMode || !settings.uiSoundEnabled) {
    return;
  }
  const audioContext = resolveAudioContext();
  if (!audioContext) {
    return;
  }

  void audioContext.resume().catch(() => undefined);

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const now = audioContext.currentTime;

  const profile =
    tone === "route"
      ? { frequency: 540, endFrequency: 620, duration: 0.065, peak: 0.03 }
      : tone === "open"
        ? { frequency: 480, endFrequency: 560, duration: 0.055, peak: 0.025 }
        : tone === "close"
          ? { frequency: 420, endFrequency: 360, duration: 0.05, peak: 0.022 }
          : { frequency: 460, endFrequency: 500, duration: 0.04, peak: 0.018 };

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(profile.frequency, now);
  oscillator.frequency.linearRampToValueAtTime(profile.endFrequency, now + profile.duration);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(profile.peak, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + profile.duration + 0.01);
}

export function emitUiFeedback(tone: UiTone = "tap", haptic: HapticTone = "light") {
  triggerHaptic(haptic);
  playUiTone(tone);
}

export function emitUiToast(payload: UiToastPayload) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<UiToastPayload>(UI_TOAST_EVENT, {
      detail: {
        tone: payload.tone ?? "info",
        title: payload.title,
        message: payload.message,
      },
    }),
  );
}
