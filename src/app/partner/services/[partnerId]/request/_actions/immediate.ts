"use server";

import { redirect } from "next/navigation";
import { getServerActionLogContext, logAdminAudit } from "@/lib/activity-logs";
import { deletePartnerMediaUrls } from "@/lib/partner-media-storage";
import { getPartnerSession } from "@/lib/partner-session";
import { PartnerChangeRequestError } from "@/lib/partner-change-request-errors";
import {
  isPartnerBenefitActionType,
  normalizePartnerBenefitActionType,
  resolveSubmittedBenefitActionLink,
} from "@/lib/partner-benefit-action";
import {
  getPartnerChangeRequestContext,
  updatePartnerImmediateFields,
} from "@/lib/partner-change-requests";
import { createAdminOperationalNotification } from "@/lib/operational-notifications";
import { sanitizePartnerLinkValue } from "@/lib/validation";
import { resolvePartnerMediaPayload } from "./media";
import {
  getAuthorizedCompanyIdsForPartnerAction,
  getReturnUrl,
  parseList,
  revalidatePartnerServicePaths,
} from "./shared";

export async function savePartnerImmediateChangesAction(formData: FormData) {
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

  const context = await getPartnerChangeRequestContext(companyIds, partnerId);
  if (!context) {
    redirect(`${getReturnUrl(partnerId, companyId)}?mode=edit&error=forbidden`);
  }

  const tags = parseList(String(formData.get("tags") || ""));
  const rawBenefitActionType = String(formData.get("benefitActionType") || "").trim();
  const rawBenefitActionLink = String(formData.get("benefitActionLink") || "").trim();
  const rawReservationLink = String(formData.get("reservationLink") || "").trim();
  const submittedBenefitActionLink = resolveSubmittedBenefitActionLink({
    hasBenefitActionLinkField: formData.has("benefitActionLink"),
    benefitActionLink: rawBenefitActionLink,
    reservationLink: rawReservationLink,
  });
  const rawInquiryLink = String(formData.get("inquiryLink") || "").trim();
  let media = null;

  try {
    if (rawBenefitActionType && !isPartnerBenefitActionType(rawBenefitActionType)) {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "혜택 이용 방식을 확인해 주세요.",
      );
    }
    const benefitActionType = normalizePartnerBenefitActionType(
      rawBenefitActionType,
      submittedBenefitActionLink ? "external_link" : "none",
    );
    const parsedBenefitActionLink = submittedBenefitActionLink
      ? sanitizePartnerLinkValue(submittedBenefitActionLink)
      : null;
    if (benefitActionType === "external_link" && !parsedBenefitActionLink) {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "혜택 이용 링크 형식을 확인해 주세요.",
      );
    }
    const benefitActionLink =
      benefitActionType === "external_link" ? parsedBenefitActionLink : null;
    const reservationLink = benefitActionLink;

    const inquiryLink = rawInquiryLink
      ? sanitizePartnerLinkValue(rawInquiryLink)
      : null;
    if (rawInquiryLink && !inquiryLink) {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "문의 링크 형식을 확인해 주세요.",
      );
    }

    media = await resolvePartnerMediaPayload(formData, partnerId);

    const result = await updatePartnerImmediateFields({
      companyIds,
      partnerId,
      thumbnail: media.thumbnail,
      images: media.images,
      tags,
      benefitActionType,
      benefitActionLink,
      reservationLink,
      inquiryLink,
    });

    await deletePartnerMediaUrls(
      result.previousMediaUrls.filter(
        (url) => !result.currentMediaUrls.includes(url),
      ),
    ).catch(() => undefined);

    await logAdminAudit({
      ...(await getServerActionLogContext(getReturnUrl(partnerId, companyId))),
      actorId: session.accountId,
      action: "partner_portal_immediate_update",
      targetType: "partner",
      targetId: partnerId,
      properties: {
        partnerId,
        companyId: result.companyId,
        companyIds: session.companyIds,
        actorLoginId: session.loginId,
        actorDisplayName: session.displayName,
        tagCount: tags.length,
        imageCount: media.images.length,
        thumbnailChanged: context.thumbnail !== media.thumbnail,
        benefitActionTypeChanged: context.benefitActionType !== benefitActionType,
        benefitActionLinkChanged: context.benefitActionLink !== benefitActionLink,
        reservationLinkChanged: context.reservationLink !== reservationLink,
        inquiryLinkChanged: context.inquiryLink !== inquiryLink,
      },
    });
    await createAdminOperationalNotification({
      type: "partner_immediate_update",
      title: "파트너 즉시 수정 반영",
      body: `${context.companyName} · ${context.partnerName} 기본 정보가 수정되었습니다.`,
      targetUrl: `/admin/partners/${encodeURIComponent(partnerId)}`,
      metadata: {
        partnerId,
        partnerName: context.partnerName,
        companyId: result.companyId,
        companyName: context.companyName,
        actorAccountId: session.accountId,
        tagCount: tags.length,
        imageCount: media.images.length,
      },
    }).catch((notificationError) => {
      console.error(
        "[partner-immediate-update] admin notification failed",
        notificationError,
      );
    });
  } catch (error) {
    if (media) {
      await deletePartnerMediaUrls(media.uploadedUrls).catch(() => undefined);
    }
    if (error instanceof PartnerChangeRequestError) {
      redirect(`${getReturnUrl(partnerId, companyId)}?mode=edit&error=${error.code}`);
    }
    throw error;
  }

  revalidatePartnerServicePaths(partnerId, companyId);
  redirect(`${getReturnUrl(partnerId, companyId)}?mode=edit&success=saved`);
}
