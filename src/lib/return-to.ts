import { SITE_URL } from "@/lib/site";

export function sanitizeReturnTo(
  candidate: string | null | undefined,
  fallback = "/",
) {
  const trimmed = typeof candidate === "string" ? candidate.trim() : "";
  if (!trimmed) {
    return fallback;
  }
  if (trimmed.startsWith("//")) {
    return fallback;
  }

  const isAbsoluteUrl = /^https?:\/\//i.test(trimmed);
  const isLocalPath = trimmed.startsWith("/");
  if (!isAbsoluteUrl && !isLocalPath) {
    return fallback;
  }

  try {
    const base = new URL(SITE_URL);
    const parsed = new URL(trimmed, base);
    if (parsed.origin !== base.origin) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * 클라이언트 "뒤로 가기"가 이동할 경로를 결정한다.
 * `?returnTo=`와 같은 출처 referrer 모두 sanitizeReturnTo를 거쳐야 하며,
 * 외부 origin·프로토콜 상대 경로(`//host`)·`javascript:` 등은 fallback으로 대체한다.
 */
export function resolveBackHref({
  search,
  referrer,
  currentOrigin,
  fallbackHref = "/",
}: {
  search?: string | null;
  referrer?: string | null;
  currentOrigin?: string | null;
  fallbackHref?: string;
}) {
  const safeFallback = sanitizeReturnTo(fallbackHref, "/");
  const queryReturnTo = sanitizeReturnTo(
    new URLSearchParams(search ?? "").get("returnTo"),
    "",
  );
  if (queryReturnTo) {
    return queryReturnTo;
  }

  if (referrer && currentOrigin) {
    try {
      const parsed = new URL(referrer);
      if (parsed.origin === currentOrigin) {
        const referrerPath = sanitizeReturnTo(
          `${parsed.pathname}${parsed.search}${parsed.hash}`,
          "",
        );
        if (referrerPath) {
          return referrerPath;
        }
      }
    } catch {
      // ignore malformed referrer URLs
    }
  }

  return safeFallback;
}
