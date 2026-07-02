import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  isPartnerCompanyPlanTier,
  type PartnerCompanyPlanTier,
} from "@/lib/partner-company-plans";
import {
  reviewPartnerPlanUpgradeRequest,
  updatePartnerCompanyPlanByAdmin,
} from "@/lib/partner-plan-service";
import {
  logAdminAction,
  redirectAdminActionError,
  revalidatePartnerCompanyData,
  revalidatePartnerPortalPaths,
} from "./shared-helpers";

const ADMIN_COMPANY_PLANS_PATH = "/admin/companies?tab=plans";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parsePlanTier(value: string): PartnerCompanyPlanTier {
  if (!isPartnerCompanyPlanTier(value)) {
    throw new Error("partner_company_plan_invalid_request");
  }
  return value;
}

function parseNullableKstDate(value: string, endOfDay = false) {
  if (!value) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("partner_company_plan_invalid_request");
  }
  return `${value}T${endOfDay ? "23:59:59" : "00:00:00"}+09:00`;
}

function parseNote(value: string) {
  if (value.length > 1_000) {
    throw new Error("partner_company_plan_invalid_request");
  }
  return value;
}

export async function updatePartnerCompanyPlanAction(formData: FormData) {
  const adminSession = await requireAdminPermission("companies", "update", {
    path: "/admin/companies",
  });
  let payload: {
    companyId: string;
    nextPlanTier: PartnerCompanyPlanTier;
    planStartedAt: string | null;
    planExpiresAt: string | null;
    note: string;
  };
  try {
    const companyId = getString(formData, "companyId");
    if (!companyId) {
      throw new Error("partner_company_plan_invalid_request");
    }
    payload = {
      companyId,
      nextPlanTier: parsePlanTier(getString(formData, "planTier")),
      planStartedAt: parseNullableKstDate(getString(formData, "planStartedAt")),
      planExpiresAt: parseNullableKstDate(getString(formData, "planExpiresAt"), true),
      note: parseNote(getString(formData, "note")),
    };
  } catch (error) {
    redirectAdminActionError(
      ADMIN_COMPANY_PLANS_PATH,
      error instanceof Error ? error.message : "partner_company_plan_invalid_request",
    );
  }

  try {
    await updatePartnerCompanyPlanByAdmin({
      ...payload,
      adminId: adminSession.adminId,
    });
  } catch (error) {
    redirectAdminActionError(
      ADMIN_COMPANY_PLANS_PATH,
      error instanceof Error ? error.message : "partner_company_plan_invalid_request",
    );
  }

  await logAdminAction("partner_company_plan_update", {
    targetType: "partner_company",
    targetId: payload.companyId,
    properties: {
      planTier: payload.nextPlanTier,
      planStartedAt: payload.planStartedAt,
      planExpiresAt: payload.planExpiresAt,
    },
  });
  revalidatePartnerCompanyData();
  revalidatePartnerPortalPaths();
  redirect(ADMIN_COMPANY_PLANS_PATH);
}

async function reviewPartnerPlanRequestAction(
  formData: FormData,
  nextStatus: "approved" | "rejected",
) {
  const adminSession = await requireAdminPermission("companies", "update", {
    path: "/admin/companies",
  });
  const requestId = getString(formData, "requestId");
  if (!requestId) {
    redirectAdminActionError(ADMIN_COMPANY_PLANS_PATH, "partner_company_plan_missing_request");
  }
  try {
    await reviewPartnerPlanUpgradeRequest({
      requestId,
      adminId: adminSession.adminId,
      nextStatus,
      adminNote: getString(formData, "adminNote"),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("이미 처리된")
        ? "partner_company_plan_processed"
        : error instanceof Error
          ? error.message
          : "partner_company_plan_invalid_request";
    redirectAdminActionError(ADMIN_COMPANY_PLANS_PATH, message);
  }

  await logAdminAction(`partner_plan_upgrade_${nextStatus}`, {
    targetType: "partner_plan_upgrade_request",
    targetId: requestId,
    properties: {
      status: nextStatus,
    },
  });
  revalidatePartnerCompanyData();
  revalidatePartnerPortalPaths();
  redirect(ADMIN_COMPANY_PLANS_PATH);
}

export async function approvePartnerPlanUpgradeRequestAction(formData: FormData) {
  return reviewPartnerPlanRequestAction(formData, "approved");
}

export async function rejectPartnerPlanUpgradeRequestAction(formData: FormData) {
  return reviewPartnerPlanRequestAction(formData, "rejected");
}
