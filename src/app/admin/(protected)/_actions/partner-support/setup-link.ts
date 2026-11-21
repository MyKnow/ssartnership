import { PARTNER_ACCOUNT_SELECT } from "@/lib/partner-admin/company-account-rows";
import { SITE_URL } from "@/lib/site";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/password";
import { normalizePartnerLoginId } from "@/lib/partner-utils";
import { logServerError } from "@/lib/server-log";
import { isValidEmail } from "@/lib/validation";
import type { AdminSupabaseClient } from "../shared-types";

const INITIAL_SETUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Issues a fresh single-use setup link. Only the SHA-256 hash and its expiry
 * are stored (the plaintext token column was dropped in 20260501012004), so a
 * write error is a real failure and is never retried with another column set.
 */
export function buildPartnerSetupIssuePayload(input: {
  setupTokenHash: string;
  expiresAt: string;
  now: string;
}) {
  return {
    initial_setup_token_hash: input.setupTokenHash,
    initial_setup_expires_at: input.expiresAt,
    initial_setup_link_sent_at: null,
    must_change_password: true,
    email_verified_at: null,
    updated_at: input.now,
  };
}

async function updateInitialSetupState(
  supabase: AdminSupabaseClient,
  accountId: string,
  now: string,
  setupTokenHash: string,
) {
  const expiresAt = new Date(Date.now() + INITIAL_SETUP_TTL_MS).toISOString();
  const { error } = await supabase
    .from("partner_accounts")
    .update(buildPartnerSetupIssuePayload({ setupTokenHash, expiresAt, now }))
    .eq("id", accountId);

  if (error) {
    logServerError("[partner-setup-link] issue update failed", error, { accountId });
    throw new Error("partner_account_setup_link_failed");
  }

  return { expiresAt };
}

export async function issuePartnerAccountInitialSetupLink(
  supabase: AdminSupabaseClient,
  accountId: string,
) {
  const { data: account, error: accountError } = await supabase
    .from("partner_accounts")
    .select(`${PARTNER_ACCOUNT_SELECT},initial_setup_link_sent_at,updated_at`)
    .eq("id", accountId)
    .maybeSingle();

  // Errors carry admin action error codes (see admin-action-errors.ts) so the
  // caller can tell the operator what to fix instead of a generic input error.
  if (accountError) {
    logServerError("[partner-setup-link] account lookup failed", accountError, { accountId });
    throw new Error("partner_account_setup_link_failed");
  }
  if (!account) {
    throw new Error("partner_account_missing_id");
  }
  if (!account.is_active) {
    throw new Error("partner_account_inactive");
  }
  if (account.initial_setup_completed_at) {
    throw new Error("partner_account_setup_completed");
  }

  const emailSentTo = normalizePartnerLoginId(account.email ?? account.login_id);
  if (!isValidEmail(emailSentTo)) {
    throw new Error("partner_account_invalid_email");
  }

  const setupToken = generateOpaqueToken();
  const setupTokenHash = hashOpaqueToken(setupToken);
  const now = new Date().toISOString();
  const { expiresAt } = await updateInitialSetupState(
    supabase,
    account.id,
    now,
    setupTokenHash,
  );

  return {
    account,
    emailSentTo,
    setupUrl: new URL(`/partner/setup/${setupToken}`, SITE_URL).toString(),
    now,
    expiresAt,
  };
}
