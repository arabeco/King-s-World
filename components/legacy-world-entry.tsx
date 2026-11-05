"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { WorldShell } from "./world-shell";

// A client boundary is required here: server-side import() alone does not
// separate this legacy client tree from the cozy layout's browser bundle.
const LegacyWorldShell = dynamic(() => import("./world-shell").then(module => module.WorldShell));

export default function LegacyWorldEntry(props: ComponentProps<typeof WorldShell>) {
  return <LegacyWorldShell {...props} />;
}
