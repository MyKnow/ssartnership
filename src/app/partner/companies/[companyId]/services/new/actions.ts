"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  getServerActionLogContext,
  scheduleProductEventLog,
} from "@/lib/activity-logs";
import {
  hasPartnerRegistrationFieldErrors,
  PARTNER_REGISTRATION_INITIAL_ACTION_STATE,
  validatePartnerRegistrationInput,
  type PartnerRegistrationActionState,
} from "@/lib/partner-registration";
import {
  getCompanyScopedPortalHref,
} from "@/lib/partner-portal-paths";
import { assertPartnerPortalCompanyAccess } from "@/lib/partner-portal-scope";
import { getPartnerSession } from "@/lib/partner-session";
import {
  insertPartnerRegistrationRequest,
  loadPartnerRegistrationCategories,
  resolvePartnerRegistrationBranchPayload,
  resolvePartnerRegistrationMediaPayload,
} from "@/lib/partner-registration-submit.server";

export async function createPartnerPortalBrandRegistrationRequestAction(
  _prevState: PartnerRegistrationActionState = PARTNER_REGISTRATION_INITIAL_ACTION_STATE,
  formData: FormData,
): Promise<PartnerRegistrationActionState> {
  void _prevState;
  const session = await getPartnerSession();
  if (!session) {
    return {
      status: "error",
      message: "로그인 후 다시 시도해 주세요.",
    };
  }

  const companyId = String(formData.get("companyId") || "").trim();
  const scope = await assertPartnerPortalCompanyAccess(session, companyId);
  if (!scope) {
    return {
      status: "error",
      message: "선택한 파트너사로 제휴처를 추가할 권한이 없습니다.",
    };
  }

  const validation = validatePartnerRegistrationInput(formData);
  if (hasPartnerRegistrationFieldErrors(validation.fieldErrors)) {
    return {
      status: "error",
      message: "입력값을 확인해 주세요.",
      fieldErrors: validation.fieldErrors,
    };
  }

  let categories;
  try {
    categories = await loadPartnerRegistrationCategories();
  } catch {
    return {
      status: "error",
      message: "카테고리 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  const requestId = randomUUID();
  let insertedRequest;
  try {
    const media = await resolvePartnerRegistrationMediaPayload(formData, requestId);
    const branches = await resolvePartnerRegistrationBranchPayload(
      formData,
      validation.values,
    );
    insertedRequest = await insertPartnerRegistrationRequest({
      requestId,
      values: validation.values,
      categories,
      context: {
        source: "partner_portal",
        companyId: scope.id,
        requestedByPartnerAccountId: session.accountId,
      },
      media,
      branches,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "제휴처 추가 신청을 저장하지 못했습니다.";
    console.error("[partner-portal:brand-registration] insert failed", message);
    return {
      status: "error",
      message,
      fieldErrors: message.includes("지점") ? { branchListText: message } : undefined,
    };
  }

  scheduleProductEventLog({
    ...(await getServerActionLogContext(getCompanyScopedPortalHref(scope.id))),
    eventName: "partner_portal_brand_registration_submit",
    actorType: "partner",
    actorId: session.accountId,
    targetType: "partner_registration_request",
    targetId: insertedRequest.requestId,
    properties: {
      source: "partner_portal",
      companyId: scope.id,
      companyName: scope.name,
      brandName: validation.values.brandName,
      categoryLabel: insertedRequest.categoryLabel,
      categoryMatched: insertedRequest.categoryMatched,
    },
  });

  revalidatePath("/admin/partner-registrations");
  revalidatePath(getCompanyScopedPortalHref(scope.id));

  return {
    status: "success",
    message: "제휴처 추가 신청이 접수되었습니다. 관리자가 확인 후 반영합니다.",
    requestId: insertedRequest.requestId,
  };
}
