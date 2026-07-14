const SENSITIVE_PATH_PATTERNS: Array<readonly [RegExp, string]> = [
  [/^\/verify\/[^/?#]+(?=\/|$|[?#])/, "/verify/[token]"],
  [
    /^\/api\/partner\/setup\/[^/?#]+(?=\/|$|[?#])/,
    "/api/partner/setup/[token]",
  ],
  [/^\/partner\/setup\/[^/?#]+(?=\/|$|[?#])/, "/partner/setup/[token]"],
  [/^\/admin\/setup\/[^/?#]+(?=\/|$|[?#])/, "/admin/setup/[token]"],
  [
    /^\/api\/certification\/avatar\/[^/?#]+(?=\/|$|[?#])/,
    "/api/certification/avatar/[token]",
  ],
];

function sanitizeSensitivePathname(pathname: string) {
  return SENSITIVE_PATH_PATTERNS.reduce(
    (normalized, [pattern, replacement]) => normalized.replace(pattern, replacement),
    pathname,
  );
}

export function normalizeProductEventLocation(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return null;
      }
      url.pathname = sanitizeSensitivePathname(url.pathname);
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return null;
    }
  }

  const pathname = trimmed.split(/[?#]/, 1)[0] ?? "";
  if (!pathname.startsWith("/")) {
    return null;
  }
  return sanitizeSensitivePathname(pathname);
}
