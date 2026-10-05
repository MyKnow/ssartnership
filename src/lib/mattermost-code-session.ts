import { cookies } from "next/headers";
import { openSignedPayload, signPayloadWith } from "@/lib/hmac.js";
import {
  normalizeMattermostSignupParseReason,
  type MattermostSignupMode,
  type MattermostSignupParseReason,
} from "@/lib/mm-signup-approval";
import {
  buildSessionCookieOptions,
  MATTERMOST_CODE_SESSION_COOKIE_NAME,
} from "@/lib/session-cookies";
import { readSessionSecret } from "@/lib/session-secrets";
import { isUuid } from "@/lib/uuid";

const COOKIE_NAME = MATTERMOST_CODE_SESSION_COOKIE_NAME;
const SESSION_TTL_MS = 20 * 60 * 1000;

export type MattermostCodeSessionPurpose = "signup" | "reset_password";

export type MattermostCodeSession = {
  purpose: MattermostCodeSessionPurpose;
  mmUserId: string;
  mmUsername: string;
  displayName: string;
  campus?: string | null;
  subjectGeneration: number;
  senderGeneration: number;
  signupMode?: MattermostSignupMode;
  parseExclusionReason?: MattermostSignupParseReason | null;
  signupUploadOwnerId?: string;
};

type SignedMattermostCodeSession = MattermostCodeSession & {
  issuedAt: number;
  expiresAt: number;
};

function getSecret() {
  return readSessionSecret("mattermost-code-session", {
    errorMessage: "USER_SESSION_SECRET 환경 변수가 필요합니다.",
  });
}

function parseSessionPayload(value: unknown): SignedMattermostCodeSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const payload = value as Record<string, unknown>;
  if (
    (payload.purpose !== "signup" && payload.purpose !== "reset_password")
    || typeof payload.mmUserId !== "string"
    || !payload.mmUserId
    || typeof payload.mmUsername !== "string"
    || !payload.mmUsername
    || typeof payload.displayName !== "string"
    || !payload.displayName
    || (payload.campus !== undefined
      && payload.campus !== null
      && typeof payload.campus !== "string")
    || !Number.isSafeInteger(payload.subjectGeneration)
    || (payload.subjectGeneration as number) < 0
    || !Number.isSafeInteger(payload.senderGeneration)
    || (payload.senderGeneration as number) < 1
    || typeof payload.issuedAt !== "number"
    || typeof payload.expiresAt !== "number"
    || (payload.issuedAt as number) > Date.now()
    || (payload.expiresAt as number) <= Date.now()
  ) {
    return null;
  }
  if (payload.purpose === "signup" && !isUuid(String(payload.signupUploadOwnerId ?? ""))) {
    return null;
  }
  const signupMode = payload.purpose === "signup"
    ? payload.signupMode === "approval"
      ? "approval"
      : "direct"
    : undefined;
  const parseExclusionReason = payload.purpose === "signup"
    ? normalizeMattermostSignupParseReason(payload.parseExclusionReason)
    : null;
  return {
    ...payload,
    ...(signupMode ? { signupMode } : {}),
    ...(parseExclusionReason ? { parseExclusionReason } : {}),
    ...(payload.purpose === "signup"
      ? {
          campus: typeof payload.campus === "string"
            ? payload.campus.trim() || null
            : null,
          signupUploadOwnerId: payload.signupUploadOwnerId as string,
        }
      : {}),
  } as SignedMattermostCodeSession;
}

function verifySessionToken(token: string) {
  const payload = openSignedPayload(token, getSecret(), "hex");
  if (!payload) {
    return null;
  }
  try {
    return parseSessionPayload(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  } catch {
    return null;
  }
}

export async function setMattermostCodeSession(session: MattermostCodeSession) {
  if (session.purpose === "signup" && !isUuid(session.signupUploadOwnerId ?? "")) {
    throw new Error("signupUploadOwnerId가 필요합니다.");
  }
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({
    ...session,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  }), "utf8").toString("base64url");
  const token = signPayloadWith(payload, getSecret(), "hex");
  const store = await cookies();
  store.set(COOKIE_NAME, token, buildSessionCookieOptions(SESSION_TTL_MS / 1000));
}

export async function getMattermostCodeSession(
  purpose: MattermostCodeSessionPurpose,
) {
  const store = await cookies();
  const session = verifySessionToken(store.get(COOKIE_NAME)?.value ?? "");
  return session?.purpose === purpose ? session : null;
}

export async function clearMattermostCodeSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
