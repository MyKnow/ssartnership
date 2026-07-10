import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  assertAdminCanAccessManagedCampuses,
  assertAdminCanUseGlobalFeature,
  resolveCreatedManagedCampusSlugs,
} from "@/lib/admin-scope";
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
    managed_campus_slugs: row.managed_campus_slugs ?? [],
  } satisfies PartnerCompanyRow;
}

export async function createCategoryAction(formData: FormData) {
  const adminSession = await requireAdminPermission("brands", "create", {
    path: "/admin/categories",
  });
  try {
    assertAdminCanUseGlobalFeature(adminSession.account);
  } catch {
    redirectAdminActionError("/admin/categories", "admin_global_scope_required");
  }
  const { key, label, description, color } = parseCategoryPayloadOrRedirect(
    formData,
    "/admin/categories",
  );

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ key, label, description, color })
    .select("id")
    .single();

  if (error) {
    redirectAdminActionError("/admin/categories", "category_invalid_request");
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
  const adminSession = await requireAdminPermission("brands", "update", {
    path: "/admin/categories",
  });
  try {
    assertAdminCanUseGlobalFeature(adminSession.account);
  } catch {
    redirectAdminActionError("/admin/categories", "admin_global_scope_required");
  }
  const id = String(formData.get("id") || "").trim();
  const { key, label, description, color } = parseCategoryPayloadOrRedirect(
    formData,
    "/admin/categories",
  );

  if (!id) {
    redirectAdminActionError("/admin/categories", "category_invalid_request");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("categories")
    .update({ key, label, description, color })
    .eq("id", id);

  if (error) {
    redirectAdminActionError("/admin/categories", "category_invalid_request");
  }

  await logAdminAction("category_update", {
    targetType: "category",
    targetId: id,
    properties: { key, label, description, color },
  });
  revalidateCategoryData();
  revalidateAdminAndPublicPaths();
  redirect("/admin/categories");
}

export async function deleteCategoryAction(formData: FormData) {
  const adminSession = await requireAdminPermission("brands", "delete", {
    path: "/admin/categories",
  });
  try {
    assertAdminCanUseGlobalFeature(adminSession.account);
  } catch {
    redirectAdminActionError("/admin/categories", "admin_global_scope_required");
  }
  const id = String(formData.get("id") || "").trim();
  if (!id) {
    redirectAdminActionError("/admin/categories", "category_invalid_request");
  }
  redirectAdminActionError("/admin/categories", "category_delete_deferred");
}

export async function createPartnerCompanyAction(formData: FormData) {
  const adminSession = await requireAdminPermission("companies", "create", {
    path: "/admin/companies",
  });
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
  const managedCampusSlugs = resolveCreatedManagedCampusSlugs(
    adminSession.account,
    null,
  );
  const { data, error } = await supabase
    .from("partner_companies")
    .insert({
      name: payload.name,
      slug: buildPartnerCompanySlug(payload.name),
      description: payload.description,
      is_active: payload.isActive,
      managed_campus_slugs: managedCampusSlugs,
    })
    .select("id,name,slug,description,is_active,managed_campus_slugs")
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
      managedCampusSlugs,
    },
  });

  revalidatePartnerCompanyData();
  redirect("/admin/companies");
}

export async function updatePartnerCompanyAction(formData: FormData) {
  const adminSession = await requireAdminPermission("companies", "update", {
    path: "/admin/companies",
  });
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
    .select("id,name,slug,description,is_active,managed_campus_slugs,created_at,updated_at")
    .eq("id", payload.companyId)
    .maybeSingle();

  if (companyError || !existingCompany) {
    redirectAdminActionError("/admin/companies", "company_invalid_request");
  }
  try {
    assertAdminCanAccessManagedCampuses(
      adminSession.account,
      (existingCompany as PartnerCompanyRow).managed_campus_slugs,
    );
  } catch {
    redirectAdminActionError("/admin/companies", "regional_admin_scope_denied");
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

  const companyAudit = buildAuditChangeSummary("파트너사", [
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
        fieldChanges: companyAudit.fieldChanges,
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
  const adminSession = await requireAdminPermission("companies", "delete", {
    path: "/admin/companies",
  });
  const companyId = String(formData.get("companyId") || "").trim();
  if (!companyId) {
    redirectAdminActionError("/admin/companies", "company_invalid_request");
  }

  const supabase = getSupabaseAdminClient();
  const { data: existingCompany, error: companyError } = await supabase
    .from("partner_companies")
    .select("id,name,slug,description,is_active,managed_campus_slugs")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError || !existingCompany) {
    redirectAdminActionError("/admin/companies", "company_invalid_request");
  }
  try {
    assertAdminCanAccessManagedCampuses(
      adminSession.account,
      (existingCompany as PartnerCompanyRow).managed_campus_slugs,
    );
  } catch {
    redirectAdminActionError("/admin/companies", "regional_admin_scope_denied");
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
