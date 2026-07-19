import { validatePasswordPolicy } from "@/lib/validation";
import { isUuid } from "@/lib/uuid";

export type MemberSignupCompleteInput = {
  password: string;
  confirmPassword: string;
  servicePolicyId: string;
  privacyPolicyId: string;
  marketingPolicyId: string | null;
  marketingPolicyChecked: boolean;
  profileImageUploadId: string | null;
};

export type MemberSignupCompleteFieldErrors = Partial<
  Record<
    | "password"
    | "confirmPassword"
    | "servicePolicyId"
    | "privacyPolicyId"
    | "profileImageUploadId",
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

export function getMemberSignupPasswordError(value: string, required = true) {
  if (!value && !required) {
    return undefined;
  }
  return validatePasswordPolicy(value) ?? undefined;
}

export function getMemberSignupConfirmPasswordError(
  password: string,
  confirmPassword: string,
  required = true,
) {
  if (!confirmPassword && !required) {
    return undefined;
  }
  if (!confirmPassword) {
    return "비밀번호 확인을 입력해 주세요.";
  }
  return password === confirmPassword ? undefined : "비밀번호가 일치하지 않습니다.";
}

export function getMemberSignupPasswordFieldErrors(
  input: Pick<MemberSignupCompleteInput, "password" | "confirmPassword">,
  options: {
    requirePassword?: boolean;
    requireConfirmPassword?: boolean;
  } = {},
): Pick<MemberSignupCompleteFieldErrors, "password" | "confirmPassword"> {
  const passwordError = getMemberSignupPasswordError(
    input.password,
    options.requirePassword ?? true,
  );
  const confirmPasswordError = getMemberSignupConfirmPasswordError(
    input.password,
    input.confirmPassword,
    options.requireConfirmPassword ?? true,
  );
  return {
    ...(passwordError ? { password: passwordError } : {}),
    ...(confirmPasswordError ? { confirmPassword: confirmPasswordError } : {}),
  };
}

export function getMemberSignupActionState(input: MemberSignupActionStateInput) {
  const passwordErrors = getMemberSignupPasswordFieldErrors({
    password: input.password,
    confirmPassword: input.confirmPassword,
  });
  const passwordsReady = Object.keys(passwordErrors).length === 0;
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
    profileImageUploadId: typeof value.profileImageUploadId === "string"
      && value.profileImageUploadId.trim()
      ? value.profileImageUploadId.trim().toLowerCase()
      : null,
  };
  const fieldErrors: MemberSignupCompleteFieldErrors = {};
  Object.assign(
    fieldErrors,
    getMemberSignupPasswordFieldErrors({
      password: data.password,
      confirmPassword: data.confirmPassword,
    }),
  );
  if (!data.servicePolicyId) fieldErrors.servicePolicyId = "서비스 이용약관에 동의해 주세요.";
  if (!data.privacyPolicyId) fieldErrors.privacyPolicyId = "개인정보 처리방침에 동의해 주세요.";
  if (
    typeof value.profileImageUploadId === "string"
    && value.profileImageUploadId.trim()
    && !isUuid(value.profileImageUploadId)
  ) {
    fieldErrors.profileImageUploadId = "프로필 사진 업로드 정보를 확인해 주세요.";
  }
  return Object.keys(fieldErrors).length > 0
    ? { ok: false, fieldErrors }
    : { ok: true, data };
}
