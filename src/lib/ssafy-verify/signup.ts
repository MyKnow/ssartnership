import {
  getPreferredStaffSourceYear,
  SSAFY_STAFF_YEAR,
} from "@/lib/ssafy-year";
import { validatePasswordPolicy } from "@/lib/validation";

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
  track: string | null;
  trackName: string | null;
  avatarUrl: string | null;
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

export function resolveSignupGeneration(session: SsafySignupSessionData) {
  if (session.isStaff) {
    return {
      generation: SSAFY_STAFF_YEAR,
      staffSourceGeneration:
        getPreferredStaffSourceYear(session.sourceYears) ??
        (session.cohort !== null && session.cohort > SSAFY_STAFF_YEAR
          ? session.cohort
          : null),
    };
  }

  return {
    generation:
      session.cohort ?? session.sourceYears.find((generation) => generation > 0) ?? 0,
    staffSourceGeneration: null,
  };
}

export function buildSsafySignupMemberInsertPayload(input: {
  session: SsafySignupSessionData;
  passwordRecord: PasswordRecord;
  agreedAt: string;
}) {
  const { generation, staffSourceGeneration } = resolveSignupGeneration(input.session);

  return {
    display_name: input.session.displayName,
    generation,
    staff_source_generation: staffSourceGeneration,
    campus: input.session.campus,
    password_hash: input.passwordRecord.hash,
    password_salt: input.passwordRecord.salt,
    must_change_password: false,
    created_at: input.agreedAt,
    updated_at: input.agreedAt,
  };
}
