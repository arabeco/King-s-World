import type { ReactNode } from "react";

import { isCozyWorld } from "@/lib/cozy/server";

export default async function WorldLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { worldId: string };
}) {
  if (await isCozyWorld(params.worldId)) {
    const { CozyWorldClient } = await import("@/components/cozy/CozyWorldClient");
    return <CozyWorldClient worldId={params.worldId} />;
  }
  const [{ default: LegacyWorldEntry }, { getWorldPayload }] = await Promise.all([
    import("@/components/legacy-world-entry"),
    import("@/lib/world-data"),
  ]);
  const initialPayload = await getWorldPayload(params.worldId);

  return <LegacyWorldEntry worldId={params.worldId} initialPayload={initialPayload}>{children}</LegacyWorldEntry>;
}
