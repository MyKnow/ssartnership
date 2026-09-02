export type MemberLoginMethod = "username" | "email";

export const DEFAULT_MEMBER_LOGIN_METHOD: MemberLoginMethod = "username";
export const MEMBER_LOGIN_METHOD_STORAGE_KEY =
  "ssartnership.auth.last-login-method.v1";

type LoginMethodStorage = Pick<Storage, "getItem" | "setItem">;

export function parseMemberLoginMethod(
  value: unknown,
): MemberLoginMethod | null {
  return value === "username" || value === "email" ? value : null;
}

function getBrowserStorage(): LoginMethodStorage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readLastMemberLoginMethod(
  storage: LoginMethodStorage | null = getBrowserStorage(),
): MemberLoginMethod {
  if (!storage) {
    return DEFAULT_MEMBER_LOGIN_METHOD;
  }
  try {
    return (
      parseMemberLoginMethod(storage.getItem(MEMBER_LOGIN_METHOD_STORAGE_KEY))
      ?? DEFAULT_MEMBER_LOGIN_METHOD
    );
  } catch {
    return DEFAULT_MEMBER_LOGIN_METHOD;
  }
}

export function persistLastMemberLoginMethod(
  method: MemberLoginMethod,
  storage: LoginMethodStorage | null = getBrowserStorage(),
) {
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(MEMBER_LOGIN_METHOD_STORAGE_KEY, method);
    return true;
  } catch {
    return false;
  }
}
