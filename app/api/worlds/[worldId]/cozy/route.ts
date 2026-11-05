import { NextResponse } from "next/server";
import { requireAuthenticatedAppUser } from "@/lib/app-user";
import {
  CozyHttpError,
  cozyErrorResponse,
  getCozyPayload,
  startCozyWorld,
} from "@/lib/cozy/server";
import type { CozyAction } from "@/lib/cozy/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(
  _request: Request,
  { params }: { params: { worldId: string } },
) {
  try {
    const user = await requireAuthenticatedAppUser();
    return NextResponse.json(await getCozyPayload(params.worldId, user), {
      headers,
    });
  } catch (error) {
    const result = cozyErrorResponse(error);
    return NextResponse.json(result.body, { status: result.status, headers });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { worldId: string } },
) {
  try {
    const origin = request.headers.get("origin");
    if (origin) {
      let sameOrigin = false;
      try {
        const parsed = new URL(origin);
        // Next's internal request URL may use localhost behind the HTTP proxy.
        // Host is the public authority the browser actually requested.
        sameOrigin =
          ["http:", "https:"].includes(parsed.protocol) &&
          parsed.host ===
            (request.headers.get("host") ?? new URL(request.url).host);
      } catch {
        /* Invalid or opaque origins are rejected. */
      }
      if (!sameOrigin)
        throw new CozyHttpError(
          "Origem da ação inválida.",
          403,
          "INVALID_ORIGIN",
        );
    }
    const user = await requireAuthenticatedAppUser();
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
    const { action, requestId } = body as {
      action?: unknown;
      requestId?: unknown;
    };
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
      return NextResponse.json(await getCozyPayload(params.worldId, user), {
        headers,
      });
    }
    return NextResponse.json(
      await getCozyPayload(params.worldId, user, {
        action: action as CozyAction,
        requestId,
      }),
      { headers },
    );
  } catch (error) {
    const result = cozyErrorResponse(error);
    return NextResponse.json(result.body, { status: result.status, headers });
  }
}
