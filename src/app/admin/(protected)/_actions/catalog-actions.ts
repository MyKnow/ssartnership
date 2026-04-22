import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { buildAuditChangeSummary } from "@/lib/audit-change-summary";
import { buildPartnerCompanySlug } from "./partner-support";
import {
  parseCategoryPayloadOrRedirect,
} from "./shared-parser-redirects";
import { parsePartnerCompanyCrudPayload } from "./shared-parsers";
import {
  logAdminAction,
  revalidateAdminAndPublicPaths,
  revalidateCategoryData,
  redirectAdminActionError,
  revalidatePartnerCompanyData,
} from "./shared-helpers";
import type { PartnerCompanyCrudInput, PartnerCompanyRow } from "./shared-types";

function normalizePartnerCompanyRow(row: PartnerCompanyRow | null | undefined) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    is_active: row.is_active ?? true,
  } satisfies PartnerCompanyRow;
}

export async function createCategoryAction(formData: FormData) {
  await requireAdmin();
  const { key, label, description, color } = parseCategoryPayloadOrRedirect(
    formData,
    "/admin/partners",
  );

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ key, label, description, color })
    .select("id")
    .single();

  if (error) {
    redirectAdminActionError("/admin/partners", "category_invalid_request");
  }

  await logAdminAction("category_create", {
    targetType: "category",
    targetId: data?.id ?? null,
    properties: { key, label, description, color },
  });
  revalidateCategoryData();
  revalidateAdminAndPublicPaths();
}

export async function updateCategoryAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  const { key, label, description, color } = parseCategoryPayloadOrRedirect(
    formData,
    "/admin/partners",
  );

  if (!id) {
    redirectAdminActionError("/admin/partners", "category_invalid_request");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("categories")
    .update({ key, label, description, color })
    .eq("id", id);

  if (error) {
    redirectAdminActionError("/admin/partners", "category_invalid_request");
  }

  await logAdminAction("category_update", {
    targetType: "category",
    targetId: id,
    properties: { key, label, description, color },
  });
  revalidateCategoryData();
  revalidateAdminAndPublicPaths();
  redirect("/admin/partners");
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) {
    redirectAdminActionError("/admin/partners", "category_invalid_request");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    redirectAdminActionError("/admin/partners", "category_invalid_request");
  }

  await logAdminAction("category_delete", {
    targetType: "category",
    targetId: id,
  });
  revalidateCategoryData();
  revalidateAdminAndPublicPaths();
}

export async function createPartnerCompanyAction(formData: FormData) {
  await requireAdmin();
  let payload: PartnerCompanyCrudInput;
  try {
    payload = parsePartnerCompanyCrudPayload(formData);
  } catch (error) {
    redirectAdminActionError(
      "/admin/companies",
      error instanceof Error ? error.message : "company_invalid_request",
    );
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("partner_companies")
    .insert({
      name: payload.name,
      slug: buildPartnerCompanySlug(payload.name),
      description: payload.description,
      is_active: payload.isActive,
    })
    .select("id,name,slug,description,is_active")
    .single();

  if (error) {
    redirectAdminActionError("/admin/companies", "company_invalid_request");
  }

  const company = normalizePartnerCompanyRow(data as PartnerCompanyRow);
  if (!company) {
    redirectAdminActionError("/admin/companies", "company_invalid_request");
  }

  await logAdminAction("partner_company_create", {
    targetType: "partner_company",
    targetId: company.id,
    properties: {
      name: company.name,
      slug: company.slug,
      description: company.description ?? null,
      isActive: company.is_active ?? true,
    },
  });

  revalidatePartnerCompanyData();
  redirect("/admin/companies");
}

export async function updatePartnerCompanyAction(formData: FormData) {
  await requireAdmin();
  let payload: PartnerCompanyCrudInput;
  try {
    payload = parsePartnerCompanyCrudPayload(formData);
  } catch (error) {
    redirectAdminActionError(
      "/admin/companies",
      error instanceof Error ? error.message : "company_invalid_request",
    );
  }

  if (!payload.companyId) {
    redirectAdminActionError("/admin/companies", "company_invalid_request");
  }

  const supabase = getSupabaseAdminClient();
  const { data: existingCompany, error: companyError } = await supabase
    .from("partner_companies")
    .select("id,name,slug,description,is_active,created_at,updated_at")
    .eq("id", payload.companyId)
    .maybeSingle();

  if (companyError || !existingCompany) {
    redirectAdminActionError("/admin/companies", "company_invalid_request");
  }

  const nextCompany = {
    name: payload.name,
    slug: existingCompany.slug,
    description: payload.description,
    is_active: payload.isActive,
    updated_at: new Date().toISOString(),
  };

  const hasChanges =
    nextCompany.name !== existingCompany.name ||
    nextCompany.slug !== existingCompany.slug ||
    nextCompany.description !== existingCompany.description ||
    Boolean(existingCompany.is_active) !== nextCompany.is_active;

  if (hasChanges) {
    const { error: updateError } = await supabase
      .from("partner_companies")
      .update(nextCompany)
      .eq("id", payload.companyId);

    if (updateError) {
      redirectAdminActionError("/admin/companies", "company_invalid_request");
    }
  }

  const companyAudit = buildAuditChangeSummary("협력사", [
    {
      label: "이름",
      before: existingCompany.name,
      after: nextCompany.name,
    },
    {
      label: "설명",
      before: existingCompany.description ?? "",
      after: nextCompany.description ?? "",
    },
    {
      label: "활성 상태",
      before: Boolean(existingCompany.is_active),
      after: nextCompany.is_active,
      format: (value) => (value ? "활성" : "비활성"),
    },
  ]);

  if (companyAudit.changedFields.length > 0) {
    await logAdminAction("partner_company_update", {
      targetType: "partner_company",
      targetId: payload.companyId,
      properties: {
        summary: companyAudit.summary,
        changedFields: companyAudit.changedFields,
        changes: companyAudit.changes,
        name: nextCompany.name,
        slug: nextCompany.slug,
        description: nextCompany.description,
        isActive: nextCompany.is_active,
      },
    });
  }

  revalidatePartnerCompanyData();
  redirect("/admin/companies");
}

export async function deletePartnerCompanyAction(formData: FormData) {
  await requireAdmin();
  const companyId = String(formData.get("companyId") || "").trim();
  if (!companyId) {
    redirectAdminActionError("/admin/companies", "company_invalid_request");
  }

  const supabase = getSupabaseAdminClient();
  const { data: existingCompany, error: companyError } = await supabase
    .from("partner_companies")
    .select("id,name,slug,description,is_active")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError || !existingCompany) {
    redirectAdminActionError("/admin/companies", "company_invalid_request");
  }

  const [brandCountResult, accountLinkCountResult] = await Promise.all([
    supabase
      .from("partners")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    supabase
      .from("partner_account_companies")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
  ]);

  const { error: deleteError } = await supabase
    .from("partner_companies")
    .delete()
    .eq("id", companyId);

  if (deleteError) {
    redirectAdminActionError("/admin/companies", "company_invalid_request");
  }

  await logAdminAction("partner_company_delete", {
    targetType: "partner_company",
    targetId: companyId,
    properties: {
      name: existingCompany.name,
      slug: existingCompany.slug,
      brandCount: brandCountResult.error ? 0 : brandCountResult.count ?? 0,
      accountLinkCount: accountLinkCountResult.error
        ? 0
        : accountLinkCountResult.count ?? 0,
    },
  });

  revalidatePartnerCompanyData();
  redirect("/admin/companies");
}
