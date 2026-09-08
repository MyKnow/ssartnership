type SameOriginRequest = {
  headers: Pick<Headers, "get">;
  method?: string;
  url: string;
};

type SameOriginOptions = {
  expectedOrigin?: string;
  allowedContentTypes?: string[];
};

function getOriginFromUrl(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function originsMatch(actualOrigin: string, expectedOrigin: string) {
  if (actualOrigin === expectedOrigin) {
    return true;
  }

  try {
    const actual = new URL(actualOrigin);
    const expected = new URL(expectedOrigin);
    return (
      actual.protocol === expected.protocol &&
      actual.port === expected.port &&
      isLoopbackHostname(actual.hostname) &&
      isLoopbackHostname(expected.hostname)
    );
  } catch {
    return false;
  }
}

export function getTrustedRequestOrigin(fallback: string | null) {
  if (process.env.SELF_HOST_MODE !== "real") return fallback;
  try {
    const configured = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
    if (configured.username || configured.password || configured.search || configured.hash || configured.pathname !== "/") return null;
    if (configured.protocol !== "https:" && !(configured.protocol === "http:" && isLoopbackHostname(configured.hostname))) return null;
    return configured.origin;
  } catch { return null; }
}

/** Keep real-mode redirects on the configured public origin, not standalone's bind URL. */
export function buildTrustedRedirectUrl(destination: string, requestUrl: string) {
  const origin = getTrustedRequestOrigin(getOriginFromUrl(requestUrl));
  if (!origin || !/^https?:\/\//u.test(origin)) throw new Error("REDIRECT_ORIGIN_INVALID");
  if (!destination.startsWith("/") || destination.startsWith("//")
    || /[\\\u0000-\u0020\u007f]/u.test(destination)) {
    throw new Error("REDIRECT_DESTINATION_INVALID");
  }
  const target = new URL(destination, origin);
  if (target.origin !== origin) throw new Error("REDIRECT_DESTINATION_INVALID");
  return target;
}

export function isTrustedSameOriginRequest(
  request: SameOriginRequest,
  options: SameOriginOptions = {},
) {
  // Next standalone can expose its internal bind origin in nextUrl. The
  // self-hosted public origin is operator configuration, never a forwarded
  // header chosen by a caller. Invalid/missing real-mode config fails closed.
  const expectedOrigin = getTrustedRequestOrigin(
    options.expectedOrigin ?? getOriginFromUrl(request.url),
  );
  if (!expectedOrigin) {
    return false;
  }

  const origin = request.headers.get("origin");
  if (origin) {
    if (!originsMatch(origin, expectedOrigin)) {
      return false;
    }
  } else {
    const referrerOrigin = getOriginFromUrl(request.headers.get("referer"));
    if (!referrerOrigin || !originsMatch(referrerOrigin, expectedOrigin)) {
      return false;
    }
  }

  if (options.allowedContentTypes && options.allowedContentTypes.length > 0) {
    const contentType = request.headers.get("content-type") ?? "";
    return options.allowedContentTypes.some((allowedContentType) =>
      contentType.toLowerCase().startsWith(allowedContentType.toLowerCase()),
    );
  }

  return true;
}

export function isTrustedAdminSessionNavigation(request: SameOriginRequest) {
  if (request.method && request.method.toUpperCase() !== "GET") {
    return false;
  }

  const fetchMode = request.headers.get("sec-fetch-mode");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchMode !== null || fetchSite !== null) {
    return (
      fetchMode === "navigate"
      && (fetchSite === "same-origin" || fetchSite === "none")
    );
  }

  return isTrustedSameOriginRequest(request);
}
