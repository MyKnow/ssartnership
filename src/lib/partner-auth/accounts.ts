import { normalizePartnerLoginId } from "../partner-utils.ts";
import { hashOpaqueToken } from "../password.ts";
import { getSupabaseAdminClient } from "../supabase/server.ts";
import type { PartnerPortalAccountRow } from "./types.ts";
import { getPartnerSetupLookupPlans } from "./setup-schema.ts";

export const ACCOUNT_SELECT_BASE =
  "id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at,updated_at";
const ACCOUNT_SELECT =
  `${ACCOUNT_SELECT_BASE},auth_session_version`;

export function isMissingPartnerAuthSessionVersionColumnError(
  errorMessage: string,
) {
  return (
    errorMessage.includes("Could not find the 'auth_session_version' column") ||
    errorMessage.includes('column "auth_session_version" does not exist') ||
    errorMessage.includes("partner_accounts.auth_session_version does not exist")
  );
}

export function omitPartnerAuthSessionVersion<T extends Record<string, unknown>>(
  payload: T,
) {
  const nextPayload = { ...payload };
  delete nextPayload.auth_session_version;
  return nextPayload;
}

export function withPartnerAuthSessionVersionFallback(
  account: PartnerPortalAccountRow | null,
): PartnerPortalAccountRow | null {
  if (!account) {
    return null;
  }

  return {
    ...account,
    auth_session_version: Number.isInteger(account.auth_session_version) &&
      Number(account.auth_session_version) >= 1
      ? Number(account.auth_session_version)
      : 1,
  };
}

async function selectPartnerAccountMaybeSingle(
  runSelect: (
    select: string,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
) {
  const primary = await runSelect(ACCOUNT_SELECT);

  if (!primary.error) {
    return withPartnerAuthSessionVersionFallback(
      (primary.data as PartnerPortalAccountRow | null) ?? null,
    );
  }

  if (!isMissingPartnerAuthSessionVersionColumnError(primary.error.message)) {
    throw primary.error;
  }

  const fallback = await runSelect(ACCOUNT_SELECT_BASE);

  if (fallback.error) {
    throw fallback.error;
  }

  return withPartnerAuthSessionVersionFallback(
    (fallback.data as PartnerPortalAccountRow | null) ?? null,
  );
}

export async function findSupabasePartnerPortalAccount(
  loginIdOrEmail: string,
): Promise<PartnerPortalAccountRow | null> {
  const supabase = getSupabaseAdminClient();
  const byLoginId = await selectPartnerAccountMaybeSingle((select) =>
    supabase
      .from("partner_accounts")
      .select(select)
      .eq("login_id", loginIdOrEmail)
      .maybeSingle(),
  );

  if (byLoginId) {
    return byLoginId;
  }

  return selectPartnerAccountMaybeSingle((select) =>
    supabase
      .from("partner_accounts")
      .select(select)
      .eq("email", loginIdOrEmail)
      .maybeSingle(),
  );
}

export async function findSupabasePartnerPortalSetupAccount(token: string) {
  const supabase = getSupabaseAdminClient();
  const tokenHash = hashOpaqueToken(token);
  let lastSchemaError: Error | null = null;

  for (const plan of getPartnerSetupLookupPlans(ACCOUNT_SELECT)) {
    const selectAttempts = [plan.select];
    if (plan.select.includes("auth_session_version")) {
      selectAttempts.push(plan.select.replace(",auth_session_version", ""));
    }

    for (const select of selectAttempts) {
      const { data, error } = await supabase
        .from("partner_accounts")
        .select(select)
        .eq(plan.matchColumn, plan.usesHashedToken ? tokenHash : token)
        .maybeSingle();

      if (!error) {
        return withPartnerAuthSessionVersionFallback(
          (data as PartnerPortalAccountRow | null) ?? null,
        );
      }

      if (isMissingPartnerAuthSessionVersionColumnError(error.message)) {
        continue;
      }

      const isSchemaFallbackError =
        error.message.includes("initial_setup_token_hash") ||
        error.message.includes("initial_setup_token") ||
        error.message.includes("initial_setup_expires_at");

      if (!isSchemaFallbackError) {
        throw error;
      }

      lastSchemaError = error;
      break;
    }
  }

  if (lastSchemaError) {
    throw lastSchemaError;
  }

  return null;
}

export async function getSupabasePartnerPortalAccountById(accountId: string) {
  const supabase = getSupabaseAdminClient();
  return selectPartnerAccountMaybeSingle((select) =>
    supabase
      .from("partner_accounts")
      .select(select)
      .eq("id", accountId)
      .maybeSingle(),
  );
}

export function normalizeSupabasePartnerLoginId(loginId: string) {
  return normalizePartnerLoginId(loginId);
}
