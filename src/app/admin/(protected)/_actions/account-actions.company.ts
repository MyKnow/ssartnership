import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { parsePartnerAccountCompanyPayload } from "./shared-parsers";
import {
  logAdminAction,
  redirectAdminActionError,
  revalidatePartnerAccountData,
  revalidatePartnerCompanyData,
} from "./shared-helpers";
import { getPartnerAccountSupabase } from "./account-actions.shared";

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

  const supabase = getPartnerAccountSupabase();
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

