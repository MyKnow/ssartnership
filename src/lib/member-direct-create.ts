import {
  parseMemberYearValue,
  validateAdminIdentifier,
  validateMemberYear,
  validatePasswordPolicy,
} from "@/lib/validation";

export const DIRECT_MEMBER_LOGIN_ID_PREFIX = "manual-";

const DISPLAY_NAME_MAX_LENGTH = 80;
const CAMPUS_MAX_LENGTH = 80;
const CONTROL_CHARACTER_REGEX = /[\u0000-\u001F\u007F]/;

export type DirectMemberCreateField =
  | "loginId"
  | "displayName"
  | "generation"
  | "campus"
  | "temporaryPassword"
  | "temporaryPasswordConfirmation";

export type DirectMemberCreateFieldErrors = Partial<
  Record<DirectMemberCreateField, string>
>;

export type DirectMemberCreateInput = {
  loginId: unknown;
  displayName: unknown;
  generation: unknown;
  campus: unknown;
  temporaryPassword: unknown;
  temporaryPasswordConfirmation: unknown;
};

export type DirectMemberCreateValue = {
  manualLoginId: string;
  displayName: string;
  generation: number;
  campus: string | null;
  temporaryPassword: string;
};

export type DirectMemberCreateFormState = {
  status: "idle" | "error" | "success";
  message?: string | null;
  fieldErrors?: DirectMemberCreateFieldErrors;
  member?: {
    id: string;
    manualLoginId: string;
    displayName: string;
  } | null;
};

export const DIRECT_MEMBER_CREATE_INITIAL_STATE: DirectMemberCreateFormState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  member: null,
};

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getKoreanParticle(
  value: string,
  withFinalConsonant: string,
  withoutFinalConsonant: string,
) {
  const lastCodePoint = value.codePointAt(value.length - 1);
  if (!lastCodePoint || lastCodePoint < 0xac00 || lastCodePoint > 0xd7a3) {
    return withoutFinalConsonant;
  }
  return (lastCodePoint - 0xac00) % 28 === 0
    ? withoutFinalConsonant
    : withFinalConsonant;
}

function validateTextInput(
  value: string,
  label: string,
  maxLength: number,
  required: boolean,
) {
  if (!value) {
    return required
      ? `${label}${getKoreanParticle(label, "을", "를")} 입력해 주세요.`
      : null;
  }
  if (value.length > maxLength) {
    return `${label}${getKoreanParticle(label, "은", "는")} ${maxLength}자 이내로 입력해 주세요.`;
  }
  if (CONTROL_CHARACTER_REGEX.test(value)) {
    return `${label} 형식이 올바르지 않습니다.`;
  }
  return null;
}

export function normalizeDirectMemberLoginId(value: unknown) {
  const loginId = toTrimmedString(value).toLowerCase();
  const baseValidationError = validateAdminIdentifier(loginId);
  if (baseValidationError) {
    return {
      value: null,
      error: baseValidationError.replaceAll("아이디", "직접 로그인 ID"),
    } as const;
  }
  if (
    !loginId.startsWith(DIRECT_MEMBER_LOGIN_ID_PREFIX)
    || loginId.length === DIRECT_MEMBER_LOGIN_ID_PREFIX.length
  ) {
    return {
      value: null,
      error: "직접 로그인 ID는 manual-로 시작해야 합니다.",
    } as const;
  }
  return { value: loginId, error: null } as const;
}

export function validateDirectMemberCreateInput(
  input: DirectMemberCreateInput,
):
  | { ok: true; value: DirectMemberCreateValue }
  | { ok: false; fieldErrors: DirectMemberCreateFieldErrors } {
  const manualLoginId = normalizeDirectMemberLoginId(input.loginId);
  const displayName = toTrimmedString(input.displayName);
  const generationRaw = toTrimmedString(input.generation);
  const campusRaw = toTrimmedString(input.campus);
  const temporaryPassword = typeof input.temporaryPassword === "string"
    ? input.temporaryPassword
    : "";
  const temporaryPasswordConfirmation = typeof input.temporaryPasswordConfirmation === "string"
    ? input.temporaryPasswordConfirmation
    : "";

  const fieldErrors: DirectMemberCreateFieldErrors = {};
  if (manualLoginId.error) {
    fieldErrors.loginId = manualLoginId.error;
  }

  const displayNameError = validateTextInput(
    displayName,
    "이름",
    DISPLAY_NAME_MAX_LENGTH,
    true,
  );
  if (displayNameError) {
    fieldErrors.displayName = displayNameError;
  }

  const generationError = validateMemberYear(generationRaw);
  const generation = parseMemberYearValue(generationRaw);
  if (generationError || generation === null) {
    fieldErrors.generation = generationError ?? "기수를 확인해 주세요.";
  }

  const campusError = validateTextInput(
    campusRaw,
    "캠퍼스",
    CAMPUS_MAX_LENGTH,
    false,
  );
  if (campusError) {
    fieldErrors.campus = campusError;
  }

  if (temporaryPassword !== temporaryPassword.trim()) {
    fieldErrors.temporaryPassword = "비밀번호의 앞뒤 공백은 사용할 수 없습니다.";
  } else {
    const passwordError = validatePasswordPolicy(temporaryPassword, "비밀번호");
    if (passwordError) {
      fieldErrors.temporaryPassword = passwordError;
    }
  }

  if (!temporaryPasswordConfirmation) {
    fieldErrors.temporaryPasswordConfirmation = "비밀번호를 한 번 더 입력해 주세요.";
  } else if (temporaryPassword !== temporaryPasswordConfirmation) {
    fieldErrors.temporaryPasswordConfirmation = "비밀번호가 일치하지 않습니다.";
  }

  if (Object.keys(fieldErrors).length > 0 || !manualLoginId.value || generation === null) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      manualLoginId: manualLoginId.value,
      displayName,
      generation,
      campus: campusRaw || null,
      temporaryPassword,
    },
  };
}

export function buildDirectMemberCreatePayload(input: {
  manualLoginId: string;
  displayName: string;
  generation: number;
  campus: string | null;
  passwordHash: string;
  passwordSalt: string;
  now: string;
}) {
  return {
    manual_login_id: input.manualLoginId,
    display_name: input.displayName,
    generation: input.generation,
    campus: input.campus,
    password_hash: input.passwordHash,
    password_salt: input.passwordSalt,
    must_change_password: true,
    updated_at: input.now,
  };
}

export function buildDirectMemberCreateAuditProperties(
  input: DirectMemberCreateValue,
) {
  return {
    source: "admin_direct_create",
    generation: input.generation,
    hasCampus: Boolean(input.campus),
    mustChangePassword: true,
  };
}
