import type { SsafyVerifyCallbackPayload } from "@/lib/ssafy-verify/client-errors";

export type SsafyVerifyRedirectPurpose = "member-login" | "reset-password";

export type SsafyVerifyRedirectSession = {
  version: 1;
  purpose: SsafyVerifyRedirectPurpose;
  state: string;
  codeVerifier: string;
  redirectUri: string;
  returnTo: string | null;
  createdAt: number;
};

export type SsafyVerifyRedirectStartOptions = {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  purpose: SsafyVerifyRedirectPurpose;
  returnTo?: string | null;
};

export type SsafyVerifyRedirectFlowErrorCode =
  | "SSAFY_VERIFY_CRYPTO_UNAVAILABLE"
  | "SSAFY_VERIFY_REDIRECT_SESSION_MISSING";

export class SsafyVerifyRedirectFlowError extends Error {
  error_code: SsafyVerifyRedirectFlowErrorCode;
  request_id = null;
  phase: string | null;

  constructor(errorCode: SsafyVerifyRedirectFlowErrorCode, phase: string) {
    super(errorCode);
    this.name = "SsafyVerifyRedirectFlowError";
    this.error_code = errorCode;
    this.phase = phase;
  }
}

export const SSAFY_VERIFY_REDIRECT_SESSION_KEY = "ssafyVerify:redirect";

const issuer = "https://verify.myknow.xyz";
const authorizeUrl = `${issuer}/verify/authorize`;
const verifierChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
const redirectSessionMaxAgeMs = 10 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function randomString(length: number) {
  const values = new Uint32Array(length);
  window.crypto.getRandomValues(values);
  let output = "";
  for (const value of values) {
    output += verifierChars[value % verifierChars.length];
  }
  return output;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256Base64Url(value: string) {
  if (!window.crypto?.subtle) {
    throw new SsafyVerifyRedirectFlowError(
      "SSAFY_VERIFY_CRYPTO_UNAVAILABLE",
      "preflight",
    );
  }

  const data = new TextEncoder().encode(value);
  const hash = await window.crypto.subtle.digest("SHA-256", data);
  return toBase64Url(new Uint8Array(hash));
}

export function shouldUseSsafyVerifyRedirectFlow({
  userAgent,
  platform,
  maxTouchPoints,
}: {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}) {
  const normalizedUserAgent = userAgent.toLowerCase();
  const isIOSDevice =
    /iphone|ipad|ipod/.test(normalizedUserAgent) ||
    (platform === "MacIntel" && Number(maxTouchPoints) > 1);

  return isIOSDevice;
}

export async function startSsafyVerifyRedirectFlow({
  clientId,
  redirectUri,
  scopes,
  purpose,
  returnTo = null,
}: SsafyVerifyRedirectStartOptions) {
  const state = randomString(32);
  const codeVerifier = randomString(64);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const session: SsafyVerifyRedirectSession = {
    version: 1,
    purpose,
    state,
    codeVerifier,
    redirectUri,
    returnTo,
    createdAt: Date.now(),
  };

  const url = new URL(authorizeUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  window.sessionStorage.setItem(
    SSAFY_VERIFY_REDIRECT_SESSION_KEY,
    JSON.stringify(session),
  );
  window.location.assign(url.toString());
}

function isValidRedirectPurpose(value: unknown): value is SsafyVerifyRedirectPurpose {
  return value === "member-login" || value === "reset-password";
}

export function readSsafyVerifyRedirectSession(
  storage: Storage = window.sessionStorage,
): SsafyVerifyRedirectSession | null {
  const rawValue = storage.getItem(SSAFY_VERIFY_REDIRECT_SESSION_KEY);
  if (!rawValue) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  if (
    parsed.version !== 1 ||
    !isValidRedirectPurpose(parsed.purpose) ||
    typeof parsed.state !== "string" ||
    typeof parsed.codeVerifier !== "string" ||
    typeof parsed.redirectUri !== "string" ||
    (parsed.returnTo !== null && typeof parsed.returnTo !== "string") ||
    typeof parsed.createdAt !== "number"
  ) {
    return null;
  }

  if (Date.now() - parsed.createdAt > redirectSessionMaxAgeMs) {
    return null;
  }

  return parsed as SsafyVerifyRedirectSession;
}

export function clearSsafyVerifyRedirectSession(
  storage: Storage = window.sessionStorage,
) {
  storage.removeItem(SSAFY_VERIFY_REDIRECT_SESSION_KEY);
}

export function readSsafyVerifyCallbackPayload(
  locationObject: Location = window.location,
): SsafyVerifyCallbackPayload {
  const params = new URL(locationObject.href).searchParams;
  return {
    code: params.get("code"),
    state: params.get("state"),
    iss: params.get("iss"),
    error: params.get("error"),
    error_code: params.get("error_code"),
    request_id: params.get("request_id"),
    message: params.get("message"),
    phase: "callback",
    codeVerifier: "",
  };
}

