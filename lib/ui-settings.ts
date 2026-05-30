"use client";

export type UiSettings = {
  uiSoundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  silentMode: boolean;
};

const STORAGE_KEY = "kw-ui-settings-v1";

const DEFAULT_SETTINGS: UiSettings = {
  uiSoundEnabled: true,
  musicEnabled: false,
  hapticsEnabled: true,
  silentMode: false,
};

export function getUiSettings(): UiSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return {
      uiSoundEnabled: parsed.uiSoundEnabled ?? DEFAULT_SETTINGS.uiSoundEnabled,
      musicEnabled: parsed.musicEnabled ?? DEFAULT_SETTINGS.musicEnabled,
      hapticsEnabled: parsed.hapticsEnabled ?? DEFAULT_SETTINGS.hapticsEnabled,
      silentMode: parsed.silentMode ?? DEFAULT_SETTINGS.silentMode,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function setUiSettings(next: UiSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

