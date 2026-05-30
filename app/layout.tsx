import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { UiToastHost } from "@/components/ui-toast-host";

import "./globals.css";

export const metadata: Metadata = {
  title: "KingsWorld",
  description: "Jogo persistente de estrategia, Coroa, Cidadelas e Apocalipse.",
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
        <UiToastHost />
      </body>
    </html>
  );
}
