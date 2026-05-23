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

export function isTrustedSameOriginRequest(
  request: SameOriginRequest,
  options: SameOriginOptions = {},
) {
  const expectedOrigin =
    options.expectedOrigin ?? getOriginFromUrl(request.url);
  if (!expectedOrigin) {
    return false;
  }

  const origin = request.headers.get("origin");
  if (origin) {
    if (origin !== expectedOrigin) {
      return false;
    }
  } else {
    const referrerOrigin = getOriginFromUrl(request.headers.get("referer"));
    if (referrerOrigin !== expectedOrigin) {
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
