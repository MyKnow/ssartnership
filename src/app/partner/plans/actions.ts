"use server";

import { redirect } from "next/navigation";
import {
  cancelPartnerPlanUpgradeRequest,
  createPartnerPlanUpgradeRequest,
} from "@/lib/partner-plan-service";
import {
  getCompanyScopedPortalHref,
} from "@/lib/partner-portal-paths";
import { isPartnerPortalCompanyAllowed } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";

const PARTNER_PLANS_PATH = "/partner/plans";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getPartnerPlansPath(companyId: string) {
  return companyId
    ? getCompanyScopedPortalHref(companyId, "plans")
    : PARTNER_PLANS_PATH;
}

function redirectPartnerPlans(companyId: string, status: "requested" | "cancelled") {
  redirect(`${getPartnerPlansPath(companyId)}?status=${status}`);
}

function redirectPartnerPlanError(companyId: string, error: unknown): never {
  const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
  redirect(`${getPartnerPlansPath(companyId)}?error=${encodeURIComponent(message)}`);
}

function readAuthorizedCompanyId(formData: FormData, session: NonNullable<Awaited<ReturnType<typeof getPartnerSession>>>) {
  const companyId = getString(formData, "companyId");
  if (!companyId || !isPartnerPortalCompanyAllowed(session, companyId)) {
    redirectPartnerPlanError("", new Error("협력사 접근 권한이 없습니다."));
  }
  return companyId;
}

export async function requestPartnerPlanUpgradeAction(formData: FormData) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const companyId = readAuthorizedCompanyId(formData, session);
  const partnerId = getString(formData, "partnerId");
  if (!partnerId) {
    redirectPartnerPlanError(companyId, new Error("브랜드 접근 권한이 없습니다."));
  }

  try {
    await createPartnerPlanUpgradeRequest({
      partnerId,
      companyId,
      accountId: session.accountId,
      requestedPlanTier: getString(formData, "requestedPlanTier"),
      payerName: getString(formData, "payerName"),
      memo: getString(formData, "memo"),
      billingProfile: {
        businessRegistrationNumber: getString(formData, "businessRegistrationNumber"),
        businessName: getString(formData, "businessName"),
        representativeName: getString(formData, "representativeName"),
        businessAddress: getString(formData, "businessAddress"),
        businessType: getString(formData, "businessType"),
        businessItem: getString(formData, "businessItem"),
        taxInvoiceEmail: getString(formData, "taxInvoiceEmail"),
      },
    });
  } catch (error) {
    redirectPartnerPlanError(companyId, error);
  }

  redirectPartnerPlans(companyId, "requested");
}

export async function cancelPartnerPlanUpgradeRequestAction(formData: FormData) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const companyId = readAuthorizedCompanyId(formData, session);
  const requestId = getString(formData, "requestId");
  if (!requestId) {
    redirectPartnerPlanError(companyId, new Error("업그레이드 요청을 찾을 수 없습니다."));
  }

  try {
    await cancelPartnerPlanUpgradeRequest({
      requestId,
      accountId: session.accountId,
      companyId,
    });
  } catch (error) {
    redirectPartnerPlanError(companyId, error);
  }

  redirectPartnerPlans(companyId, "cancelled");
}
