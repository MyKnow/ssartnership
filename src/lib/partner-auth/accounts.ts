import { normalizePartnerLoginId } from "../partner-utils.ts";
import { hashOpaqueToken } from "../password.ts";
import { getSupabaseAdminClient } from "../supabase/server.ts";
import type { PartnerPortalAccountRow } from "./types.ts";

/**
 * Columns read for every partner account auth decision. `auth_session_version`
 * (20260830215816) and the hashed initial setup columns (20260420000000,
 * 20260501012004) are part of the forward-only schema, so a missing column is
 * a deployment error that must surface instead of being retried away.
 */
export const PARTNER_ACCOUNT_SELECT =
  "id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at,updated_at,auth_session_version";

export const PARTNER_SETUP_ACCOUNT_SELECT =
  `${PARTNER_ACCOUNT_SELECT},initial_setup_token_hash,initial_setup_link_sent_at,initial_setup_expires_at`;

type PartnerAccountQueryResult = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}>;

async function readPartnerAccountRow(query: PartnerAccountQueryResult) {
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data as PartnerPortalAccountRow | null) ?? null;
}

export async function findSupabasePartnerPortalAccount(
  loginIdOrEmail: string,
): Promise<PartnerPortalAccountRow | null> {
  const supabase = getSupabaseAdminClient();
  const byLoginId = await readPartnerAccountRow(
    supabase
      .from("partner_accounts")
      .select(PARTNER_ACCOUNT_SELECT)
      .eq("login_id", loginIdOrEmail)
      .maybeSingle(),
  );

  if (byLoginId) {
    return byLoginId;
  }

  return readPartnerAccountRow(
    supabase
      .from("partner_accounts")
      .select(PARTNER_ACCOUNT_SELECT)
      .eq("email", loginIdOrEmail)
      .maybeSingle(),
  );
}

/**
 * Looks up the account that owns an initial setup link. Only the SHA-256 hash
 * of the token is stored, so an unknown or rotated token simply resolves to
 * null and every database error is thrown to the caller.
 */
export async function findSupabasePartnerPortalSetupAccount(
  token: string,
): Promise<PartnerPortalAccountRow | null> {
  if (!token) {
    return null;
  }

  return readPartnerAccountRow(
    getSupabaseAdminClient()
      .from("partner_accounts")
      .select(PARTNER_SETUP_ACCOUNT_SELECT)
      .eq("initial_setup_token_hash", hashOpaqueToken(token))
      .maybeSingle(),
  );
}

export async function getSupabasePartnerPortalAccountById(accountId: string) {
  return readPartnerAccountRow(
    getSupabaseAdminClient()
      .from("partner_accounts")
      .select(PARTNER_ACCOUNT_SELECT)
      .eq("id", accountId)
      .maybeSingle(),
  );
}

/**
 * The column is `not null default 1` with a `>= 1` check, so this only guards
 * against malformed in-memory rows; it never stands in for a missing column.
 */
export function getPartnerAccountAuthSessionVersion(
  account: Pick<PartnerPortalAccountRow, "auth_session_version">,
) {
  const version = Number(account.auth_session_version);
  return Number.isInteger(version) && version >= 1 ? version : 1;
}

export function normalizeSupabasePartnerLoginId(loginId: string) {
  return normalizePartnerLoginId(loginId);
}
