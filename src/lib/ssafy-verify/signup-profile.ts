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
      diagnostic: {
        cause:
          | "local_lookup_error"
          | "profile_mismatch"
          | "profile_payload_unparseable"
          | "server_api_error"
          | "year_not_allowed";
        message: string | null;
        payloadShape?: {
          topLevelKeys: string[];
          dataKeys: string[];
          profileKeys: string[];
        };
      };
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

function uniqueSortedYears(values: Iterable<number | null | undefined>) {
  return Array.from(
    new Set(
      Array.from(values).filter(
        (value): value is number =>
          typeof value === "number" &&
          Number.isInteger(value) &&
          value >= 0 &&
          value <= 99,
      ),
    ),
  ).sort((a, b) => a - b);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeKeys(value: unknown) {
  return isRecord(value) ? Object.keys(value).sort().slice(0, 30) : [];
}

function describePayloadShape(payload: unknown) {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
  const profile = data && isRecord(data.profile) ? data.profile : null;

  return {
    topLevelKeys: safeKeys(payload),
    dataKeys: safeKeys(data),
    profileKeys: safeKeys(profile),
  };
}

function readPayloadSub(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }
  const candidates = [
    payload.sub,
    isRecord(payload.data) ? payload.data.sub : null,
    isRecord(payload.data) && isRecord(payload.data.profile)
      ? payload.data.profile.sub
      : null,
  ];
  const sub = candidates.find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  return sub?.trim() ?? null;
}

function safeDiagnosticMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }
  const message = error.message.trim();
  if (!message || message.length > 300) {
    return null;
  }
  return message;
}

function roleIndicatesStaff(claims: SsafyVerificationClaims) {
  return (
    claims.role === "staff" ||
    claims.role === "admin" ||
    claims.role === "operator"
  );
}

function resolveYear(input: {
  isStaff: boolean;
  cohort: number | null;
  sourceYears: number[];
}) {
  return input.isStaff
    ? 0
    : input.cohort ?? input.sourceYears.find((item) => item > 0);
}

function buildClaimFallbackSession(input: {
  claims: SsafyVerificationClaims;
  verificationId: string | null;
  scope: string | null;
}) {
  if (!input.claims.mattermostUserId) {
    return null;
  }

  const cohort = parseCohort(input.claims.cohort);
  const isStaff = input.claims.isStaff ?? roleIndicatesStaff(input.claims);
  const sourceYears = uniqueSortedYears([
    ...sourceYearsFromClaims(input.claims),
    ...(isStaff ? [0] : []),
  ]);
  const year = resolveYear({ isStaff, cohort, sourceYears });
  if (typeof year !== "number" || !getSignupSsafyYears().includes(year)) {
    return null;
  }

  return {
    sub: input.claims.sub,
    mattermostUserId: input.claims.mattermostUserId,
    mattermostUsername: input.claims.mattermostUserId,
    displayName: input.claims.name ?? input.claims.mattermostUserId,
    cohort,
    campus: input.claims.campus,
    isStaff,
    sourceYears,
    authTime: input.claims.authTime,
    verificationId: input.verificationId,
    scope: input.scope,
  } satisfies SsafySignupSessionData;
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
      const payloadSub = readPayloadSub(payload);
      if (payloadSub && payloadSub !== input.claims.sub) {
        return {
          ok: false,
          errorCode: "SSAFY_SIGNUP_PROFILE_MISMATCH",
          requestId: null,
          status: 409,
          providerErrorCode: null,
          lookup,
          diagnostic: {
            cause: "profile_mismatch",
            message: "Verify Server API profile이 인증 token claim과 일치하지 않습니다.",
            payloadShape: describePayloadShape(payload),
          },
        };
      }

      const fallbackSession =
        lookup === "mattermost_user_id"
          ? buildClaimFallbackSession(input)
          : null;
      if (fallbackSession) {
        return {
          ok: true,
          session: fallbackSession,
        };
      }

      return {
        ok: false,
        errorCode: "SSAFY_SIGNUP_PROFILE_UNAVAILABLE",
        requestId: null,
        status: 503,
        providerErrorCode: null,
        lookup,
        diagnostic: {
          cause: "profile_payload_unparseable",
          message: "Verify Server API 응답에서 회원가입에 필요한 Mattermost profile을 추출하지 못했습니다.",
          payloadShape: describePayloadShape(payload),
        },
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
        diagnostic: {
          cause: "profile_mismatch",
          message: "Verify Server API profile이 인증 token claim과 일치하지 않습니다.",
        },
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
        diagnostic: {
          cause: "year_not_allowed",
          message: "인증 profile의 기수가 현재 회원가입 허용 범위가 아닙니다.",
        },
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
        diagnostic: {
          cause: "server_api_error",
          message: error.message,
        },
      };
    }
    return {
      ok: false,
      errorCode: "SSAFY_SIGNUP_PROFILE_UNAVAILABLE",
      requestId: null,
      status: 503,
      providerErrorCode: "LOCAL_PROFILE_LOOKUP_ERROR",
      lookup,
      diagnostic: {
        cause: "local_lookup_error",
        message: safeDiagnosticMessage(error),
      },
    };
  }
}
