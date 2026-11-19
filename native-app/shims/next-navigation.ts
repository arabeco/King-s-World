import { useMemo } from "react";

import { appRouter, useLocation } from "../router";

export function useRouter() {
  return appRouter;
}

export function usePathname(): string {
  return useLocation().pathname;
}

export function useSearchParams(): URLSearchParams {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  const { pathname } = useLocation();
  const match = /^\/world\/([^/]+)/.exec(pathname);
  return (match ? { worldId: decodeURIComponent(match[1]) } : {}) as T;
}

export function redirect(path: string): never {
  appRouter.replace(path);
  throw new Error(`redirect:${path}`);
}

export function notFound(): never {
  appRouter.replace("/lobby");
  throw new Error("not-found");
}
