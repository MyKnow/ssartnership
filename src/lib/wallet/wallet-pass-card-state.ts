export type AppleWalletCardStatus =
  | "not_issued"
  | "active"
  | "active_unavailable"
  | "consent_required"
  | "revoked"
  | "blocked"
  | "error"
  | "unavailable";

export function resolveAppleWalletCardStatusAfterRevoke(
  status: AppleWalletCardStatus,
): AppleWalletCardStatus {
  return status === "active_unavailable" ? "unavailable" : "revoked";
}
