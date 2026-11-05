import { isCozyWorld } from "@/lib/cozy/server";

export default async function EmpirePage({ params }: { params: { worldId: string } }) {
  if (await isCozyWorld(params.worldId)) return null;
  const { default: EmpireClient } = await import("./empire-client");
  return <EmpireClient params={params} />;
}
