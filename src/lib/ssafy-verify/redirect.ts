import type { SsafyVerifyServerConfig } from "./config";

export const SSAFY_VERIFY_CALLBACK_PATH = "/auth/ssafy";

export function buildSsafyVerifyRedirectUri(origin: string) {
  const url = new URL(origin);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "";
  }
  return new URL(SSAFY_VERIFY_CALLBACK_PATH, url.origin).toString();
}

export function buildSsafyVerifyRequestRedirectUri(request: Request) {
  return buildSsafyVerifyRedirectUri(new URL(request.url).origin);
}

function isLoopbackHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function isLoopbackRedirectUri(redirectUri: string) {
  const url = new URL(redirectUri);
  if (url.protocol !== "http:") {
    return false;
  }
  return isLoopbackHostname(url.hostname);
}

export function resolveSsafyVerifyAllowedRedirectUris(
  config: Pick<SsafyVerifyServerConfig, "redirectUris">,
  requestRedirectUri: string,
) {
  const redirectUris = new Set(config.redirectUris);
  if (isLoopbackRedirectUri(requestRedirectUri)) {
    redirectUris.add(requestRedirectUri);
  }
  return [...redirectUris];
}
