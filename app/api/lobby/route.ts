import { NextResponse } from "next/server";

import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { persistentWorldsEnabled } from "@/lib/game-modes";
import { listWorldSummaries } from "@/lib/world-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const headers = { "Cache-Control": "private, no-store, max-age=0" };

/** Data the lobby screen needs when it runs inside the installed app. */
export async function GET() {
  try {
    const appUser = await requireAuthenticatedAppUser();
    const worlds = await listWorldSummaries(appUser.id);
    return NextResponse.json({
      username: appUser.username,
      worlds,
      persistentPreview: persistentWorldsEnabled(),
    }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const unauthorized = message === "Unauthorized";
    return NextResponse.json(
      { error: unauthorized ? "Entre na sua conta para continuar." : "Não foi possível abrir o lobby.", code: unauthorized ? "UNAUTHORIZED" : "LOBBY_UNAVAILABLE" },
      { status: unauthorized ? 401 : 503, headers },
    );
  }
}
