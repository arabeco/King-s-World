import { useEffect, useState } from "react";

import ForgotPasswordPage from "@/app/forgot-password/page";
import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";
import { NativeAuthBridge } from "@/components/native-auth-bridge";
import { NativeAuthDebug } from "@/components/native-auth-debug";
import { PressHaptics } from "@/components/press-haptics";
import { UiToastHost } from "@/components/ui-toast-host";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

import { hasSession } from "./api-bridge";
import { appRouter, useLocation } from "./router";
import { clearScreenCache, InventoryScreen, LobbyScreen, PremiumScreen, ProfileScreen, WorldScreen } from "./screens";

const AUTH_SCREENS = ["/login", "/register", "/forgot-password"];

function isAuthScreen(pathname: string) {
  return AUTH_SCREENS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function Screen({ pathname }: { pathname: string }) {
  if (pathname === "/login") return <LoginPage />;
  if (pathname === "/register") return <RegisterPage />;
  if (pathname === "/forgot-password") return <ForgotPasswordPage />;
  if (pathname === "/lobby") return <LobbyScreen />;
  if (pathname === "/profile") return <ProfileScreen />;
  if (pathname === "/inventory" || pathname.startsWith("/inventory/")) return <InventoryScreen />;
  if (pathname === "/premium") return <PremiumScreen />;
  const world = /^\/world\/([^/]+)/.exec(pathname);
  if (world) return <WorldScreen key={world[1]} worldId={decodeURIComponent(world[1])} />;
  return null;
}

function knownScreen(pathname: string) {
  return pathname !== "/" && (isAuthScreen(pathname) || ["/lobby", "/profile", "/premium"].includes(pathname)
    || pathname === "/inventory" || pathname.startsWith("/inventory/") || /^\/world\/[^/]+/.test(pathname));
}

export function App() {
  const { pathname, search, tick } = useLocation();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void hasSession().then((value) => { if (active) setSignedIn(value); });
    const { data } = getSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") clearScreenCache();
      if (active) void hasSession().then((value) => setSignedIn(value || Boolean(session)));
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (signedIn === null) return;
    if (!knownScreen(pathname)) appRouter.replace(signedIn ? "/lobby" : "/login");
    else if (!signedIn && !isAuthScreen(pathname)) appRouter.replace(`/login?next=${encodeURIComponent(pathname + search)}`);
    else if (signedIn && isAuthScreen(pathname) && pathname !== "/forgot-password") {
      const next = new URLSearchParams(search).get("next");
      appRouter.replace(next && next.startsWith("/") && !isAuthScreen(next) ? next : "/lobby");
    }
  }, [pathname, search, signedIn]);

  const ready = signedIn !== null && knownScreen(pathname) && (signedIn ? !isAuthScreen(pathname) || pathname === "/forgot-password" : isAuthScreen(pathname));
  return <>
    {ready ? <Screen key={`${pathname}#${tick}`} pathname={pathname} /> : <div className="kw-app-boot" aria-busy="true" />}
    <PressHaptics />
    <NativeAuthBridge />
    <NativeAuthDebug />
    <UiToastHost />
  </>;
}
