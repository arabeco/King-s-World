import {supabaseSelect} from "@/lib/supabase-rest";
import { NextResponse } from "next/server";
import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { cozyErrorResponse, getCozyAccount } from "@/lib/cozy/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const headers = { "Cache-Control": "private, no-store, max-age=0" };
  try {
    const user = await requireAuthenticatedAppUser();
    const data = await getCozyAccount(user);
    let victoryBadgeCount = data.history.filter(season => season.finished && season.seal).length;
    if (data.history.length >= 50 && data.account.seals > victoryBadgeCount) {
      // The history preview is capped. Count completed awards across the whole account.
      const pageSize = 100;
      victoryBadgeCount = 0;
      for (let offset = 0; ; offset += pageSize) {
        const rows = await supabaseSelect("kw_cozy_rewards", new URLSearchParams({
          select: "world_id", user_id: "eq." + user.id, finished: "eq.true",
          portal_crossed_at: "not.is.null", order: "world_id.asc",
          limit: String(pageSize), offset: String(offset)
        }));
        victoryBadgeCount += rows.length;
        if (rows.length < pageSize) break;
      }
    }
    return NextResponse.json({...data, victoryBadge: victoryBadgeCount > 0, victoryBadgeCount}, { headers });
  } catch (error) {
    const result = cozyErrorResponse(error);
    return NextResponse.json(result.body, { status: result.status, headers });
  }
}
