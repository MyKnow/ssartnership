import { PASSWORD_POLICY_MESSAGE, validatePasswordPolicy } from "@/lib/validation";

export type AuthPasswordPairField = "password" | "confirmPassword";
export type AuthPasswordChangeField = "currentPassword" | "nextPassword";

export type AuthFieldValidationResult<Field extends string> = {
  fieldErrors: Partial<Record<Field, string>>;
  firstInvalidField: Field | null;
};

function firstFieldWithError<Field extends string>(
  fieldErrors: Partial<Record<Field, string>>,
  order: Field[],
) {
  return order.find((field) => Boolean(fieldErrors[field])) ?? null;
}

export function validateAuthPasswordPairDraft({
  password,
  confirmPassword,
  validatePolicy = false,
}: {
  password: string;
  confirmPassword: string;
  validatePolicy?: boolean;
}): AuthFieldValidationResult<AuthPasswordPairField> {
  const passwordField: AuthPasswordPairField = "password";
  const fieldErrors: Partial<Record<AuthPasswordPairField, string>> = {};

  if (!password) {
    fieldErrors[passwordField] = "새 비밀번호를 입력해 주세요.";
  }
  if (!confirmPassword) {
    fieldErrors.confirmPassword = "비밀번호 확인을 입력해 주세요.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      firstInvalidField: firstFieldWithError(fieldErrors, [
        "password",
        "confirmPassword",
      ]),
    };
  }

  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = "비밀번호가 서로 일치하지 않습니다.";
    return {
      fieldErrors,
      firstInvalidField: "confirmPassword",
    };
  }

  if (validatePolicy) {
    const policyError = validatePasswordPolicy(password);
    if (policyError) {
      fieldErrors[passwordField] = PASSWORD_POLICY_MESSAGE;
    }
  }

  return {
    fieldErrors,
    firstInvalidField: firstFieldWithError(fieldErrors, [
      "password",
      "confirmPassword",
    ]),
  };
}

export function validateAuthPasswordChangeDraft({
  currentPassword,
  nextPassword,
  validatePolicy = false,
}: {
  currentPassword: string;
  nextPassword: string;
  validatePolicy?: boolean;
}): AuthFieldValidationResult<AuthPasswordChangeField> {
  const nextPasswordField: AuthPasswordChangeField = "nextPassword";
  const fieldErrors: Partial<Record<AuthPasswordChangeField, string>> = {};

  if (!currentPassword) {
    fieldErrors.currentPassword = "현재 비밀번호를 입력해 주세요.";
  }
  if (!nextPassword) {
    fieldErrors[nextPasswordField] = "새 비밀번호를 입력해 주세요.";
  }
  if (!fieldErrors[nextPasswordField] && validatePolicy) {
    const policyError = validatePasswordPolicy(nextPassword);
    if (policyError) {
      fieldErrors[nextPasswordField] = PASSWORD_POLICY_MESSAGE;
    }
  }

  return {
    fieldErrors,
    firstInvalidField: firstFieldWithError(fieldErrors, [
      "currentPassword",
      "nextPassword",
    ]),
  };
}
