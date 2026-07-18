import { validatePasswordPolicy } from "@/lib/validation";

export type MemberSignupCompleteInput = {
  password: string;
  confirmPassword: string;
  servicePolicyId: string;
  privacyPolicyId: string;
  marketingPolicyId: string | null;
  marketingPolicyChecked: boolean;
};

export type MemberSignupCompleteFieldErrors = Partial<
  Record<
    | "password"
    | "confirmPassword"
    | "servicePolicyId"
    | "privacyPolicyId",
    string
  >
>;

export type MemberSignupActionStateInput = {
  password: string;
  confirmPassword: string;
  serviceChecked: boolean;
  privacyChecked: boolean;
  marketingChecked: boolean;
  hasMarketingPolicy: boolean;
};

export function getMemberSignupActionState(input: MemberSignupActionStateInput) {
  const passwordsReady = Boolean(input.password)
    && Boolean(input.confirmPassword)
    && input.password === input.confirmPassword;
  const requiredPoliciesChecked = input.serviceChecked && input.privacyChecked;
  const shouldAgreeAll = !requiredPoliciesChecked;

  return {
    disabled: !passwordsReady,
    label: requiredPoliciesChecked ? "회원가입하기" : "모두 동의하고 시작하기",
    submissionChecked: shouldAgreeAll
      ? {
          service: true,
          privacy: true,
          marketing: input.hasMarketingPolicy,
        }
      : {
          service: input.serviceChecked,
          privacy: input.privacyChecked,
          marketing: input.marketingChecked,
        },
  };
}

export function parseMemberSignupCompleteInput(input: unknown):
  | { ok: true; data: MemberSignupCompleteInput }
  | { ok: false; fieldErrors: MemberSignupCompleteFieldErrors } {
  const value = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const data: MemberSignupCompleteInput = {
    password: typeof value.password === "string" ? value.password : "",
    confirmPassword: typeof value.confirmPassword === "string" ? value.confirmPassword : "",
    servicePolicyId: typeof value.servicePolicyId === "string" ? value.servicePolicyId : "",
    privacyPolicyId: typeof value.privacyPolicyId === "string" ? value.privacyPolicyId : "",
    marketingPolicyId: typeof value.marketingPolicyId === "string" && value.marketingPolicyId.trim()
      ? value.marketingPolicyId
      : null,
    marketingPolicyChecked: value.marketingPolicyChecked === true,
  };
  const fieldErrors: MemberSignupCompleteFieldErrors = {};
  const passwordError = validatePasswordPolicy(data.password);
  if (passwordError) fieldErrors.password = passwordError;
  if (!data.confirmPassword) {
    fieldErrors.confirmPassword = "비밀번호 확인을 입력해 주세요.";
  } else if (data.password !== data.confirmPassword) {
    fieldErrors.confirmPassword = "비밀번호가 일치하지 않습니다.";
  }
  if (!data.servicePolicyId) fieldErrors.servicePolicyId = "서비스 이용약관에 동의해 주세요.";
  if (!data.privacyPolicyId) fieldErrors.privacyPolicyId = "개인정보 처리방침에 동의해 주세요.";
  return Object.keys(fieldErrors).length > 0
    ? { ok: false, fieldErrors }
    : { ok: true, data };
}
