"use server";

import { redirect } from "next/navigation";
import { getServerActionLogContext, logAdminAudit } from "@/lib/activity-logs";
import { deletePartnerMediaUrls } from "@/lib/partner-media-storage";
import { getPartnerSession } from "@/lib/partner-session";
import { PartnerChangeRequestError } from "@/lib/partner-change-request-errors";
import {
  getPartnerChangeRequestContext,
  updatePartnerImmediateFields,
} from "@/lib/partner-change-requests";
import { sanitizePartnerLinkValue } from "@/lib/validation";
import { resolvePartnerMediaPayload } from "./media";
import { getReturnUrl, parseList, revalidatePartnerServicePaths } from "./shared";

export async function savePartnerImmediateChangesAction(formData: FormData) {
  const session = await getPartnerSession();
  if (!session) {
    redirect("/partner/login");
  }
  if (session.mustChangePassword) {
    redirect("/partner/change-password");
  }

  const partnerId = String(formData.get("partnerId") || "").trim();
  if (!partnerId) {
    redirect("/partner?error=invalid_request");
  }

  const context = await getPartnerChangeRequestContext(session.companyIds, partnerId);
  if (!context) {
    redirect(`${getReturnUrl(partnerId)}?mode=edit&error=forbidden`);
  }

  const tags = parseList(String(formData.get("tags") || ""));
  const rawReservationLink = String(formData.get("reservationLink") || "").trim();
  const rawInquiryLink = String(formData.get("inquiryLink") || "").trim();
  let media = null;

  try {
    const reservationLink = rawReservationLink
      ? sanitizePartnerLinkValue(rawReservationLink)
      : null;
    if (rawReservationLink && !reservationLink) {
      throw new PartnerChangeRequestError(
        "invalid_request",
        "예약 링크 형식을 확인해 주세요.",
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

    media = await resolvePartnerMediaPayload(formData, partnerId);

    const result = await updatePartnerImmediateFields({
      companyIds: session.companyIds,
      partnerId,
      thumbnail: media.thumbnail,
      images: media.images,
      tags,
      reservationLink,
      inquiryLink,
    });

    await deletePartnerMediaUrls(
      result.previousMediaUrls.filter(
        (url) => !result.currentMediaUrls.includes(url),
      ),
    ).catch(() => undefined);

    await logAdminAudit({
      ...(await getServerActionLogContext(getReturnUrl(partnerId))),
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
        reservationLinkChanged: context.reservationLink !== reservationLink,
        inquiryLinkChanged: context.inquiryLink !== inquiryLink,
      },
    });
  } catch (error) {
    if (media) {
      await deletePartnerMediaUrls(media.uploadedUrls).catch(() => undefined);
    }
    if (error instanceof PartnerChangeRequestError) {
      redirect(`${getReturnUrl(partnerId)}?mode=edit&error=${error.code}`);
    }
    throw error;
  }

  revalidatePartnerServicePaths(partnerId);
  redirect(`${getReturnUrl(partnerId)}?mode=edit&success=saved`);
}
