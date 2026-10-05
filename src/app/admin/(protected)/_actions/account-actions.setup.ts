import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin-access";
import { getSafeAdminActionErrorCode } from "@/lib/admin-action-errors";
import { sendPartnerPortalInitialSetupEmail } from "@/lib/partner-email";
import { issuePartnerAccountInitialSetupLink } from "./partner-support/setup-link";
import {
  logAdminAction,
  redirectAdminActionError,
  revalidatePartnerAccountData,
} from "./shared-helpers";
import {
  assertPartnerAccountGlobalMutationScopeOrRedirect,
  getPartnerAccountSupabase,
} from "./account-actions.shared";

export async function createPartnerAccountInitialSetupUrlAction(formData: FormData) {
  const adminSession = await requireAdminPermission("companies", "update", {
    path: "/admin/companies",
  });
  const accountId = String(formData.get("id") || "").trim();
  if (!accountId) {
    redirectAdminActionError("/admin/companies?tab=accounts", "partner_account_missing_id");
  }
  await assertPartnerAccountGlobalMutationScopeOrRedirect(accountId, adminSession.account);

  const supabase = getPartnerAccountSupabase();
  let issued: Awaited<ReturnType<typeof issuePartnerAccountInitialSetupLink>>;
  try {
    issued = await issuePartnerAccountInitialSetupLink(supabase, accountId);
  } catch (error) {
    redirectAdminActionError(
      "/admin/companies?tab=accounts",
      getSafeAdminActionErrorCode(error, "partner_account_setup_link_failed"),
    );
  }

  await logAdminAction("partner_account_initial_setup_link_generate", {
    targetType: "partner_account",
    targetId: issued.account.id,
    properties: {
      loginId: issued.account.login_id,
      displayName: issued.account.display_name,
      emailSentTo: issued.emailSentTo,
      setupLinkGeneratedAt: issued.now,
      setupLinkExpiresAt: issued.expiresAt,
    },
  });

  revalidatePartnerAccountData();
  redirect(
    `/admin/companies?tab=accounts&generatedSetupAccountId=${encodeURIComponent(issued.account.id)}&generatedSetupUrl=${encodeURIComponent(issued.setupUrl)}`,
  );
}

export async function sendPartnerAccountInitialSetupUrlAction(formData: FormData) {
  const adminSession = await requireAdminPermission("companies", "update", {
    path: "/admin/companies",
  });
  const accountId = String(formData.get("id") || "").trim();
  if (!accountId) {
    redirectAdminActionError("/admin/companies?tab=accounts", "partner_account_missing_id");
  }
  await assertPartnerAccountGlobalMutationScopeOrRedirect(accountId, adminSession.account);

  const supabase = getPartnerAccountSupabase();
  let issued: Awaited<ReturnType<typeof issuePartnerAccountInitialSetupLink>>;
  try {
    issued = await issuePartnerAccountInitialSetupLink(supabase, accountId);
  } catch (error) {
    redirectAdminActionError(
      "/admin/companies?tab=accounts",
      getSafeAdminActionErrorCode(error, "partner_account_setup_link_failed"),
    );
  }

  try {
    await sendPartnerPortalInitialSetupEmail({
      to: issued.emailSentTo,
      displayName: issued.account.display_name,
      loginId: issued.account.login_id,
      setupUrl: issued.setupUrl,
    });
  } catch (error) {
    // The new link is already stored, so this is a delivery failure, not an
    // input error: tell the operator to fix mail or hand over a new URL.
    console.error("[admin] partner initial setup email failed", {
      accountId: issued.account.id,
      message: error instanceof Error ? error.message : "unknown_delivery_error",
    });
    redirectAdminActionError(
      "/admin/companies?tab=accounts",
      "partner_account_setup_email_failed",
    );
  }

  const { error: sentAtError } = await supabase
    .from("partner_accounts")
    .update({
      initial_setup_link_sent_at: issued.now,
      updated_at: issued.now,
    })
    .eq("id", issued.account.id);

  if (sentAtError) {
    // The mail is already delivered; only the "sent" timestamp is missing.
    console.error("[admin] partner initial setup sent-at update failed", {
      accountId: issued.account.id,
      message: sentAtError.message,
    });
  }

  await logAdminAction("partner_account_initial_setup_link_send", {
    targetType: "partner_account",
    targetId: issued.account.id,
    properties: {
      loginId: issued.account.login_id,
      displayName: issued.account.display_name,
      emailSentTo: issued.emailSentTo,
      setupLinkSentAt: issued.now,
      setupLinkExpiresAt: issued.expiresAt,
    },
  });

  revalidatePartnerAccountData();
  redirect("/admin/companies?tab=accounts");
}
