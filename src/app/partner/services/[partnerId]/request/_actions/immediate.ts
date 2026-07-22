"use server";

import { redirect } from "next/navigation";
import { createServerActionAuditContext } from "@/lib/audit-context";
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
import { normalizePartnerBenefitUseMaxCount } from "@/lib/partner-benefit-usage";
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
  const rawBenefitUseMaxCount = String(
    formData.get("benefitUseMaxCount") || "",
  ).trim();
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
    const benefitUseMaxCount =
      benefitActionType === "certification"
        ? rawBenefitUseMaxCount
          ? normalizePartnerBenefitUseMaxCount(rawBenefitUseMaxCount)
          : null
        : null;
    if (
      benefitActionType === "certification" &&
      rawBenefitUseMaxCount &&
      benefitUseMaxCount === null
    ) {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "제휴 적용 최대 횟수는 1회 이상의 정수로 입력해 주세요.",
      );
    }

    const inquiryLink = rawInquiryLink
      ? sanitizePartnerLinkValue(rawInquiryLink)
      : null;
    if (rawInquiryLink && !inquiryLink) {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "문의 링크 형식을 확인해 주세요.",
      );
    }

    media = await resolvePartnerMediaPayload(
      formData,
      partnerId,
      [context.thumbnail, ...context.images].filter(
        (url): url is string => Boolean(url),
      ),
    );

    const result = await updatePartnerImmediateFields({
      companyIds,
      partnerId,
      auditContext: await createServerActionAuditContext(
        { actorType: "partner", actorId: session.accountId },
        getReturnUrl(partnerId, companyId),
      ),
      thumbnail: media.thumbnail,
      images: media.images,
      tags,
      benefitActionType,
      benefitActionLink,
      benefitUseMaxCount,
      reservationLink,
      inquiryLink,
    });

    await deletePartnerMediaUrls(
      result.previousMediaUrls.filter(
        (url) => !result.currentMediaUrls.includes(url),
      ),
    ).catch(() => undefined);

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
      templateContext: {
        kind: "admin_partner_immediate_update",
        companyName: context.companyName,
        partnerName: context.partnerName,
        changeSummary: `기본 정보·혜택·태그·이미지 변경 (${tags.length}개 태그, ${media.images.length}개 이미지)`,
        updatedByName: session.displayName || session.loginId,
        partnerUrl: `/admin/partners/${encodeURIComponent(partnerId)}`,
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
