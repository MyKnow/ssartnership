/**
 * Supabase RPC `raise exception '<token>'` messages arrive as plain error
 * messages. Match the whole token so a fragment such as "not_found",
 * "inactive" or "revoked" inside another token or a provider message never
 * selects the wrong domain branch.
 */
export function hasRpcErrorToken(message: string, token: string) {
  return new RegExp(`(?:^|[^a-z0-9_])${token}(?:$|[^a-z0-9_])`, "u").test(message);
}

export function hasAnyRpcErrorToken(message: string, tokens: readonly string[]) {
  return tokens.some((token) => hasRpcErrorToken(message, token));
}
