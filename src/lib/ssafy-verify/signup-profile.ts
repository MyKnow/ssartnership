import { getSignupSsafyYears } from "@/lib/ssafy-year";
import { getSsafyVerifyServerApiConfig } from "./config";
import type { SsafyVerificationClaims } from "./claims";
import {
  createSsafyVerifyServerApiClient,
  SsafyVerifyServerApiError,
} from "./server-api";
import { extractSsafyVerifyMemberProfiles } from "./profile";
import type { SsafySignupSessionData } from "./signup";

export type SsafySignupProfileResult =
  | { ok: true; session: SsafySignupSessionData }
  | {
      ok: false;
      errorCode:
        | "SSAFY_SIGNUP_PROFILE_UNAVAILABLE"
        | "SSAFY_SIGNUP_PROFILE_NOT_FOUND"
        | "SSAFY_SIGNUP_PROFILE_MISMATCH"
        | "SSAFY_SIGNUP_YEAR_NOT_ALLOWED";
      requestId: string | null;
      status: number;
      providerErrorCode?: string | null;
      lookup: "mattermost_user_id" | "sub";
    };

function parseCohort(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function sourceYearsFromClaims(claims: SsafyVerificationClaims) {
  const cohort = parseCohort(claims.cohort);
  return cohort === null ? [] : [cohort];
}

export async function resolveSsafySignupProfile(input: {
  claims: SsafyVerificationClaims;
  verificationId: string | null;
  scope: string | null;
}): Promise<SsafySignupProfileResult> {
  const lookup = input.claims.mattermostUserId ? "mattermost_user_id" : "sub";

  try {
    const client = createSsafyVerifyServerApiClient(
      getSsafyVerifyServerApiConfig(),
    );
    const payload = input.claims.mattermostUserId
      ? await client.getMattermostUserProfile(input.claims.mattermostUserId)
      : await client.getSsafyMemberProfile(input.claims.sub);
    const profiles = extractSsafyVerifyMemberProfiles(payload);
    const profile =
      profiles.find(
        (item) =>
          item.sub === input.claims.sub ||
          item.mattermostUserId === input.claims.mattermostUserId,
      ) ?? profiles[0];

    if (!profile) {
      return {
        ok: false,
        errorCode: "SSAFY_SIGNUP_PROFILE_UNAVAILABLE",
        requestId: null,
        status: 503,
        providerErrorCode: null,
        lookup,
      };
    }
    if (
      (profile.sub && profile.sub !== input.claims.sub) ||
      (input.claims.mattermostUserId &&
        profile.mattermostUserId !== input.claims.mattermostUserId)
    ) {
      return {
        ok: false,
        errorCode: "SSAFY_SIGNUP_PROFILE_MISMATCH",
        requestId: null,
        status: 409,
        providerErrorCode: null,
        lookup,
      };
    }

    const sourceYears =
      profile.sourceYears.length > 0
        ? profile.sourceYears
        : sourceYearsFromClaims(input.claims);
    const cohort = profile.cohort ?? parseCohort(input.claims.cohort);
    const year = profile.isStaff ? 0 : cohort ?? sourceYears.find((item) => item > 0);
    if (typeof year !== "number" || !getSignupSsafyYears().includes(year)) {
      return {
        ok: false,
        errorCode: "SSAFY_SIGNUP_YEAR_NOT_ALLOWED",
        requestId: null,
        status: 403,
        providerErrorCode: null,
        lookup,
      };
    }

    return {
      ok: true,
      session: {
        sub: input.claims.sub,
        mattermostUserId: profile.mattermostUserId,
        mattermostUsername: profile.mattermostUsername,
        displayName: profile.displayName,
        cohort,
        campus: profile.campus ?? input.claims.campus,
        isStaff: profile.isStaff,
        sourceYears,
        authTime: input.claims.authTime,
        verificationId: input.verificationId,
        scope: input.scope,
      },
    };
  } catch (error) {
    if (error instanceof SsafyVerifyServerApiError) {
      const isProfileNotFound =
        error.status === 404 && error.errorCode === "PROFILE_NOT_FOUND";
      return {
        ok: false,
        errorCode: isProfileNotFound
          ? "SSAFY_SIGNUP_PROFILE_NOT_FOUND"
          : "SSAFY_SIGNUP_PROFILE_UNAVAILABLE",
        requestId: error.requestId,
        status: error.status >= 400 && error.status < 500 ? error.status : 503,
        providerErrorCode: error.errorCode,
        lookup,
      };
    }
    return {
      ok: false,
      errorCode: "SSAFY_SIGNUP_PROFILE_UNAVAILABLE",
      requestId: null,
      status: 503,
      providerErrorCode: null,
      lookup,
    };
  }
}
