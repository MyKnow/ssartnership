import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  isPartnerCompanyPlanTier,
  type PartnerCompanyPlanTier,
} from "@/lib/partner-company-plans";
import {
  confirmPartnerPlanBankTransferPayment,
  reviewPartnerPlanUpgradeRequest,
  updatePartnerBrandPlanByAdmin,
} from "@/lib/partner-plan-service";
import {
  logAdminAction,
  redirectAdminActionError,
  revalidatePartnerCompanyData,
  revalidatePartnerPortalPaths,
} from "./shared-helpers";

const ADMIN_BRAND_PLANS_PATH = "/admin/partners?tab=plans";

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

export async function updatePartnerBrandPlanAction(formData: FormData) {
  const adminSession = await requireAdminPermission("brands", "update", {
    path: "/admin/partners",
  });
  let payload: {
    partnerId: string;
    nextPlanTier: PartnerCompanyPlanTier;
    planStartedAt: string | null;
    planExpiresAt: string | null;
    note: string;
  };
  try {
    const partnerId = getString(formData, "partnerId");
    if (!partnerId) {
      throw new Error("partner_company_plan_invalid_request");
    }
    payload = {
      partnerId,
      nextPlanTier: parsePlanTier(getString(formData, "planTier")),
      planStartedAt: parseNullableKstDate(getString(formData, "planStartedAt")),
      planExpiresAt: parseNullableKstDate(getString(formData, "planExpiresAt"), true),
      note: parseNote(getString(formData, "note")),
    };
  } catch (error) {
    redirectAdminActionError(
      ADMIN_BRAND_PLANS_PATH,
      error instanceof Error ? error.message : "partner_company_plan_invalid_request",
      {
        action: "partner_brand_plan_update",
        targetType: "partner_brand",
        targetId: getString(formData, "partnerId") || null,
        properties: { stage: "parse" },
      },
    );
  }

  try {
    await updatePartnerBrandPlanByAdmin({
      ...payload,
      adminId: adminSession.adminId,
    });
  } catch (error) {
    redirectAdminActionError(
      ADMIN_BRAND_PLANS_PATH,
      error instanceof Error ? error.message : "partner_company_plan_invalid_request",
      {
        action: "partner_brand_plan_update",
        targetType: "partner_brand",
        targetId: payload.partnerId,
        properties: { stage: "service" },
      },
    );
  }

  await logAdminAction("partner_brand_plan_update", {
    targetType: "partner_brand",
    targetId: payload.partnerId,
    properties: {
      planTier: payload.nextPlanTier,
      planStartedAt: payload.planStartedAt,
      planExpiresAt: payload.planExpiresAt,
    },
  });
  revalidatePartnerCompanyData();
  revalidatePartnerPortalPaths();
  redirect(ADMIN_BRAND_PLANS_PATH);
}

function parseTaxDocumentStatus(value: string) {
  if (value === "issued" || value === "pending_issue") {
    return value;
  }
  throw new Error("partner_company_plan_invalid_request");
}

export async function confirmPartnerPlanBankTransferPaymentAction(formData: FormData) {
  const adminSession = await requireAdminPermission("brands", "update", {
    path: "/admin/partners",
  });
  const requestId = getString(formData, "requestId");
  if (!requestId) {
    redirectAdminActionError(ADMIN_BRAND_PLANS_PATH, "partner_company_plan_missing_request", {
      action: "partner_plan_bank_transfer_confirmed",
      targetType: "partner_plan_upgrade_request",
      properties: { stage: "parse" },
    });
  }

  let taxDocumentStatus: "pending_issue" | "issued";
  try {
    taxDocumentStatus = parseTaxDocumentStatus(getString(formData, "taxDocumentStatus"));
  } catch (error) {
    redirectAdminActionError(
      ADMIN_BRAND_PLANS_PATH,
      error instanceof Error ? error.message : "partner_company_plan_invalid_request",
      {
        action: "partner_plan_bank_transfer_confirmed",
        targetType: "partner_plan_upgrade_request",
        targetId: requestId,
        properties: { stage: "tax_document_status" },
      },
    );
  }

  try {
    await confirmPartnerPlanBankTransferPayment({
      requestId,
      adminId: adminSession.adminId,
      taxDocumentStatus,
    });
  } catch (error) {
    redirectAdminActionError(
      ADMIN_BRAND_PLANS_PATH,
      error instanceof Error ? error.message : "partner_company_plan_invalid_request",
      {
        action: "partner_plan_bank_transfer_confirmed",
        targetType: "partner_plan_upgrade_request",
        targetId: requestId,
        properties: { stage: "service", taxDocumentStatus },
      },
    );
  }

  await logAdminAction("partner_plan_bank_transfer_confirmed", {
    targetType: "partner_plan_upgrade_request",
    targetId: requestId,
    properties: {
      taxDocumentStatus,
    },
  });
  revalidatePartnerCompanyData();
  revalidatePartnerPortalPaths();
  redirect(ADMIN_BRAND_PLANS_PATH);
}

async function reviewPartnerPlanRequestAction(
  formData: FormData,
  nextStatus: "approved" | "rejected",
) {
  const adminSession = await requireAdminPermission("brands", "update", {
    path: "/admin/partners",
  });
  const requestId = getString(formData, "requestId");
  if (!requestId) {
    redirectAdminActionError(ADMIN_BRAND_PLANS_PATH, "partner_company_plan_missing_request", {
      action: `partner_plan_upgrade_${nextStatus}`,
      targetType: "partner_plan_upgrade_request",
      properties: { stage: "parse" },
    });
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
        : error instanceof Error && error.message.includes("입금 확인")
          ? "partner_company_plan_payment_unconfirmed"
        : error instanceof Error
          ? error.message
          : "partner_company_plan_invalid_request";
    redirectAdminActionError(ADMIN_BRAND_PLANS_PATH, message, {
      action: `partner_plan_upgrade_${nextStatus}`,
      targetType: "partner_plan_upgrade_request",
      targetId: requestId,
      properties: { stage: "service", status: nextStatus },
    });
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
  redirect(ADMIN_BRAND_PLANS_PATH);
}

export async function approvePartnerPlanUpgradeRequestAction(formData: FormData) {
  return reviewPartnerPlanRequestAction(formData, "approved");
}

export async function rejectPartnerPlanUpgradeRequestAction(formData: FormData) {
  return reviewPartnerPlanRequestAction(formData, "rejected");
}
