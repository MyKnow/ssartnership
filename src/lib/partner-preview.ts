import { generateOpaqueToken, hashOpaqueToken } from "@/lib/password";
import { SITE_URL } from "@/lib/site";

const PARTNER_PREVIEW_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
export const PARTNER_PREVIEW_TOKEN_TTL_MS = 72 * 60 * 60 * 1_000;

export function createPartnerPreviewToken() {
  return generateOpaqueToken(32);
}

export function hashPartnerPreviewToken(token: string) {
  return hashOpaqueToken(token.trim());
}

export function isValidPartnerPreviewToken(token: string) {
  return PARTNER_PREVIEW_TOKEN_PATTERN.test(token.trim());
}

export function createPartnerPreviewExpiresAt(now = new Date()) {
  return new Date(now.getTime() + PARTNER_PREVIEW_TOKEN_TTL_MS).toISOString();
}

export function isMissingPartnerPreviewExpiryColumnError(errorMessage: string) {
  return (
    errorMessage.includes("Could not find the 'expires_at' column") ||
    errorMessage.includes('column "expires_at" does not exist')
  );
}

export function resolvePartnerPreviewExpiresAt(
  expiresAt?: string | null,
  createdAt?: string | null,
) {
  const resolvedExpiresAt = expiresAt?.trim() ?? "";
  if (resolvedExpiresAt) {
    const resolvedExpiresAtMs = new Date(resolvedExpiresAt).getTime();
    if (Number.isFinite(resolvedExpiresAtMs)) {
      return new Date(resolvedExpiresAtMs).toISOString();
    }
  }

  const resolvedCreatedAt = createdAt?.trim() ?? "";
  if (!resolvedCreatedAt) {
    return null;
  }

  const createdAtMs = new Date(resolvedCreatedAt).getTime();
  if (!Number.isFinite(createdAtMs)) {
    return null;
  }

  return createPartnerPreviewExpiresAt(new Date(createdAtMs));
}

export function isPartnerPreviewLinkActive(
  expiresAt?: string | null,
  now = new Date(),
  createdAt?: string | null,
) {
  const resolvedExpiresAt = resolvePartnerPreviewExpiresAt(expiresAt, createdAt);
  if (!resolvedExpiresAt) {
    return false;
  }

  return new Date(resolvedExpiresAt).getTime() > now.getTime();
}

export function buildPartnerPreviewUrl(
  partnerId: string,
  token: string,
  siteUrl = SITE_URL,
) {
  const url = new URL(`/partners/${encodeURIComponent(partnerId)}`, siteUrl);
  url.searchParams.set("preview", token);
  return url.toString();
}
