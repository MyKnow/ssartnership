import { cookies } from "next/headers";
import { createHmacDigest, splitSignedToken, verifyHmacDigest } from "./hmac.js";

const COOKIE_NAME = "partner_session";
const SESSION_TTL_DAYS = 7;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export type PartnerSession = {
  accountId: string;
  loginId: string;
  displayName: string;
  companyIds: string[];
  issuedAt: number;
  expiresAt: number;
};

function getSecret() {
  const secret = process.env.PARTNER_SESSION_SECRET ?? process.env.USER_SESSION_SECRET;
  if (!secret) {
    throw new Error("PARTNER_SESSION_SECRET 환경 변수가 필요합니다.");
  }
  if (secret.length < 32) {
    throw new Error("PARTNER_SESSION_SECRET는 최소 32자 이상이어야 합니다.");
  }
  return secret;
}

function signPayload(payload: string) {
  const secret = getSecret();
  const signature = createHmacDigest(payload, secret, "hex");
  return `${payload}.${signature}`;
}

function verifyToken(token: string) {
  const signedToken = splitSignedToken(token);
  if (!signedToken) {
    return null;
  }
  const [payload, signature] = signedToken;
  if (!payload || !signature) {
    return null;
  }
  if (!verifyHmacDigest(payload, signature, getSecret(), "hex")) {
    return null;
  }
  try {
    const parsed = JSON.parse(payload) as Partial<PartnerSession>;
    if (
      typeof parsed.accountId !== "string" ||
      typeof parsed.loginId !== "string" ||
      typeof parsed.displayName !== "string" ||
      !Array.isArray(parsed.companyIds) ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    if (parsed.expiresAt <= Date.now() || parsed.issuedAt > Date.now()) {
      return null;
    }
    if (parsed.companyIds.some((companyId) => typeof companyId !== "string" || !companyId)) {
      return null;
    }
    if (parsed.companyIds.length === 0) {
      return null;
    }
    return {
      accountId: parsed.accountId,
      loginId: parsed.loginId,
      displayName: parsed.displayName,
      companyIds: parsed.companyIds,
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
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
}) {
  const now = Date.now();
  const payload = JSON.stringify({
    accountId: session.accountId,
    loginId: session.loginId,
    displayName: session.displayName,
    companyIds: session.companyIds,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  const token = signPayload(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function clearPartnerSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getPartnerSession() {
  return getSignedPartnerSession();
}
