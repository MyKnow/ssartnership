export const SSAFY_VERIFY_ISSUER = "https://verify.myknow.xyz";
export const SSAFY_VERIFY_SDK_URL = `${SSAFY_VERIFY_ISSUER}/sdk/ssafy-verify.js`;
export const SSAFY_VERIFY_EXPECTED_ACR =
  "urn:ssafy:verify:assurance:mattermost-team-dm:v1";

export type SsafyVerifyServerConfig = {
  issuer: string;
  clientId: string;
  redirectUris: readonly string[];
  clientSecret: string | null;
};

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} 환경 변수가 필요합니다.`);
  }
  return value;
}

function normalizeRedirectUri(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const url = new URL(trimmed);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  return url.toString();
}

export function parseSsafyVerifyRedirectUris(input: string | undefined) {
  if (!input) {
    return [];
  }

  const redirectUris = new Set<string>();
  for (const value of input.split(/[,\s]+/)) {
    const normalized = normalizeRedirectUri(value);
    if (normalized) {
      redirectUris.add(normalized);
    }
  }

  return [...redirectUris];
}

function readRedirectUris() {
  const redirectUris = [
    ...parseSsafyVerifyRedirectUris(process.env.SSAFY_VERIFY_REDIRECT_URIS),
    ...parseSsafyVerifyRedirectUris(process.env.SSAFY_VERIFY_REDIRECT_URI),
  ];

  const uniqueRedirectUris = [...new Set(redirectUris)];
  if (uniqueRedirectUris.length === 0) {
    throw new Error("SSAFY_VERIFY_REDIRECT_URIS 환경 변수가 필요합니다.");
  }

  return uniqueRedirectUris;
}

export function getSsafyVerifyServerConfig(): SsafyVerifyServerConfig {
  return {
    issuer: readRequiredEnv("SSAFY_VERIFY_ISSUER"),
    clientId: readRequiredEnv("SSAFY_VERIFY_CLIENT_ID"),
    redirectUris: readRedirectUris(),
    clientSecret: process.env.SSAFY_VERIFY_CLIENT_SECRET?.trim() || null,
  };
}
