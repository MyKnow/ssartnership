import { generateOpaqueToken, hashOpaqueToken } from "@/lib/password";
import { SITE_URL } from "@/lib/site";

const PARTNER_PREVIEW_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export function createPartnerPreviewToken() {
  return generateOpaqueToken(32);
}

export function hashPartnerPreviewToken(token: string) {
  return hashOpaqueToken(token.trim());
}

export function isValidPartnerPreviewToken(token: string) {
  return PARTNER_PREVIEW_TOKEN_PATTERN.test(token.trim());
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
