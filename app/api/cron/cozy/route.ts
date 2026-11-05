import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getCozyPayload } from "@/lib/cozy/server";
import { supabaseSelect } from "@/lib/supabase-rest";
import type { AppUserRecord } from "@/lib/app-user";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** An authenticated scheduler can settle arrivals even with no browsers open. */
export async function GET(request: Request) {
  const secret = process.env.COZY_CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const suppliedBytes = Buffer.from(supplied),
    expectedBytes = Buffer.from(expected);
  if (
    !secret ||
    secret.length < 32 ||
    suppliedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(suppliedBytes, expectedBytes)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const worlds = await supabaseSelect<{ id: string }>(
      "worlds",
      new URLSearchParams({
        select: "id",
        rules_version: "eq.2",
        status: "eq.running",
      }),
    );
    let settled = 0;
    const failed: string[] = [];
    for (const world of worlds) {
      try {
        const members = await supabaseSelect<{
          user_id: string;
          is_ai: boolean;
        }>(
          "world_players",
          new URLSearchParams({
            select: "user_id,is_ai",
            world_id: `eq.${world.id}`,
          }),
        );
        const member = members.find((item) => !item.is_ai);
        if (!member) continue;
        const [user] = await supabaseSelect<AppUserRecord>(
          "users",
          new URLSearchParams({
            select: "id,username",
            id: `eq.${member.user_id}`,
          }),
        );
        if (!user) continue;
        await getCozyPayload(world.id, user);
        settled++;
      } catch {
        failed.push(world.id);
      }
    }
    return NextResponse.json(
      { settled, failed },
      {
        status: failed.length ? 503 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível processar as temporadas." },
      { status: 503 },
    );
  }
}
