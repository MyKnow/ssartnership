/**
 * Security notice for login/recovery email changes. When a member binds an
 * address that differs from the previously verified one, the previous address
 * receives a notice, so a stolen session or password cannot quietly move
 * account recovery to another mailbox. The notice never contains the new
 * address in full.
 *
 * Pure helpers only (no secrets, no Node-only imports). The sender lives in
 * `member-email.ts` and the route wiring in `member-email-change-notice.server.ts`.
 */

export const MEMBER_EMAIL_CHANGE_NOTICE_EVENT_KEY = "email.member_email_changed";
export const MEMBER_EMAIL_CHANGE_NOTICE_SETTINGS_PATH = "/settings";

export type PreviousMemberEmailState = {
  emailNormalized: string | null;
  emailVerifiedAt: string | null;
  displayName: string | null;
};

export type MemberEmailChangeNotice = {
  to: string;
  displayName: string;
  maskedNewEmail: string;
};

/** `ab***@example.com`; one visible character for local parts of 1-2 chars. */
export function maskMemberEmailForNotice(emailNormalized: string) {
  const separatorIndex = emailNormalized.lastIndexOf("@");
  if (separatorIndex <= 0 || separatorIndex === emailNormalized.length - 1) {
    return "***";
  }
  const localPart = emailNormalized.slice(0, separatorIndex);
  const domain = emailNormalized.slice(separatorIndex + 1);
  const visibleLength = localPart.length <= 2 ? 1 : 2;
  return `${localPart.slice(0, visibleLength)}***@${domain}`;
}

/**
 * Returns the notice to send, or null when there is no previously verified
 * address or the address did not change.
 */
export function resolveMemberEmailChangeNotice(
  previous: PreviousMemberEmailState | null | undefined,
  nextEmailNormalized: string,
): MemberEmailChangeNotice | null {
  const previousEmail = previous?.emailNormalized?.trim().toLowerCase() ?? "";
  const nextEmail = nextEmailNormalized.trim().toLowerCase();
  if (!previous?.emailVerifiedAt || !previousEmail || !nextEmail || previousEmail === nextEmail) {
    return null;
  }
  return {
    to: previousEmail,
    displayName: previous.displayName?.trim() || "회원",
    maskedNewEmail: maskMemberEmailForNotice(nextEmail),
  };
}
