/**
 * Recent-authentication rule shared by the member UI (pre-submit checks and
 * messages) and the API routes (trust boundary). Sensitive member actions
 * (account deletion, binding a login/recovery email) require either a
 * credential check within the last 10 minutes or the current password.
 * Members without a password can only satisfy the rule by signing in again.
 * The admin session bridge (`/admin/session`) uses the same window, with a
 * fresh member login as its only proof.
 *
 * Client-safe: no secrets, no Node-only imports.
 */

export const MEMBER_RECENT_AUTH_WINDOW_MS = 10 * 60 * 1000;
export const MEMBER_CURRENT_PASSWORD_MAX_LENGTH = 128;

export type MemberRecentAuthRequirement = "none" | "password" | "reauthentication";

export type MemberRecentAuthErrorCode =
  | "recent_auth_required"
  | "current_password_invalid"
  | "reauthentication_required"
  | "recent_auth_blocked"
  | "recent_auth_unavailable";

export const MEMBER_RECENT_AUTH_ERRORS: Record<
  MemberRecentAuthErrorCode,
  { status: 403 | 429 | 503; message: string }
> = {
  recent_auth_required: {
    status: 403,
    message: "보안을 위해 현재 비밀번호를 입력해 주세요.",
  },
  current_password_invalid: {
    status: 403,
    message: "현재 비밀번호가 올바르지 않습니다.",
  },
  reauthentication_required: {
    status: 403,
    message: "보안을 위해 로그아웃한 뒤 다시 로그인해 주세요.",
  },
  recent_auth_blocked: {
    status: 429,
    message: "비밀번호 확인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  },
  recent_auth_unavailable: {
    status: 503,
    message: "본인 확인을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  },
};

export function isMemberRecentAuthErrorCode(
  value: unknown,
): value is MemberRecentAuthErrorCode {
  return typeof value === "string"
    && Object.prototype.hasOwnProperty.call(MEMBER_RECENT_AUTH_ERRORS, value);
}

export function isMemberAuthenticationRecent(
  authenticatedAt: number | null | undefined,
  now = Date.now(),
) {
  return typeof authenticatedAt === "number"
    && Number.isFinite(authenticatedAt)
    && authenticatedAt <= now
    && now - authenticatedAt <= MEMBER_RECENT_AUTH_WINDOW_MS;
}

export function resolveMemberRecentAuthRequirement(input: {
  authenticatedAt: number | null | undefined;
  hasPassword: boolean;
  now?: number;
}): MemberRecentAuthRequirement {
  if (isMemberAuthenticationRecent(input.authenticatedAt, input.now)) {
    return "none";
  }
  return input.hasPassword ? "password" : "reauthentication";
}

export type MemberCurrentPasswordInput =
  | { ok: true; currentPassword: string | null }
  | { ok: false; code: "current_password_invalid" };

/**
 * Normalizes the optional `currentPassword` request field the same way the
 * login route normalizes passwords (trimmed). Absent or blank means "not
 * provided"; non-strings and oversized values are invalid input.
 */
export function parseMemberCurrentPasswordInput(
  value: unknown,
): MemberCurrentPasswordInput {
  if (value === undefined || value === null) {
    return { ok: true, currentPassword: null };
  }
  if (typeof value !== "string" || value.length > MEMBER_CURRENT_PASSWORD_MAX_LENGTH) {
    return { ok: false, code: "current_password_invalid" };
  }
  const trimmed = value.trim();
  return { ok: true, currentPassword: trimmed || null };
}

/** Field-level message for the UI; `null` means the field is acceptable. */
export function getMemberCurrentPasswordFieldError(
  value: string,
  requirement: MemberRecentAuthRequirement,
) {
  if (requirement !== "password") {
    return null;
  }
  const parsed = parseMemberCurrentPasswordInput(value);
  if (!parsed.ok) {
    return MEMBER_RECENT_AUTH_ERRORS.current_password_invalid.message;
  }
  return parsed.currentPassword ? null : "현재 비밀번호를 입력해 주세요.";
}

export type MemberRecentAuthFeedback = {
  requirement?: MemberRecentAuthRequirement;
  fieldError?: string;
  formError?: string;
};

/** Maps an API error code to the UI state change (field vs form message). */
export function getMemberRecentAuthFeedback(
  code: MemberRecentAuthErrorCode,
): MemberRecentAuthFeedback {
  const { message } = MEMBER_RECENT_AUTH_ERRORS[code];
  switch (code) {
    case "recent_auth_required":
      return { requirement: "password", fieldError: message };
    case "current_password_invalid":
      return { fieldError: message };
    case "reauthentication_required":
      return { requirement: "reauthentication", formError: message };
    default:
      return { formError: message };
  }
}
