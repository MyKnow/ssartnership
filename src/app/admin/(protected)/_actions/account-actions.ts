import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { issuePartnerAccountInitialSetupLink } from "./partner-support/setup-link";
import { sendPartnerPortalInitialSetupEmail } from "@/lib/partner-email";
import {
  parsePartnerAccountCreatePayload,
  parsePartnerAccountCompanyPayload,
  parsePartnerAccountPayload,
} from "./shared-parsers";
import {
  logAdminAction,
  redirectAdminActionError,
  revalidatePartnerCompanyData,
  revalidatePartnerAccountData,
} from "./shared-helpers";

export async function updatePartnerAccountAction(formData: FormData) {
  await requireAdmin();
  let payload: ReturnType<typeof parsePartnerAccountPayload>;
  try {
    payload = parsePartnerAccountPayload(formData);
  } catch (error) {
    redirectAdminActionError(
      "/admin/companies",
      error instanceof Error ? error.message : "partner_account_invalid_request",
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data: existingAccount, error: accountError } = await supabase
    .from("partner_accounts")
    .select(
      "id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at,last_login_at,created_at,updated_at",
    )
    .eq("id", payload.id)
    .maybeSingle();

  if (accountError) {
    redirectAdminActionError("/admin/companies", "partner_account_invalid_request");
  }
  if (!existingAccount) {
    redirectAdminActionError("/admin/companies", "partner_account_missing_id");
  }

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
      redirectAdminActionError("/admin/companies", "partner_account_invalid_request");
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
  redirect("/admin/companies");
}

export async function createPartnerAccountAction(formData: FormData) {
  await requireAdmin();
  let payload: ReturnType<typeof parsePartnerAccountCreatePayload>;
  try {
    payload = parsePartnerAccountCreatePayload(formData);
  } catch (error) {
    redirectAdminActionError(
      "/admin/companies",
      error instanceof Error ? error.message : "partner_account_invalid_request",
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data: existingAccount, error: lookupError } = await supabase
    .from("partner_accounts")
    .select("id")
    .eq("login_id", payload.loginId)
    .maybeSingle();

  if (lookupError) {
    redirectAdminActionError("/admin/companies", "partner_account_invalid_request");
  }
  if (existingAccount) {
    redirectAdminActionError("/admin/companies", "partner_account_exists");
  }

  const { data: company, error: companyError } = await supabase
    .from("partner_companies")
    .select("id,name,slug,description,is_active")
    .eq("id", payload.companyId)
    .maybeSingle();

  if (companyError || !company) {
    redirectAdminActionError("/admin/companies", "partner_account_company_missing");
  }

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
      initial_setup_token: null,
      initial_setup_verification_code_hash: null,
      initial_setup_link_sent_at: null,
      created_at: now,
      updated_at: now,
    })
    .select(
      "id,login_id,display_name,email,password_hash,password_salt,must_change_password,is_active,email_verified_at,initial_setup_completed_at,initial_setup_token,initial_setup_verification_code_hash,initial_setup_link_sent_at",
    )
    .single();

  if (createError || !createdAccount) {
    redirectAdminActionError("/admin/companies", "partner_account_invalid_request");
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
    redirectAdminActionError("/admin/companies", "partner_account_invalid_request");
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
  redirect("/admin/companies");
}

export async function createPartnerAccountInitialSetupUrlAction(formData: FormData) {
  await requireAdmin();
  const accountId = String(formData.get("id") || "").trim();
  if (!accountId) {
    redirectAdminActionError("/admin/companies", "partner_account_missing_id");
  }

  const supabase = getSupabaseAdminClient();
  let issued: Awaited<ReturnType<typeof issuePartnerAccountInitialSetupLink>>;
  try {
    issued = await issuePartnerAccountInitialSetupLink(supabase, accountId);
  } catch {
    redirectAdminActionError("/admin/companies", "partner_account_invalid_request");
  }

  await logAdminAction("partner_account_initial_setup_link_generate", {
    targetType: "partner_account",
    targetId: issued.account.id,
    properties: {
      loginId: issued.account.login_id,
      displayName: issued.account.display_name,
      emailSentTo: issued.emailSentTo,
      setupLinkGeneratedAt: issued.now,
    },
  });

  revalidatePartnerAccountData();
  redirect("/admin/companies");
}

export async function sendPartnerAccountInitialSetupUrlAction(formData: FormData) {
  await requireAdmin();
  const accountId = String(formData.get("id") || "").trim();
  if (!accountId) {
    redirectAdminActionError("/admin/companies", "partner_account_missing_id");
  }

  const supabase = getSupabaseAdminClient();
  let issued: Awaited<ReturnType<typeof issuePartnerAccountInitialSetupLink>>;
  try {
    issued = await issuePartnerAccountInitialSetupLink(supabase, accountId);
  } catch {
    redirectAdminActionError("/admin/companies", "partner_account_invalid_request");
  }

  try {
    await sendPartnerPortalInitialSetupEmail({
      to: issued.emailSentTo,
      displayName: issued.account.display_name,
      loginId: issued.account.login_id,
      setupUrl: issued.setupUrl,
      verificationCode: issued.verificationCode,
    });
  } catch {
    redirectAdminActionError("/admin/companies", "partner_account_invalid_request");
  }

  const { error: sentAtError } = await supabase
    .from("partner_accounts")
    .update({
      initial_setup_link_sent_at: issued.now,
      updated_at: issued.now,
    })
    .eq("id", issued.account.id);

  if (sentAtError) {
    redirectAdminActionError("/admin/companies", "partner_account_invalid_request");
  }

  await logAdminAction("partner_account_initial_setup_link_send", {
    targetType: "partner_account",
    targetId: issued.account.id,
    properties: {
      loginId: issued.account.login_id,
      displayName: issued.account.display_name,
      emailSentTo: issued.emailSentTo,
      setupLinkSentAt: issued.now,
    },
  });

  revalidatePartnerAccountData();
  redirect("/admin/companies");
}

export async function updatePartnerAccountCompanyConnectionAction(formData: FormData) {
  await requireAdmin();
  let payload: ReturnType<typeof parsePartnerAccountCompanyPayload>;
  try {
    payload = parsePartnerAccountCompanyPayload(formData);
  } catch (error) {
    redirectAdminActionError(
      "/admin/companies",
      error instanceof Error ? error.message : "partner_account_company_invalid_request",
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data: existingLink, error: linkError } = await supabase
    .from("partner_account_companies")
    .select("id,account_id,company_id,is_active,created_at")
    .eq("account_id", payload.accountId)
    .eq("company_id", payload.companyId)
    .maybeSingle();

  if (linkError) {
    redirectAdminActionError("/admin/companies", "partner_account_company_invalid_request");
  }

  const createdLink = !existingLink;

  if (existingLink && Boolean(existingLink.is_active) !== payload.isActive) {
    const { error } = await supabase
      .from("partner_account_companies")
      .update({ is_active: payload.isActive })
      .eq("id", existingLink.id);

    if (error) {
      redirectAdminActionError("/admin/companies", "partner_account_company_invalid_request");
    }
  } else if (!existingLink) {
    const { error } = await supabase
      .from("partner_account_companies")
      .insert({
        account_id: payload.accountId,
        company_id: payload.companyId,
        is_active: payload.isActive,
      });

    if (error) {
      redirectAdminActionError("/admin/companies", "partner_account_company_invalid_request");
    }
  }

  await logAdminAction("partner_account_company_update", {
    targetType: "partner_account_company",
    targetId: existingLink?.id ?? `${payload.accountId}:${payload.companyId}`,
    properties: {
      accountId: payload.accountId,
      companyId: payload.companyId,
      isActive: payload.isActive,
      createdLink,
    },
  });

  revalidatePartnerAccountData();
  revalidatePartnerCompanyData();
  redirect("/admin/companies");
}
