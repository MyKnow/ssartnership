import { getCachedImageUrl } from "../../../lib/image-cache.ts";
import {
  getContactDisplay,
  getMapLink,
  normalizeReservationInquiry,
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
    ? normalizeReservationInquiry(
        context.reservationLink ?? undefined,
        context.inquiryLink ?? undefined,
      )
    : { reservationLink: "", inquiryLink: "" };
  const reservationDisplay = isActive
    ? getContactDisplay(normalizedLinks.reservationLink)
    : null;
  const inquiryDisplay = isActive ? getContactDisplay(normalizedLinks.inquiryLink) : null;

  return {
    isActive,
    badgeStyle,
    chipStyle,
    thumbnailUrl,
    mapLink,
    normalizedLinks,
    reservationDisplay,
    inquiryDisplay,
    contactCount: [reservationDisplay, inquiryDisplay].filter(Boolean).length,
  };
}
