import { allowsLocalFixtures } from "../local-fixture-policy.mjs";
/** Canonical OAuth audience must never come from an untrusted Host header. */
export function getMcpConfig(environment: {NEXT_PUBLIC_SITE_URL?:string;NODE_ENV?:string;SELF_HOST_MODE?:string} = process.env) {
  const url = new URL(environment.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    (url.protocol !== "https:" && !(loopback && allowsLocalFixtures(environment) && environment.SELF_HOST_MODE !== "real"))) {
    throw new Error("mcp_origin_configuration_invalid");
  }
  const origin = url.origin;
  return { origin, resource: `${origin}/api/mcp`, resourceMetadata: `${origin}/.well-known/oauth-protected-resource/api/mcp` };
}
export function isMcpOriginAllowed(request: Request, origin: string, browserOnly = false) {
  const supplied = request.headers.get("origin");
  return browserOnly ? supplied === origin : supplied === null || supplied === origin;
}
