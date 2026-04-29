import { normalizePartnerLoginId } from "../partner-utils.ts";
import { hashOpaqueToken } from "../password.ts";
import { getSupabaseAdminClient } from "../supabase/server.ts";
import type { PartnerPortalAccountRow } from "./types.ts";
import { getPartnerSetupLookupPlans } from "./setup-schema.ts";

const ACCOUNT_SELECT =
  "id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at";

export async function findSupabasePartnerPortalAccount(
  loginIdOrEmail: string,
): Promise<PartnerPortalAccountRow | null> {
  const supabase = getSupabaseAdminClient();
  const select = ACCOUNT_SELECT;

  const { data: byLoginId, error: loginError } = await supabase
    .from("partner_accounts")
    .select(select)
    .eq("login_id", loginIdOrEmail)
    .maybeSingle();

  if (loginError) {
    throw loginError;
  }
  if (byLoginId) {
    return byLoginId as PartnerPortalAccountRow;
  }

  const { data: byEmail, error: emailError } = await supabase
    .from("partner_accounts")
    .select(select)
    .eq("email", loginIdOrEmail)
    .maybeSingle();

  if (emailError) {
    throw emailError;
  }

  return (byEmail as PartnerPortalAccountRow | null) ?? null;
}

export async function findSupabasePartnerPortalSetupAccount(token: string) {
  const supabase = getSupabaseAdminClient();
  const tokenHash = hashOpaqueToken(token);
  let lastSchemaError: Error | null = null;

  for (const plan of getPartnerSetupLookupPlans(ACCOUNT_SELECT)) {
    const { data, error } = await supabase
      .from("partner_accounts")
      .select(plan.select)
      .eq(plan.matchColumn, plan.usesHashedToken ? tokenHash : token)
      .maybeSingle();

    if (!error) {
      return (data as PartnerPortalAccountRow | null) ?? null;
    }

    const isSchemaFallbackError =
      error.message.includes("initial_setup_token_hash") ||
      error.message.includes("initial_setup_token") ||
      error.message.includes("initial_setup_expires_at");

    if (!isSchemaFallbackError) {
      throw error;
    }

    lastSchemaError = error;
  }

  if (lastSchemaError) {
    throw lastSchemaError;
  }

  return null;
}

export async function getSupabasePartnerPortalAccountById(accountId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: account, error } = await supabase
    .from("partner_accounts")
    .select(ACCOUNT_SELECT)
    .eq("id", accountId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (account as PartnerPortalAccountRow | null) ?? null;
}

export function normalizeSupabasePartnerLoginId(loginId: string) {
  return normalizePartnerLoginId(loginId);
}
