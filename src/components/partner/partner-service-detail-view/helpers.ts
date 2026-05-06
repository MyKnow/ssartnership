import { getCachedImageUrl } from "../../../lib/image-cache.ts";
import {
  getBenefitUseAction,
  getContactDisplay,
  getMapLink,
  normalizeBenefitUseInquiry,
} from "../../../lib/partner-links.ts";
import { isWithinPeriod } from "../../../lib/partner-utils.ts";
import type { PartnerChangeRequestContext } from "../../../lib/partner-change-requests.ts";

export function withAlpha(color: string, alphaHex: string) {
  if (!color.startsWith("#") || color.length !== 7) {
    return color;
  }
  return `${color}${alphaHex}`;
}

export function getPartnerServiceVisualState(context: PartnerChangeRequestContext) {
  const isActive = isWithinPeriod(context.periodStart, context.periodEnd);
  const badgeStyle = context.categoryColor
    ? {
        backgroundColor: withAlpha(context.categoryColor, "1f"),
        color: context.categoryColor,
      }
    : undefined;
  const chipStyle = context.categoryColor
    ? {
        backgroundColor: withAlpha(context.categoryColor, "14"),
        borderColor: withAlpha(context.categoryColor, "55"),
        color: context.categoryColor,
      }
    : undefined;
  const thumbnailUrl = context.thumbnail ? getCachedImageUrl(context.thumbnail) : "";
  const mapLink = getMapLink(
    context.mapUrl ?? undefined,
    context.partnerLocation,
    context.partnerName,
  );
  const normalizedLinks = isActive
    ? normalizeBenefitUseInquiry({
        benefitActionType: context.benefitActionType,
        benefitActionLink: context.benefitActionLink,
        reservationLink: context.reservationLink,
        inquiryLink: context.inquiryLink,
      })
    : {
        benefitActionType: "none",
        benefitActionLink: "",
        reservationLink: "",
        inquiryLink: "",
      };
  const benefitUseAction = isActive
    ? getBenefitUseAction({
        actionType: normalizedLinks.benefitActionType,
        actionLink: normalizedLinks.benefitActionLink,
        legacyReservationLink: normalizedLinks.reservationLink,
      })
    : null;
  const inquiryDisplay = isActive ? getContactDisplay(normalizedLinks.inquiryLink) : null;

  return {
    isActive,
    badgeStyle,
    chipStyle,
    thumbnailUrl,
    mapLink,
    normalizedLinks,
    benefitUseAction,
    reservationDisplay: benefitUseAction,
    inquiryDisplay,
    contactCount: [benefitUseAction, inquiryDisplay].filter(Boolean).length,
  };
}
