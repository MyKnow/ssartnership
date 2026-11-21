import { sanitizeReturnTo } from "@/lib/return-to";

export const MEMBER_REQUIRED_GATE_PATHS = {
  "change-password": "/auth/change-password",
  consent: "/auth/consent",
  "email-registration": "/certification/email",
  "profile-photo": "/certification/photo",
} as const;

export type MemberRequiredGate = keyof typeof MEMBER_REQUIRED_GATE_PATHS;

type MemberRequiredGateState = {
  mustChangePassword?: boolean;
  requiresConsent?: boolean;
  requiresEmailRegistration?: boolean;
  requiresProfilePhotoUpdate?: boolean;
};

export function requiresMemberEmailRegistration({
  mattermostLoginDisabledAt,
  emailVerifiedAt,
}: {
  mattermostLoginDisabledAt?: string | null;
  emailVerifiedAt?: string | null;
}) {
  return Boolean(mattermostLoginDisabledAt && !emailVerifiedAt);
}

type MemberRequiredGateRedirectInput = MemberRequiredGateState & {
  currentPath?: string | null;
  returnTo?: string | null;
};

function getPathname(candidate: string | null | undefined) {
  const safePath = sanitizeReturnTo(candidate, "");
  return safePath.split(/[?#]/, 1)[0] ?? "";
}

export function resolveMemberRequiredGate({
  mustChangePassword = false,
  requiresConsent = false,
  requiresEmailRegistration = false,
  requiresProfilePhotoUpdate = false,
}: MemberRequiredGateState): MemberRequiredGate | null {
  if (mustChangePassword) return "change-password";
  if (requiresConsent) return "consent";
  if (requiresEmailRegistration) return "email-registration";
  if (requiresProfilePhotoUpdate) return "profile-photo";
  return null;
}

export function isMemberRequiredGatePath(
  candidate: string | null | undefined,
  gate: MemberRequiredGate,
) {
  return getPathname(candidate) === MEMBER_REQUIRED_GATE_PATHS[gate];
}

export function buildMemberGateHref(
  gate: MemberRequiredGate,
  returnTo: string | null | undefined,
) {
  const safeReturnTo = sanitizeReturnTo(returnTo, "/");
  return `${MEMBER_REQUIRED_GATE_PATHS[gate]}?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export function getMemberRequiredGateRedirect({
  currentPath,
  returnTo = currentPath,
  ...state
}: MemberRequiredGateRedirectInput) {
  const gate = resolveMemberRequiredGate(state);
  if (!gate || isMemberRequiredGatePath(currentPath, gate)) return null;
  return buildMemberGateHref(gate, returnTo);
}

export function getMemberGateCompletionReturnTo(
  returnTo: string |null | undefined,
  completedGate: MemberRequiredGate,
) {
  const safeReturnTo = sanitizeReturnTo(returnTo, "/");
  return isMemberRequiredGatePath(safeReturnTo, completedGate) ? "/" : safeReturnTo;
}

/**
 * Sign-in entry pages. A completed sign-in never returns to one of them,
 * and a member who is already signed in is sent past them.
 */
const MEMBER_AUTH_ENTRY_PATHS = [
  "/auth/login",
  "/auth/signup",
  "/auth/mock",
  "/auth/recover-email",
  "/auth/reset",
  "/auth/member/setup",
  "/auth/graduate/setup",
] as const;

function isMemberAuthEntryPath(candidate: string) {
  const pathname = getPathname(candidate);
  return MEMBER_AUTH_ENTRY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * The validated post-sign-in destination: a same-origin path from
 * `returnTo`, or the flow's explicit fallback. Sign-in entry pages are never
 * a destination, which prevents a login → login loop.
 */
export function resolveMemberAuthDestination(
  returnTo: string | null | undefined,
  fallback = "/",
) {
  const safeFallback = sanitizeReturnTo(fallback, "/");
  const destination = sanitizeReturnTo(returnTo, safeFallback);
  if (!isMemberAuthEntryPath(destination)) {
    return destination;
  }
  return isMemberAuthEntryPath(safeFallback) ? "/" : safeFallback;
}

/**
 * Single completion contract for every flow that ends with a new member
 * session (password login, email recovery, emailed setup links). The original
 * destination survives, the highest-priority required gate still runs first,
 * and a completed gate is never revisited.
 */
export function getMemberLoginCompletionHref({
  currentPath,
  returnTo,
  fallback = "/",
  completedGate,
  ...state
}: MemberRequiredGateState & {
  currentPath: string;
  returnTo?: string | null;
  fallback?: string;
  completedGate?: MemberRequiredGate;
}) {
  const destination = completedGate
    ? getMemberGateCompletionReturnTo(
        resolveMemberAuthDestination(returnTo, fallback),
        completedGate,
      )
    : resolveMemberAuthDestination(returnTo, fallback);
  return getMemberRequiredGateRedirect({
    currentPath,
    returnTo: destination,
    ...state,
  }) ?? destination;
}
