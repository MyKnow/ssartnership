const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IDENTIFIER_REGEX = /^[A-Za-z0-9._-]+$/;
const PHONE_REGEX = /^[+0-9()\-\s]{7,}$/;
const INSTAGRAM_HANDLE_REGEX = /^@[\w.]+$/;

export const PASSWORD_POLICY_MESSAGE =
  "비밀번호는 8~64자, 영문/숫자/특수문자를 모두 포함해야 합니다.";

export function normalizeMmUsername(value: string) {
  return value.trim().toLowerCase();
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
  const normalized = value.trim();
  if (!normalized) {
    return "아이디를 입력해 주세요.";
  }
  if (normalized.startsWith("@") || normalized.includes("@")) {
    return "아이디는 @ 없이 입력해 주세요.";
  }
  if (/\s/.test(normalized)) {
    return "아이디에 공백을 넣을 수 없습니다.";
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
