"use server";

import { redirect } from "next/navigation";
import {
  cancelPartnerPlanUpgradeRequest,
  createPartnerPlanUpgradeRequest,
} from "@/lib/partner-plan-service";
import { getPartnerSession } from "@/lib/partner-session";

const PARTNER_PLANS_PATH = "/partner/plans";

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectPartnerPlans(status: "requested" | "cancelled") {
  redirect(`${PARTNER_PLANS_PATH}?status=${status}`);
}

function redirectPartnerPlanError(error: unknown): never {
  const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
  redirect(`${PARTNER_PLANS_PATH}?error=${encodeURIComponent(message)}`);
}

export async function requestPartnerPlanUpgradeAction(formData: FormData) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const partnerId = getString(formData, "partnerId");
  if (!partnerId) {
    redirectPartnerPlanError(new Error("브랜드 접근 권한이 없습니다."));
  }

  try {
    await createPartnerPlanUpgradeRequest({
      partnerId,
      accountId: session.accountId,
      requestedPlanTier: getString(formData, "requestedPlanTier"),
      paymentAmountKrw: getString(formData, "paymentAmountKrw"),
      payerName: getString(formData, "payerName"),
      memo: getString(formData, "memo"),
    });
  } catch (error) {
    redirectPartnerPlanError(error);
  }

  redirectPartnerPlans("requested");
}

export async function cancelPartnerPlanUpgradeRequestAction(formData: FormData) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const requestId = getString(formData, "requestId");
  if (!requestId) {
    redirectPartnerPlanError(new Error("업그레이드 요청을 찾을 수 없습니다."));
  }

  try {
    await cancelPartnerPlanUpgradeRequest({
      requestId,
      accountId: session.accountId,
    });
  } catch (error) {
    redirectPartnerPlanError(error);
  }

  redirectPartnerPlans("cancelled");
}
