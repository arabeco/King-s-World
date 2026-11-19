import { useSyncExternalStore } from "react";

/**
 * Minimal client router for the installed app (replaces Next's router).
 * Paths are real history paths; Capacitor serves index.html for every route.
 */
type Location = { pathname: string; search: string; tick: number };

let current: Location = read(0);
const listeners = new Set<() => void>();

function read(tick: number): Location {
  return { pathname: window.location.pathname || "/", search: window.location.search, tick };
}

function emit(next: Location) {
  current = next;
  listeners.forEach((listener) => listener());
}

window.addEventListener("popstate", () => emit(read(current.tick)));

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLocation(): Location {
  return useSyncExternalStore(subscribe, () => current);
}

export function getLocation(): Location {
  return current;
}

function go(path: string, replace: boolean) {
  const url = new URL(path, window.location.href);
  if (url.origin !== window.location.origin) {
    window.location.href = url.href;
    return;
  }
  const target = url.pathname + url.search + url.hash;
  if (replace) window.history.replaceState(null, "", target);
  else window.history.pushState(null, "", target);
  emit(read(current.tick));
  if (!url.hash) window.scrollTo(0, 0);
}

export const appRouter = {
  push(path: string) { go(path, false); },
  replace(path: string) { go(path, true); },
  back() { window.history.back(); },
  forward() { window.history.forward(); },
  /** Next re-renders server data on refresh; here the current screen reloads its data. */
  refresh() { emit({ ...current, tick: current.tick + 1 }); },
  prefetch() { /* screens are bundled; nothing to prefetch */ },
};
