export type SupabaseTransport = typeof fetch;

const TRANSPORT_CONFIGURATION_ERROR =
  "Supabase transport configuration is invalid.";

function parseOriginUrl(value: string): URL {
  if (!value || value !== value.trim() || /[\u0000-\u001F\u007F\\]/u.test(value)) {
    throw new Error(TRANSPORT_CONFIGURATION_ERROR);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(TRANSPORT_CONFIGURATION_ERROR);
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:")
    || url.username
    || url.password
    || url.pathname !== "/"
    || url.search
    || url.hash
  ) {
    throw new Error(TRANSPORT_CONFIGURATION_ERROR);
  }

  return url;
}

function getRequestUrl(input: RequestInfo | URL): URL | null {
  try {
    if (input instanceof Request) {
      return new URL(input.url);
    }

    return new URL(input);
  } catch {
    return null;
  }
}

function replaceOrigin(source: URL, destinationOrigin: URL): URL {
  const destination = new URL(source.href);
  destination.protocol = destinationOrigin.protocol;
  destination.host = destinationOrigin.host;
  return destination;
}

/**
 * Routes only calls made to the public Supabase origin through an optional
 * server-private gateway. The SDK still receives the public URL, so URLs it
 * returns (including Storage signed URLs) remain usable by browsers.
 */
export function createSupabaseTransport(
  publicSupabaseUrl: string,
  internalSupabaseUrl?: string,
): SupabaseTransport {
  const publicOrigin = parseOriginUrl(publicSupabaseUrl);

  if (!internalSupabaseUrl) {
    return fetch;
  }

  const internalOrigin = parseOriginUrl(internalSupabaseUrl);
  return (input, init) => {
    const requestUrl = getRequestUrl(input);
    if (
      !requestUrl
      || requestUrl.username
      || requestUrl.password
      || requestUrl.origin !== publicOrigin.origin
    ) {
      return fetch(input, init);
    }

    const rewrittenRequest = new Request(
      replaceOrigin(requestUrl, internalOrigin),
      input instanceof Request ? input : undefined,
    );

    // A redirect could otherwise forward the SDK's authorization headers from
    // the private gateway to an origin that this transport did not approve.
    return fetch(rewrittenRequest, {
      ...init,
      redirect: "error",
    });
  };
}
