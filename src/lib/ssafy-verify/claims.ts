import type { JWTPayload } from "jose";
import { SSAFY_VERIFY_EXPECTED_ACR } from "./config";

type ClaimValue = JWTPayload[string];

export type SsafyVerificationClaims = {
  sub: string;
  verified: true;
  authTime: number;
  cohort: string | null;
  campus: string | null;
  region: string | null;
  name: string | null;
  picture: string | null;
  role: string | null;
  roleName: string | null;
  teamCode: string | null;
  isStaff: boolean | null;
  mattermostUserId: string | null;
};

export type SsafyVerificationClaimResult =
  | { ok: true; claims: SsafyVerificationClaims }
  | { ok: false; errorCode: "VERIFY_TOKEN_INVALID" };

function firstAudience(value: ClaimValue) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === "string") ?? null;
  }
  return null;
}

function optionalString(value: ClaimValue) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalBoolean(value: ClaimValue) {
  return typeof value === "boolean" ? value : null;
}

export function validateSsafyVerificationClaims(
  claims: JWTPayload,
  expected: { issuer: string; clientId: string; now?: number },
): SsafyVerificationClaimResult {
  const now = expected.now ?? Math.floor(Date.now() / 1000);
  const aud = firstAudience(claims.aud);

  if (claims.iss !== expected.issuer) return { ok: false, errorCode: "VERIFY_TOKEN_INVALID" };
  if (aud !== expected.clientId) return { ok: false, errorCode: "VERIFY_TOKEN_INVALID" };
  if (typeof claims.exp !== "number" || claims.exp <= now) {
    return { ok: false, errorCode: "VERIFY_TOKEN_INVALID" };
  }
  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    return { ok: false, errorCode: "VERIFY_TOKEN_INVALID" };
  }
  if (claims.client_id !== expected.clientId) {
    return { ok: false, errorCode: "VERIFY_TOKEN_INVALID" };
  }
  if (claims.verified !== true) {
    return { ok: false, errorCode: "VERIFY_TOKEN_INVALID" };
  }
  if (typeof claims.auth_time !== "number") {
    return { ok: false, errorCode: "VERIFY_TOKEN_INVALID" };
  }
  if (!Array.isArray(claims.amr) || !claims.amr.includes("mattermost_dm")) {
    return { ok: false, errorCode: "VERIFY_TOKEN_INVALID" };
  }
  if (claims.acr !== SSAFY_VERIFY_EXPECTED_ACR) {
    return { ok: false, errorCode: "VERIFY_TOKEN_INVALID" };
  }

  return {
    ok: true,
    claims: {
      sub: claims.sub,
      verified: true,
      authTime: claims.auth_time,
      cohort: optionalString(claims.ssafy_cohort),
      campus: optionalString(claims.ssafy_campus),
      region: optionalString(claims.ssafy_region),
      name: optionalString(claims.name),
      picture: optionalString(claims.picture),
      role: optionalString(claims.ssafy_role),
      roleName:
        optionalString(claims.ssafy_member_role) ?? optionalString(claims.ssafy_role_name),
      teamCode: optionalString(claims.ssafy_team_code),
      isStaff: optionalBoolean(claims.ssafy_is_staff),
      mattermostUserId: optionalString(claims.ssafy_mattermost_user_id),
    },
  };
}
