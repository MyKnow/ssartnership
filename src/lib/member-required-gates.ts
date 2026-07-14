import { sanitizeReturnTo } from "@/lib/return-to";

export const MEMBER_REQUIRED_GATE_PATHS = {
  "change-password": "/auth/change-password",
  consent: "/auth/consent",
  "profile-photo": "/certification/photo",
} as const;

export type MemberRequiredGate = keyof typeof MEMBER_REQUIRED_GATE_PATHS;

type MemberRequiredGateState = {
  mustChangePassword?: boolean;
  requiresConsent?: boolean;
  requiresProfilePhotoUpdate?: boolean;
};

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
  requiresProfilePhotoUpdate = false,
}: MemberRequiredGateState): MemberRequiredGate | null {
  if (mustChangePassword) return "change-password";
  if (requiresConsent) return "consent";
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
