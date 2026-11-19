import { NextResponse } from "next/server";
import { requireAuthenticatedAppUser } from "@/lib/app-user";
import {
  CozyHttpError,
  cozyErrorResponse,
  getCozyPayload,
  readCozyAscensionPreview,
  startCozyWorld,
} from "@/lib/cozy/server";
import type { CozyAction } from "@/lib/cozy/types";
import { isTrustedOrigin } from "@/lib/request-origin";
import { looksLikeUuid } from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const headers = { "Cache-Control": "private, no-store, max-age=0" };

function responseTiming() {
  const started=performance.now();
  const phases=new Map<string, number>();
  return {
    record(phase: string,duration: number) {
      phases.set(phase,(phases.get(phase)??0)+duration);
    },
    headers() {
      const entries=[...phases,["total",performance.now()-started] as const];
      return {...headers,"Server-Timing":entries.map(([name,duration])=>`${name};dur=${duration.toFixed(1)}`).join(", ")};
    },
  };
}

export async function GET(
  request: Request,
  { params }: { params: { worldId: string } },
) {
  const timing=responseTiming();
  try {
    const authStarted=performance.now();
    const user = await requireAuthenticatedAppUser();
    timing.record("auth",performance.now()-authStarted);
    if (new URL(request.url).searchParams.get("view")==="ascension")
      return NextResponse.json(await readCozyAscensionPreview(params.worldId,user),{headers:timing.headers()});
    return NextResponse.json(await getCozyPayload(params.worldId, user, undefined, timing.record), {
      headers:timing.headers(),
    });
  } catch (error) {
    const result = cozyErrorResponse(error);
    return NextResponse.json(result.body, { status: result.status, headers:timing.headers() });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { worldId: string } },
) {
  const timing=responseTiming();
  try {
    if (!isTrustedOrigin(request))
      throw new CozyHttpError(
        "Origem da ação inválida.",
        403,
        "INVALID_ORIGIN",
      );
    const authStarted=performance.now();
    const user = await requireAuthenticatedAppUser();
    timing.record("auth",performance.now()-authStarted);
    const text = await request.text();
    if (text.length > 4096)
      throw new CozyHttpError("Ação inválida.", 413, "BODY_TOO_LARGE");
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new CozyHttpError("Ação inválida.", 400, "INVALID_JSON");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new CozyHttpError("Ação inválida.");
    const { action, requestId, playerId } = body as {
      action?: unknown;
      requestId?: unknown;
      playerId?: unknown;
    };
    if(playerId!==undefined && (typeof playerId!=="string" || !looksLikeUuid(playerId)))
      throw new CozyHttpError("Reinado inválido.",400,"INVALID_REIGN");
    if (
      typeof requestId !== "string" ||
      !/^[a-zA-Z0-9_-]{8,128}$/.test(requestId)
    )
      throw new CozyHttpError(
        "Identificador da ação inválido.",
        400,
        "INVALID_REQUEST_ID",
      );
    if (
      !action ||
      typeof action !== "object" ||
      Array.isArray(action) ||
      typeof (action as { type?: unknown }).type !== "string"
    )
      throw new CozyHttpError("Ação inválida.");
    if ((action as { type: string }).type === "start_world") {
      await startCozyWorld(params.worldId, user);
      return NextResponse.json(await getCozyPayload(params.worldId, user, undefined, timing.record), {
        headers:timing.headers(),
      });
    }
    return NextResponse.json(
      await getCozyPayload(params.worldId, user, {
        action: action as CozyAction,
        requestId,
        playerId: typeof playerId==="string" ? playerId : undefined,
      },timing.record),
      { headers:timing.headers() },
    );
  } catch (error) {
    const result = cozyErrorResponse(error);
    return NextResponse.json(result.body, { status: result.status, headers:timing.headers() });
  }
}
