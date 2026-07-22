"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminPermission } from "@/lib/admin-access";
import { assertAdminCanAccessManagedCampuses } from "@/lib/admin-scope";
import {
  AdminPartnerBenefitUsageValidationError,
  parseAdminPartnerBenefitUsageForm,
} from "@/lib/partner-benefit-usage-admin";
import { partnerBenefitUsageRepository } from "@/lib/repositories";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import {
  logAdminAction,
  redirectAdminActionError,
} from "./shared-helpers";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getDetailPath(partnerId: string) {
  return `/admin/partners/${encodeURIComponent(partnerId)}`;
}

function mapRepositoryError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("benefit_not_found")) return "admin_usage_benefit_not_found";
  if (message.includes("member_not_found")) return "admin_usage_member_not_found";
  if (message.includes("use_count_exceeded")) return "admin_usage_count_exceeded";
  if (message.includes("usage_not_found")) return "admin_usage_not_found";
  return "admin_usage_database_failed";
}

async function requireManagedPartner(partnerId: string, action: "create" | "update" | "delete") {
  const detailPath = getDetailPath(partnerId);
  const adminSession = await requireAdminPermission("brands", action, { path: detailPath });
  if (!isUuid(partnerId)) {
    redirectAdminActionError(detailPath, "admin_usage_invalid_request");
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("partners")
    .select("id,managed_campus_slugs")
    .eq("id", partnerId)
    .maybeSingle();
  if (error || !data) {
    redirectAdminActionError(detailPath, "admin_usage_invalid_request");
  }
  try {
    assertAdminCanAccessManagedCampuses(adminSession.account, data.managed_campus_slugs);
  } catch {
    redirectAdminActionError(detailPath, "regional_admin_scope_denied");
  }
  return { adminSession, detailPath };
}

function parseUsageInput(formData: FormData, detailPath: string) {
  try {
    return parseAdminPartnerBenefitUsageForm({
      partnerId: getString(formData, "partnerId"),
      memberId: getString(formData, "memberId"),
      benefitId: getString(formData, "benefitId"),
      useCount: getString(formData, "useCount"),
      verifiedAt: getString(formData, "verifiedAt"),
    });
  } catch (error) {
    const code = error instanceof AdminPartnerBenefitUsageValidationError
      ? error.code
      : "admin_usage_invalid_request";
    redirectAdminActionError(detailPath, code);
  }
}

export async function createPartnerBenefitUsageAction(formData: FormData) {
  const partnerId = getString(formData, "partnerId");
  const { adminSession, detailPath } = await requireManagedPartner(partnerId, "create");
  const input = parseUsageInput(formData, detailPath);
  if (input.partnerId !== partnerId) {
    redirectAdminActionError(detailPath, "admin_usage_invalid_request");
  }

  try {
    const usage = await partnerBenefitUsageRepository.createAdminUsage(input);
    await logAdminAction("partner_benefit_usage_create", {
      targetType: "partner_benefit_usage",
      targetId: usage.usageId,
      properties: {
        partnerId: input.partnerId,
        memberId: input.memberId,
        benefitId: input.benefitId,
        useCount: input.useCount,
        source: "admin_manual",
        adminId: adminSession.adminId,
      },
    });
  } catch (error) {
    redirectAdminActionError(detailPath, mapRepositoryError(error));
  }

  revalidatePath(detailPath);
  redirect(`${detailPath}?success=usage-created`);
}

export async function updatePartnerBenefitUsageAction(formData: FormData) {
  const partnerId = getString(formData, "partnerId");
  const usageId = getString(formData, "usageId");
  const { adminSession, detailPath } = await requireManagedPartner(partnerId, "update");
  if (!isUuid(usageId)) {
    redirectAdminActionError(detailPath, "admin_usage_invalid_request");
  }
  const input = parseUsageInput(formData, detailPath);
  if (input.partnerId !== partnerId) {
    redirectAdminActionError(detailPath, "admin_usage_invalid_request");
  }

  try {
    const usage = await partnerBenefitUsageRepository.updateAdminUsage({
      ...input,
      usageId,
    });
    await logAdminAction("partner_benefit_usage_update", {
      targetType: "partner_benefit_usage",
      targetId: usage.usageId,
      properties: {
        partnerId: input.partnerId,
        memberId: input.memberId,
        benefitId: input.benefitId,
        useCount: input.useCount,
        source: "admin_manual",
        adminId: adminSession.adminId,
      },
    });
  } catch (error) {
    redirectAdminActionError(detailPath, mapRepositoryError(error));
  }

  revalidatePath(detailPath);
  redirect(`${detailPath}?success=usage-updated`);
}

export async function deleteBenefitUsageAction(formData: FormData) {
  const partnerId = getString(formData, "partnerId");
  const usageId = getString(formData, "usageId");
  const { adminSession, detailPath } = await requireManagedPartner(partnerId, "delete");
  if (!isUuid(usageId)) {
    redirectAdminActionError(detailPath, "admin_usage_invalid_request");
  }

  try {
    await partnerBenefitUsageRepository.deleteAdminUsage({ partnerId, usageId });
    await logAdminAction("partner_benefit_usage_delete", {
      targetType: "partner_benefit_usage",
      targetId: usageId,
      properties: {
        partnerId,
        source: "admin_manual",
        adminId: adminSession.adminId,
      },
    });
  } catch (error) {
    redirectAdminActionError(detailPath, mapRepositoryError(error));
  }

  revalidatePath(detailPath);
  redirect(`${detailPath}?success=usage-deleted`);
}
