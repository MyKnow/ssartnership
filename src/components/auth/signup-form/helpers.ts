import { isValidPassword } from "../../../lib/password.ts";
import { parseSignupSsafyYearValue } from "../../../lib/ssafy-year.ts";
import {
  PASSWORD_POLICY_MESSAGE,
  validateMmUsername,
} from "../../../lib/validation.ts";
import type {
  SignupAuthNextValidationInput,
  SignupErrorAction,
  SignupGuideItem,
  SignupPolicyState,
  SignupRequestValidationInput,
  SignupVerifyValidationInput,
} from "./types.ts";

export function buildSignupYears(selectableYears: number[]) {
  return [...selectableYears, 0];
}

export function buildSignupGuideItems(signupYearsText: string): SignupGuideItem[] {
  return [
    {
      label: "가입 가능한 기수",
      description: `회원가입은 현재 선택 가능한 ${signupYearsText}만 가능합니다.`,
    },
    {
      label: "인증 번호 안내",
      description:
        "인증 번호는 5분간 유효하며, 5회 실패 시 1시간 동안 인증이 제한됩니다.",
    },
  ];
}

function hasRequiredPolicies(policyChecked: SignupPolicyState) {
  return policyChecked.service && policyChecked.privacy;
}

export function validateSignupRequestInput(
  input: SignupRequestValidationInput,
): SignupErrorAction | null {
  if (!input.username.trim()) {
    return { kind: "field", field: "username", message: "MM 아이디를 입력해 주세요." };
  }

  const usernameError = validateMmUsername(input.username);
  if (usernameError) {
    return { kind: "field", field: "username", message: usernameError };
  }

  const parsedYear = parseSignupSsafyYearValue(input.year);
  if (parsedYear === null || !input.signupYears.includes(parsedYear)) {
    return {
      kind: "field",
      field: "year",
      message: `회원가입은 현재 선택 가능한 ${input.signupYearsText}만 선택할 수 있습니다.`,
    };
  }

  if (!hasRequiredPolicies(input.policyChecked)) {
    return { kind: "field", field: "policies", message: "필수 약관에 모두 동의해 주세요." };
  }

  return null;
}

export function validateSignupAuthNextInput(
  input: SignupAuthNextValidationInput,
): SignupErrorAction | null {
  if (!input.code.trim()) {
    return { kind: "field", field: "code", message: "인증 번호를 입력해 주세요." };
  }

  return null;
}

export function validateSignupVerifyInput(
  input: SignupVerifyValidationInput,
): SignupErrorAction | null {
  const usernameError = validateMmUsername(input.username);
  if (usernameError) {
    return { kind: "field", field: "username", message: usernameError };
  }

  if (!input.code.trim()) {
    return { kind: "field", field: "code", message: "인증 번호를 입력해 주세요." };
  }

  if (!input.password) {
    return { kind: "field", field: "password", message: "사용할 비밀번호를 입력해 주세요." };
  }

  if (!isValidPassword(input.password)) {
    return { kind: "field", field: "password", message: PASSWORD_POLICY_MESSAGE };
  }

  if (!input.passwordConfirm) {
    return {
      kind: "field",
      field: "passwordConfirm",
      message: "비밀번호를 한 번 더 입력해 주세요.",
    };
  }

  if (input.password !== input.passwordConfirm) {
    return {
      kind: "field",
      field: "passwordConfirm",
      message: "비밀번호가 일치하지 않습니다.",
    };
  }

  if (!hasRequiredPolicies(input.policyChecked)) {
    return { kind: "field", field: "policies", message: "필수 약관에 모두 동의해 주세요." };
  }

  return null;
}

export function getSignupRequestErrorAction(
  error: string | undefined,
  message: string | undefined,
  signupYearsText: string,
): SignupErrorAction {
  if (error === "invalid_username") {
    return {
      kind: "field",
      field: "username",
      message: "MM 아이디 형식을 확인해 주세요.",
    };
  }

  if (error === "invalid_year") {
    return {
      kind: "field",
      field: "year",
      message:
        message ??
        `회원가입은 현재 선택 가능한 ${signupYearsText}만 선택할 수 있습니다.`,
    };
  }

  if (error === "blocked") {
    return {
      kind: "form",
      message: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  if (error === "cooldown") {
    return {
      kind: "form",
      message: "인증 번호 요청이 너무 잦습니다. 60초 후 다시 시도해 주세요.",
    };
  }

  return {
    kind: "form",
    message: "MM 계정을 확인할 수 없습니다.",
  };
}

export function getSignupVerifyErrorAction(
  error: string | undefined,
  message: string | undefined,
): SignupErrorAction {
  if (error === "invalid_password") {
    return {
      kind: "field",
      field: "password",
      message: message ?? PASSWORD_POLICY_MESSAGE,
    };
  }

  if (error === "policy_required") {
    return {
      kind: "field",
      field: "policies",
      message: "필수 약관에 모두 동의해 주세요.",
    };
  }

  if (error === "invalid_username") {
    return {
      kind: "field",
      field: "username",
      message: "MM 아이디 형식을 확인해 주세요.",
    };
  }

  if (error === "expired") {
    return {
      kind: "form",
      message: "인증 번호가 만료되었습니다. 다시 요청해 주세요.",
      nextStep: "auth",
    };
  }

  if (error === "blocked") {
    return {
      kind: "form",
      message: "인증 실패가 누적되어 1시간 차단되었습니다.",
    };
  }

  if (error === "policy_outdated") {
    return {
      kind: "form",
      message: message ?? "약관 버전이 변경되었습니다. 다시 확인해 주세요.",
      refresh: true,
    };
  }

  return {
    kind: "field",
    field: "code",
    message: "인증 번호가 올바르지 않습니다.",
  };
}
