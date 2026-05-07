import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { issuePartnerAccountInitialSetupLink } from "./partner-support/setup-link";
import {
  parsePartnerAccountCreatePayload,
  parsePartnerAccountPayload,
} from "./shared-parsers";
import {
  logAdminAction,
  redirectAdminActionError,
  revalidatePartnerAccountData,
  revalidatePartnerCompanyData,
} from "./shared-helpers";
import {
  getPartnerAccountSupabase,
  loadPartnerAccountOrRedirect,
  loadPartnerCompanyOrRedirect,
} from "./account-actions.shared";

export async function updatePartnerAccountAction(formData: FormData) {
  await requireAdmin();
  let payload: ReturnType<typeof parsePartnerAccountPayload>;
  try {
    payload = parsePartnerAccountPayload(formData);
  } catch (error) {
    redirectAdminActionError(
      "/admin/companies?tab=accounts",
      error instanceof Error ? error.message : "partner_account_invalid_request",
    );
  }

  const { supabase, account: existingAccount } = await loadPartnerAccountOrRedirect(payload.id);
  const nextAccount = {
    login_id: payload.loginId,
    display_name: payload.displayName,
    email: payload.loginId,
    is_active: payload.isActive,
    must_change_password: payload.mustChangePassword,
    updated_at: new Date().toISOString(),
  };

  const hasChanges =
    existingAccount.login_id !== nextAccount.login_id ||
    existingAccount.display_name !== nextAccount.display_name ||
    (existingAccount.email ?? existingAccount.login_id) !== nextAccount.email ||
    Boolean(existingAccount.is_active) !== nextAccount.is_active ||
    Boolean(existingAccount.must_change_password) !== nextAccount.must_change_password;

  if (hasChanges) {
    const { error } = await supabase
      .from("partner_accounts")
      .update(nextAccount)
      .eq("id", payload.id);

    if (error) {
      redirectAdminActionError("/admin/companies?tab=accounts", "partner_account_invalid_request");
    }
  }

  const linkedCompanyCount = await supabase
    .from("partner_account_companies")
    .select("id", { count: "exact", head: true })
    .eq("account_id", payload.id)
    .eq("is_active", true);

  await logAdminAction("partner_account_update", {
    targetType: "partner_account",
    targetId: payload.id,
    properties: {
      loginId: payload.loginId,
      displayName: payload.displayName,
      isActive: payload.isActive,
      mustChangePassword: payload.mustChangePassword,
      companyCount: linkedCompanyCount.count ?? 0,
    },
  });

  revalidatePartnerAccountData();
  redirect("/admin/companies?tab=accounts");
}

export async function createPartnerAccountAction(formData: FormData) {
  await requireAdmin();
  let payload: ReturnType<typeof parsePartnerAccountCreatePayload>;
  try {
    payload = parsePartnerAccountCreatePayload(formData);
  } catch (error) {
    redirectAdminActionError(
      "/admin/companies?tab=accounts",
      error instanceof Error ? error.message : "partner_account_invalid_request",
    );
  }

  const supabase = getPartnerAccountSupabase();
  const { data: existingAccount, error: lookupError } = await supabase
    .from("partner_accounts")
    .select("id")
    .eq("login_id", payload.loginId)
    .maybeSingle();

  if (lookupError) {
    redirectAdminActionError("/admin/companies?tab=accounts", "partner_account_invalid_request");
  }
  if (existingAccount) {
    redirectAdminActionError("/admin/companies?tab=accounts", "partner_account_exists");
  }

  const { company } = await loadPartnerCompanyOrRedirect(payload.companyId);
  const passwordRecord = hashPassword(generateTempPassword(12));
  const now = new Date().toISOString();

  const { data: createdAccount, error: createError } = await supabase
    .from("partner_accounts")
    .insert({
      login_id: payload.loginId,
      display_name: payload.displayName,
      email: payload.loginId,
      password_hash: passwordRecord.hash,
      password_salt: passwordRecord.salt,
      must_change_password: true,
      is_active: payload.isActive,
      email_verified_at: null,
      initial_setup_completed_at: null,
      initial_setup_link_sent_at: null,
      initial_setup_expires_at: null,
      created_at: now,
      updated_at: now,
    })
    .select(
      "id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at,initial_setup_link_sent_at,initial_setup_expires_at",
    )
    .single();

  if (createError || !createdAccount) {
    redirectAdminActionError("/admin/companies?tab=accounts", "partner_account_invalid_request");
  }

  const cleanup = async () => {
    await supabase.from("partner_accounts").delete().eq("id", createdAccount.id);
  };

  let setupLink = null as Awaited<
    ReturnType<typeof issuePartnerAccountInitialSetupLink>
  > | null;

  try {
    if (payload.isActive) {
      setupLink = await issuePartnerAccountInitialSetupLink(
        supabase,
        createdAccount.id,
      );
    }

    const { error: linkError } = await supabase
      .from("partner_account_companies")
      .insert({
        account_id: createdAccount.id,
        company_id: company.id,
        is_active: true,
      });

    if (linkError) {
      throw new Error(linkError.message);
    }
  } catch (error) {
    await cleanup();
    console.error("[admin] partner account create failed", error);
    redirectAdminActionError("/admin/companies?tab=accounts", "partner_account_invalid_request");
  }

  await logAdminAction("partner_account_create", {
    targetType: "partner_account",
    targetId: createdAccount.id,
    properties: {
      loginId: payload.loginId,
      displayName: payload.displayName,
      companyId: company.id,
      isActive: payload.isActive,
      setupLinkGenerated: Boolean(setupLink),
    },
  });

  revalidatePartnerAccountData();
  revalidatePartnerCompanyData();
  redirect("/admin/companies?tab=accounts");
}
