import type { CategoryKey, Partner } from "../../lib/types.ts";
import {
  getBenefitUseAction,
  getInquiryAction,
  getMapLink,
  normalizeBenefitUseInquiry,
} from "../../lib/partner-links.ts";
import { getPartnerLockKind } from "../../lib/partner-visibility.ts";
import { isWithinPeriod } from "../../lib/partner-utils.ts";

export function withAlpha(color: string, alphaHex: string) {
  if (!color.startsWith("#") || color.length !== 7) {
    return color;
  }
  return `${color}${alphaHex}`;
}

export function createCategoryAccentStyles(categoryColor?: string) {
  return {
    badgeStyle: categoryColor
      ? {
          backgroundColor: withAlpha(categoryColor, "1f"),
          color: categoryColor,
        }
      : undefined,
    chipStyle: categoryColor
      ? {
          backgroundColor: withAlpha(categoryColor, "14"),
          borderColor: withAlpha(categoryColor, "55"),
          color: categoryColor,
        }
      : undefined,
  };
}

export function createPartnerCardPresentation(
  partner: Partner,
  viewerAuthenticated: boolean,
) {
  const lockKind = getPartnerLockKind(partner.visibility, viewerAuthenticated);
  const thumbnailUrl =
    partner.thumbnail ?? (partner.images && partner.images.length > 0 ? partner.images[0] : "");
  const isActive = isWithinPeriod(partner.period.start, partner.period.end);
  const normalizedLinks = isActive
    ? normalizeBenefitUseInquiry({
        benefitActionType: partner.benefitActionType,
        benefitActionLink: partner.benefitActionLink,
        reservationLink: partner.reservationLink,
        inquiryLink: partner.inquiryLink,
      })
    : {
        benefitActionType: "none" as const,
        benefitActionLink: "",
        reservationLink: "",
        inquiryLink: "",
      };

  return {
    lockKind,
    thumbnailUrl,
    isActive,
    reservationAction: isActive
      ? getBenefitUseAction({
          actionType: normalizedLinks.benefitActionType,
          actionLink: normalizedLinks.benefitActionLink,
          legacyReservationLink: normalizedLinks.reservationLink,
          accessStatus: partner.benefitAccessStatus,
        })
      : null,
    inquiryAction: isActive
      ? getInquiryAction(normalizedLinks.inquiryLink)
      : null,
    mapLink: getMapLink(
      partner.mapUrl,
      partner.location,
      partner.name,
    ),
    detailHref: partner.id ? `/partners/${encodeURIComponent(partner.id)}` : "",
  };
}

export function buildPartnerCardTrackingProperties(partner: Partner) {
  return {
    categoryKey: partner.category as CategoryKey,
  };
}
