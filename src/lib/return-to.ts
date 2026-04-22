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
