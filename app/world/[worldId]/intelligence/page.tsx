import { IntelligenceClient } from "./intelligence-client";
import { seasonAuditAnalytics } from "@/lib/season-audit-analytics";

export default function IntelligencePage({ params }: { params: { worldId: string } }) {
  return <IntelligenceClient params={params} profileHealth={seasonAuditAnalytics.profileHealth} />;
}
