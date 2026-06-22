import {
  getPreferredStaffSourceYear,
  SSAFY_STAFF_YEAR,
} from "@/lib/ssafy-year";
import { validatePasswordPolicy } from "@/lib/validation";

type MinimalPolicyDocument = {
  id: string;
  version: number;
};

type PasswordRecord = {
  hash: string;
  salt: string;
};

export type SsafySignupSessionData = {
  sub: string;
  mattermostUserId: string;
  mattermostUsername: string;
  displayName: string;
  cohort: number | null;
  campus: string | null;
  isStaff: boolean;
  sourceYears: number[];
  authTime: number;
  verificationId: string | null;
  scope: string | null;
};

export type SsafySignupCompleteInput = {
  password: string;
  confirmPassword: string;
  servicePolicyId: string;
  privacyPolicyId: string;
  marketingPolicyId: string | null;
  marketingPolicyChecked: boolean;
};

export type SsafySignupCompleteFieldErrors = Partial<
  Record<
    | "password"
    | "confirmPassword"
    | "servicePolicyId"
    | "privacyPolicyId",
    string
  >
>;

export function parseSsafySignupCompleteInput(input: unknown):
  | { ok: true; data: SsafySignupCompleteInput }
  | {
      ok: false;
      errorCode: "INVALID_REQUEST";
      fieldErrors: SsafySignupCompleteFieldErrors;
    } {
  const value =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const data: SsafySignupCompleteInput = {
    password: typeof value.password === "string" ? value.password : "",
    confirmPassword:
      typeof value.confirmPassword === "string" ? value.confirmPassword : "",
    servicePolicyId:
      typeof value.servicePolicyId === "string" ? value.servicePolicyId : "",
    privacyPolicyId:
      typeof value.privacyPolicyId === "string" ? value.privacyPolicyId : "",
    marketingPolicyId:
      typeof value.marketingPolicyId === "string" && value.marketingPolicyId.trim()
        ? value.marketingPolicyId
        : null,
    marketingPolicyChecked: value.marketingPolicyChecked === true,
  };
  const fieldErrors: SsafySignupCompleteFieldErrors = {};
  const passwordError = validatePasswordPolicy(data.password);
  if (passwordError) {
    fieldErrors.password = passwordError;
  }
  if (!data.confirmPassword) {
    fieldErrors.confirmPassword = "비밀번호 확인을 입력해 주세요.";
  } else if (data.password !== data.confirmPassword) {
    fieldErrors.confirmPassword = "비밀번호가 일치하지 않습니다.";
  }
  if (!data.servicePolicyId) {
    fieldErrors.servicePolicyId = "서비스 이용약관에 동의해 주세요.";
  }
  if (!data.privacyPolicyId) {
    fieldErrors.privacyPolicyId = "개인정보 처리방침에 동의해 주세요.";
  }

  return Object.keys(fieldErrors).length > 0
    ? { ok: false, errorCode: "INVALID_REQUEST", fieldErrors }
    : { ok: true, data };
}

function resolveSignupYear(session: SsafySignupSessionData) {
  if (session.isStaff) {
    return {
      year: SSAFY_STAFF_YEAR,
      staffSourceYear:
        getPreferredStaffSourceYear(session.sourceYears) ?? session.cohort ?? null,
    };
  }

  return {
    year: session.cohort ?? session.sourceYears.find((year) => year > 0) ?? 0,
    staffSourceYear: null,
  };
}

export function buildSsafySignupMemberInsertPayload(input: {
  session: SsafySignupSessionData;
  passwordRecord: PasswordRecord;
  activePolicies: {
    service: MinimalPolicyDocument;
    privacy: MinimalPolicyDocument;
  };
  marketingPolicy: MinimalPolicyDocument | null;
  marketingPolicyChecked: boolean;
  agreedAt: string;
}) {
  const { year, staffSourceYear } = resolveSignupYear(input.session);
  const authTimeIso = new Date(input.session.authTime * 1000).toISOString();
  const marketingPolicyVersion =
    input.marketingPolicyChecked && input.marketingPolicy
      ? input.marketingPolicy.version
      : null;

  return {
    mm_user_id: input.session.mattermostUserId,
    mm_username: input.session.mattermostUsername,
    display_name: input.session.displayName,
    year,
    staff_source_year: staffSourceYear,
    campus: input.session.campus,
    password_hash: input.passwordRecord.hash,
    password_salt: input.passwordRecord.salt,
    must_change_password: false,
    service_policy_version: input.activePolicies.service.version,
    service_policy_consented_at: input.agreedAt,
    privacy_policy_version: input.activePolicies.privacy.version,
    privacy_policy_consented_at: input.agreedAt,
    marketing_policy_version: marketingPolicyVersion,
    marketing_policy_consented_at:
      marketingPolicyVersion === null ? null : input.agreedAt,
    ssafy_sub: input.session.sub,
    ssafy_verified_at: authTimeIso,
    ssafy_auth_time: authTimeIso,
    ssafy_verification_id: input.session.verificationId,
    ssafy_mattermost_user_id: input.session.mattermostUserId,
    ssafy_last_scope: input.session.scope,
    created_at: input.agreedAt,
    updated_at: input.agreedAt,
  };
}
