import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { NativeAuthBridge } from "@/components/native-auth-bridge";
import { NativeAuthDebug } from "@/components/native-auth-debug";
import { PressHaptics } from "@/components/press-haptics";
import { UiToastHost } from "@/components/ui-toast-host";

import "./globals.css";

export const metadata: Metadata = {
  title: "KingsWorld",
  description: "Cuide do seu reino, explore o mundo e atravesse o Portal. Estratégia cooperativa, uma pequena jornada por dia.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <PressHaptics />
        <NativeAuthBridge />
        <NativeAuthDebug />
        <UiToastHost />
      </body>
    </html>
  );
}
