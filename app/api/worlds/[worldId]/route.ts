import { NextResponse } from "next/server";

import { getWorldPayload } from "@/lib/world-data";
import { isCozyWorld } from "@/lib/cozy/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: { worldId: string } },
) {
  try {
    if (await isCozyWorld(params.worldId)) return NextResponse.json({ error: "Use o painel da Coroa para esta temporada.", endpoint: `/api/worlds/${params.worldId}/cozy` }, { status: 409 });
    const payload = await getWorldPayload(params.worldId);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load world." },
      { status: 500 },
    );
  }
}
