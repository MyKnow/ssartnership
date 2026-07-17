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
