/**
 * Cross-site protection for actions authenticated by site cookies.
 *
 * A request is trusted when it has no Origin, comes from the same host, or is
 * authenticated with a bearer token (the installed app). A foreign page can't
 * attach a player's token, so bearer requests carry no cross-site risk.
 */
export function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (/^Bearer\s+\S+$/i.test(request.headers.get("authorization")?.trim() ?? "")) return true;
  try {
    const parsed = new URL(origin);
    // Next's internal request URL may use localhost behind the HTTP proxy.
    // Host is the public authority the browser actually requested.
    return ["http:", "https:"].includes(parsed.protocol)
      && parsed.host === (request.headers.get("host") ?? new URL(request.url).host);
  } catch {
    return false;
  }
}
