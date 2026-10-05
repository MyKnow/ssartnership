/**
 * RPC `raise exception` tokens for member Wallet passes. Classify by the
 * whole token, never by a fragment such as "not_found" or "revoked" that
 * other tokens and provider messages also contain.
 */
export const WALLET_PASS_ERROR_TOKENS = Object.freeze({
  passNotFound: "member_wallet_pass_not_found",
  memberNotFound: "member_wallet_pass_member_not_found",
  revoked: "member_wallet_pass_revoked",
  idempotencyConflict: "member_wallet_pass_idempotency_conflict",
} as const);

export type WalletPassRepositoryErrorKind =
  | "not_found"
  | "revoked"
  | "idempotency_conflict"
  | "repository_error";

function hasToken(message: string, token: string) {
  return new RegExp(`(?:^|[^a-z0-9_])${token}(?:$|[^a-z0-9_])`, "u").test(message);
}

export function classifyWalletPassRepositoryError(error: unknown): WalletPassRepositoryErrorKind {
  const message = error instanceof Error ? error.message : "";
  if (hasToken(message, WALLET_PASS_ERROR_TOKENS.idempotencyConflict)) return "idempotency_conflict";
  if (hasToken(message, WALLET_PASS_ERROR_TOKENS.revoked)) return "revoked";
  if (
    hasToken(message, WALLET_PASS_ERROR_TOKENS.passNotFound)
    || hasToken(message, WALLET_PASS_ERROR_TOKENS.memberNotFound)
  ) {
    return "not_found";
  }
  return "repository_error";
}
