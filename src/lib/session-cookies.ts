/**
 * Cookie names and default attributes shared by the session modules and
 * `src/proxy.ts`. Keep this module free of secrets and Node-only imports so
 * the proxy and any server module can read the same constants.
 */

export const USER_SESSION_COOKIE_NAME = "user_session";
export const ADMIN_SESSION_COOKIE_NAME = "admin_session";
export const PARTNER_SESSION_COOKIE_NAME = "partner_session";
export const MEMBER_EMAIL_RECOVERY_COOKIE_NAME = "member_email_recovery";
export const MATTERMOST_CODE_SESSION_COOKIE_NAME = "mattermost_code_session";

export type SessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge?: number;
};

/**
 * `maxAgeSeconds` omitted produces a browser-session cookie (used when a
 * member opts out of "자동 로그인").
 */
export function buildSessionCookieOptions(
  maxAgeSeconds?: number,
  environment: Readonly<{ NODE_ENV?: string }> = process.env,
): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: environment.NODE_ENV === "production",
    ...(maxAgeSeconds === undefined ? {} : { maxAge: maxAgeSeconds }),
    path: "/",
  };
}
