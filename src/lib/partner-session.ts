import { cookies } from "next/headers";
import { cache } from "react";
import { signPayloadWith } from "./hmac.js";
import {
  loadCurrentPartnerSessionAccess,
  revalidatePartnerSessionAccess,
} from "./partner-session-access.ts";
import {
  buildSessionCookieOptions,
  PARTNER_SESSION_COOKIE_NAME,
} from "./session-cookies.ts";
import { readSessionSecret } from "./session-secrets.ts";
import {
  parsePartnerSessionToken,
  type PartnerSessionTokenPayload,
} from "./session-tokens.ts";

const COOKIE_NAME = PARTNER_SESSION_COOKIE_NAME;
const SESSION_TTL_DAYS = 7;
const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

export type PartnerSession = PartnerSessionTokenPayload;

function getSecret() {
  return readSessionSecret("partner-session");
}

function signPayload(payload: string) {
  return signPayloadWith(payload, getSecret(), "hex");
}

/**
 * Same parser as `src/proxy.ts`, so the partner portal redirect and the
 * server authorization decision cannot disagree about a token.
 */
function verifyToken(token: string) {
  return parsePartnerSessionToken(token, getSecret());
}

export async function getSignedPartnerSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verifyToken(token);
}

export async function setPartnerSession(session: {
  accountId: string;
  loginId: string;
  displayName: string;
  companyIds: string[];
  mustChangePassword?: boolean;
}) {
  const access = await loadCurrentPartnerSessionAccess(session.accountId);
  if (
    !access?.isActive ||
    access.companyIds.length === 0 ||
    !Number.isInteger(access.authSessionVersion) ||
    access.authSessionVersion < 1
  ) {
    throw new Error("활성 파트너 세션을 발급할 수 없습니다.");
  }

  const now = Date.now();
  const payload = JSON.stringify({
    accountId: session.accountId,
    loginId: access.loginId,
    displayName: access.displayName,
    companyIds: access.companyIds,
    authSessionVersion: access.authSessionVersion,
    mustChangePassword: access.mustChangePassword,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  const token = signPayload(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, buildSessionCookieOptions(SESSION_TTL_SECONDS));
}

export async function clearPartnerSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export const getPartnerSession = cache(async () => {
  const signedSession = await getSignedPartnerSession();
  if (!signedSession) {
    return null;
  }
  return revalidatePartnerSessionAccess(signedSession);
});
