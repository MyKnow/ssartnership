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

  const expiresAtMs = input.expiresAt
    ? new Date(input.expiresAt).getTime()
    : Number.NaN;
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    return "expired";
  }

  if (input.completedAt) {
    return "completed";
  }

  return "usable";
}
