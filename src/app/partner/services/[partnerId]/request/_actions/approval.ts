"use server";

import { redirect } from "next/navigation";
import { getServerActionLogContext, logAdminAudit } from "@/lib/activity-logs";
import { getPartnerSession } from "@/lib/partner-session";
import { validateFormCampusSlugSelection } from "@/lib/campuses";
import { parsePartnerAudienceSelection } from "@/lib/partner-audience";
import {
  createPartnerChangeRequest,
  getPartnerChangeRequestContext,
} from "@/lib/partner-change-requests";
import { createAdminOperationalNotification } from "@/lib/operational-notifications";
import { PartnerChangeRequestError } from "@/lib/partner-change-request-errors";
import { normalizePartnerDetailDescription } from "@/lib/partner-detail-description";
import { sanitizeHttpUrl, validateDateRange } from "@/lib/validation";
import {
  getAuthorizedCompanyIdsForPartnerAction,
  getReturnUrl,
  parseList,
  revalidatePartnerServicePaths,
} from "./shared";

export async function submitPartnerChangeRequestAction(formData: FormData) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const partnerId = String(formData.get("partnerId") || "").trim();
  const { companyId, companyIds } = getAuthorizedCompanyIdsForPartnerAction(
    session,
    formData,
  );
  if (!partnerId) {
    redirect("/partner?error=invalid_request");
  }

  const partnerName = String(formData.get("partnerName") || "").trim();
  const partnerLocation = String(formData.get("partnerLocation") || "").trim();
  const rawDetailDescription = formData.get("detailDescription");
  const rawMapUrl = String(formData.get("mapUrl") || "").trim();
  const conditions = parseList(String(formData.get("conditions") || ""));
  const benefits = parseList(String(formData.get("benefits") || ""));
  const campusSlugSelection = validateFormCampusSlugSelection(
    formData.getAll("campusSlugs").map((item) => String(item).trim()),
    partnerLocation,
  );
  const campusSlugs = campusSlugSelection.campusSlugs;
  const appliesTo = parsePartnerAudienceSelection(
    formData.getAll("appliesTo").map((item) => String(item).trim()),
  );
  const periodStart = String(formData.get("periodStart") || "").trim();
  const periodEnd = String(formData.get("periodEnd") || "").trim();

  if (!appliesTo) {
    redirect(`${getReturnUrl(partnerId, companyId)}?mode=edit&error=invalid_request`);
  }

  try {
    if (!partnerName || !partnerLocation) {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "제휴처명과 위치를 입력해 주세요.",
      );
    }
    let detailDescription: string | null = null;
    try {
      detailDescription = normalizePartnerDetailDescription(rawDetailDescription);
    } catch {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "상세 설명은 1,200자 이내로 입력해 주세요.",
      );
    }
    if (!campusSlugSelection.ok) {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "노출 캠퍼스를 하나 이상 선택해 주세요.",
      );
    }

    const dateRangeError = validateDateRange(periodStart, periodEnd);
    if (dateRangeError) {
      throw new PartnerChangeRequestError("invalid_request", dateRangeError);
    }

    const mapUrl = rawMapUrl ? sanitizeHttpUrl(rawMapUrl) : null;
    if (rawMapUrl && !mapUrl) {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "지도 URL 형식을 확인해 주세요.",
      );
    }

    const context = await getPartnerChangeRequestContext(companyIds, partnerId);
    if (!context) {
      redirect(`${getReturnUrl(partnerId, companyId)}?mode=edit&error=forbidden`);
    }

    const request = await createPartnerChangeRequest({
      companyIds,
      partnerId,
      requestedByAccountId: session.accountId,
      requestedByLoginId: session.loginId,
      requestedByDisplayName: session.displayName,
      requestedPartnerName: partnerName,
      requestedPartnerLocation: partnerLocation,
      requestedDetailDescription: detailDescription,
      requestedMapUrl: mapUrl,
      requestedCampusSlugs: campusSlugs,
      requestedConditions: conditions,
      requestedBenefits: benefits,
      requestedTags: context.tags,
      requestedAppliesTo: appliesTo,
      requestedThumbnail: context.thumbnail,
      requestedImages: context.images,
      requestedReservationLink: context.reservationLink,
      requestedInquiryLink: context.inquiryLink,
      requestedPeriodStart: periodStart || null,
      requestedPeriodEnd: periodEnd || null,
    });

    await logAdminAudit({
      ...(await getServerActionLogContext(getReturnUrl(partnerId, companyId))),
      actorId: session.accountId,
      action: "partner_portal_change_request_submit",
      targetType: "partner",
      targetId: partnerId,
      properties: {
        requestId: request.id,
        partnerId,
        partnerName: request.partnerName,
        companyId: request.companyId,
        companyIds: session.companyIds,
        actorLoginId: session.loginId,
        actorDisplayName: session.displayName,
      },
    });
    await createAdminOperationalNotification({
      type: "partner_change_request",
      title: "파트너 변경 요청 접수",
      body: `${request.companyName} · ${request.partnerName} 변경 요청이 접수되었습니다.`,
      targetUrl: "/admin/partner-requests",
      metadata: {
        requestId: request.id,
        partnerId,
        partnerName: request.partnerName,
        companyId: request.companyId,
        companyName: request.companyName,
        actorAccountId: session.accountId,
      },
      templateContext: {
        kind: "admin_partner_change_request",
        companyName: request.companyName,
        partnerName: request.partnerName,
        requesterName: session.displayName || session.loginId,
        changeSummary: "파트너 정보 변경 요청",
        requestUrl: "/admin/partner-requests",
      },
    }).catch((notificationError) => {
      console.error(
        "[partner-change-request] admin notification failed",
        notificationError,
      );
    });
  } catch (error) {
    if (error instanceof PartnerChangeRequestError) {
      redirect(`${getReturnUrl(partnerId, companyId)}?mode=edit&error=${error.code}`);
    }
    throw error;
  }

  revalidatePartnerServicePaths(partnerId, companyId);
  redirect(`${getReturnUrl(partnerId, companyId)}?mode=edit&success=submitted`);
}
