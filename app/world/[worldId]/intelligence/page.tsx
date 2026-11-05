import { isCozyWorld } from "@/lib/cozy/server";

export default async function IntelligencePage({ params }: { params: { worldId: string } }) {
  // The cozy layout owns this screen; do not serialize the unused legacy UI.
  if (await isCozyWorld(params.worldId)) return null;
  const [{ IntelligenceClient }, { seasonAuditAnalytics }] = await Promise.all([
    import("./intelligence-client"),
    import("@/lib/season-audit-analytics"),
  ]);
  return <IntelligenceClient params={params} profileHealth={seasonAuditAnalytics.profileHealth} />;
}
