const VERIFY_PATH_PATTERN = /^\/verify\/[^/?#]+(?=\/|$|[?#])/;

function sanitizeVerificationPathname(pathname: string) {
  return pathname.replace(VERIFY_PATH_PATTERN, "/verify/[token]");
}

export function normalizeProductEventLocation(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      url.pathname = sanitizeVerificationPathname(url.pathname);
      return url.toString();
    } catch {
      return sanitizeVerificationPathname(trimmed);
    }
  }

  return sanitizeVerificationPathname(trimmed);
}

