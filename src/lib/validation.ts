const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IDENTIFIER_REGEX = /^[A-Za-z0-9._-]+$/;
const ADMIN_IDENTIFIER_REGEX = /^[A-Za-z0-9._-]{3,64}$/;
const PHONE_REGEX = /^[+0-9()\-\s]{7,}$/;
const INSTAGRAM_HANDLE_REGEX = /^@[\w.]+$/;
const CATEGORY_KEY_REGEX = /^[a-z0-9][a-z0-9_-]*$/;
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CONTROL_CHARACTER_REGEX = /[\u0000-\u001F\u007F]/;

const PASSWORD_FORBIDDEN_CHARACTER_REGEX = /[\u0000-\u001F\u007F-\u009F]/;

export const PASSWORD_POLICY_MESSAGE =
  "비밀번호는 8~64자, 영문/숫자/특수문자를 모두 포함해야 하며 앞뒤 공백은 사용할 수 없습니다.";

/**
 * FE 제출 전 검증과 BE route/server action 검증이 함께 쓰는 비밀번호 정책.
 * 로그인·변경 경로 일부가 입력을 trim하므로, 저장 시점에 앞뒤 공백을 허용하면
 * 같은 비밀번호로 다시 로그인하지 못한다. 제어문자도 입력 장치마다 달라 거부한다.
 */
export function isValidPasswordPolicy(value: string) {
  if (typeof value !== "string") {
    return false;
  }
  if (value.length < 8 || value.length > 64) {
    return false;
  }
  if (value !== value.trim()) {
    return false;
  }
  if (PASSWORD_FORBIDDEN_CHARACTER_REGEX.test(value)) {
    return false;
  }
  const hasLetter = /[A-Za-z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  return hasLetter && hasNumber && hasSymbol;
}

export function validatePasswordPolicy(value: string, label = "비밀번호") {
  if (!value) {
    return `${label}를 입력해 주세요.`;
  }
  return isValidPasswordPolicy(value) ? null : PASSWORD_POLICY_MESSAGE;
}

export function normalizeMmUsername(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeAdminIdentifier(value: string) {
  return value.trim();
}

export function validateMmUsername(value: string, label = "MM 아이디") {
  const normalized = value.trim();
  if (!normalized) {
    return `${label}를 입력해 주세요.`;
  }
  if (normalized.startsWith("@") || normalized.includes("@")) {
    return `${label}는 @ 없이 입력해 주세요.`;
  }
  if (/\s/.test(normalized)) {
    return `${label}에 공백을 넣을 수 없습니다.`;
  }
  if (!IDENTIFIER_REGEX.test(normalized)) {
    return `${label}는 영문, 숫자, ., _, -만 사용할 수 있습니다.`;
  }
  return null;
}

export function validateAdminIdentifier(value: string) {
  const normalized = normalizeAdminIdentifier(value);
  if (!normalized) {
    return "아이디를 입력해 주세요.";
  }
  if (normalized.startsWith("@") || normalized.includes("@")) {
    return "아이디는 @ 없이 입력해 주세요.";
  }
  if (/\s/.test(normalized)) {
    return "아이디에 공백을 넣을 수 없습니다.";
  }
  if (!ADMIN_IDENTIFIER_REGEX.test(normalized)) {
    return "아이디는 3~64자의 영문, 숫자, ., _, -만 사용할 수 있습니다.";
  }
  return null;
}

export function validateAdminPasswordInput(value: string) {
  if (!value) {
    return "비밀번호를 입력해 주세요.";
  }
  if (value.length > 256) {
    return "비밀번호 형식이 올바르지 않습니다.";
  }
  if (hasControlCharacters(value)) {
    return "비밀번호 형식이 올바르지 않습니다.";
  }
  return null;
}

export function validateCategoryKey(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return "카테고리 키를 입력해 주세요.";
  }
  if (!CATEGORY_KEY_REGEX.test(normalized)) {
    return "카테고리 키는 소문자 영문, 숫자, -, _만 사용할 수 있습니다.";
  }
  return null;
}

export function parseMemberYearValue(value?: string | number | null) {
  const normalized = String(value ?? "").trim();
  if (!/^\d+$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 99) {
    return null;
  }
  return parsed;
}

export function validateMemberYear(value?: string | number | null, label = "기수") {
  const parsed = parseMemberYearValue(value);
  if (parsed === null) {
    return `${label}는 0~99 사이의 숫자로 입력해 주세요.`;
  }
  return null;
}

export function isValidEmail(value?: string | null) {
  if (!value) {
    return false;
  }
  return EMAIL_REGEX.test(value.trim());
}

export function sanitizeHttpUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function sanitizeHexColor(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  if (!HEX_COLOR_REGEX.test(trimmed)) {
    return null;
  }
  return trimmed.toLowerCase();
}

export function validateDateRange(start?: string | null, end?: string | null) {
  const normalizedStart = start?.trim() ?? "";
  const normalizedEnd = end?.trim() ?? "";

  if (normalizedStart && !isValidDateOnly(normalizedStart)) {
    return "제휴 시작일 형식을 확인해 주세요.";
  }
  if (normalizedEnd && !isValidDateOnly(normalizedEnd)) {
    return "제휴 종료일 형식을 확인해 주세요.";
  }
  if (normalizedStart && normalizedEnd && normalizedStart > normalizedEnd) {
    return "제휴 종료일은 시작일보다 빠를 수 없습니다.";
  }
  return null;
}

function isValidDateOnly(value: string) {
  if (!DATE_ONLY_REGEX.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const monthLengths = [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= (monthLengths[month - 1] ?? 0);
}

export function sanitizePartnerLinkValue(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const safeUrl = sanitizeHttpUrl(trimmed);
  if (safeUrl) {
    return safeUrl;
  }
  if (
    EMAIL_REGEX.test(trimmed) ||
    PHONE_REGEX.test(trimmed) ||
    INSTAGRAM_HANDLE_REGEX.test(trimmed)
  ) {
    return trimmed;
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

const FOUR_DIGIT_PIN_REGEX = /^\d{4}$/;
const SIX_DIGIT_CODE_REGEX = /^\d{6}$/;

/** 제휴처 확인 PIN 자릿수. 입력 `maxLength`와 서버 검증이 함께 참조한다. */
export const FOUR_DIGIT_PIN_LENGTH = 4;
/**
 * PIN 입력의 HTML `pattern` 값(브라우저 제출 전 제약). 판정 규칙은 `isFourDigitPin`과 같다.
 * 브라우저는 이 값을 `^(?:…)$`로 감싸 전체 일치로 검사한다.
 */
export const FOUR_DIGIT_PIN_INPUT_PATTERN = `[0-9]{${FOUR_DIGIT_PIN_LENGTH}}`;
/** 이메일·Mattermost 인증 코드 자릿수. 입력 `maxLength`와 서버 검증이 함께 참조한다. */
export const SIX_DIGIT_CODE_LENGTH = 6;

/**
 * 숫자 4자리 PIN(제휴처 확인 PIN, 쿠폰 현장 확인 PIN) 판정.
 * FE 제출 전 검증과 BE route/server action 검증이 같은 함수를 쓴다.
 * 앞뒤 공백을 허용하지 않으므로 trim이 필요한 경계는 호출 전에 정규화한다.
 */
export function isFourDigitPin(value: unknown): value is string {
  return typeof value === "string" && FOUR_DIGIT_PIN_REGEX.test(value);
}

/**
 * 숫자 6자리 인증 코드(이메일·Mattermost·수료생 인증) 판정.
 * 앞뒤 공백은 허용하지 않으므로 호출 전에 trim/공백 제거를 마친다.
 */
export function isSixDigitCode(value: unknown): value is string {
  return typeof value === "string" && SIX_DIGIT_CODE_REGEX.test(value);
}

/** C0 제어문자(U+0000~U+001F)와 DEL(U+007F)이 하나라도 있으면 true. */
export function hasControlCharacters(value: string) {
  return CONTROL_CHARACTER_REGEX.test(value);
}
