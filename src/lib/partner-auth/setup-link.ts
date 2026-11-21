export type PartnerSetupLinkState =
  | "usable"
  | "inactive"
  | "missing_token"
  | "expired"
  | "completed";

export type PartnerSetupLinkStateInput = {
  isActive: boolean;
  hasToken: boolean;
  expiresAt: string | null;
  completedAt: string | null;
};

/**
 * A setup link is usable only before the expiry stored when it was issued. A
 * missing or malformed expiry counts as expired: the send time is never used
 * to extend a link. The setup page and the admin account badge share this
 * rule so the admin never sees a link as usable that the setup page rejects.
 */
export function isPartnerSetupLinkExpired(
  expiresAt: string | null | undefined,
  nowMs = Date.now(),
) {
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs;
}

export function getPartnerSetupLinkState(
  input: PartnerSetupLinkStateInput,
  nowMs = Date.now(),
): PartnerSetupLinkState {
  if (!input.isActive) {
    return "inactive";
  }

  if (!input.hasToken) {
    return "missing_token";
  }

  if (isPartnerSetupLinkExpired(input.expiresAt, nowMs)) {
    return "expired";
  }

  if (input.completedAt) {
    return "completed";
  }

  return "usable";
}
