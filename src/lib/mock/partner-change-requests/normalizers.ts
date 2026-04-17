import { normalizePartnerAudience } from "../../partner-audience.ts";
import { sanitizeHttpUrl, sanitizePartnerLinkValue } from "../../validation.ts";
import type {
  PartnerChangeRequestSummary,
} from "../../partner-change-requests/shared.ts";
import type {
  MockChangeRequestRecord,
  MockChangeRequestServiceRecord,
} from "./shared.ts";

export function normalizeOptionalText(value?: string | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

export function normalizeRequiredText(value?: string | null) {
  return String(value ?? "").trim();
}

export function normalizeOptionalLink(value?: string | null) {
  return sanitizePartnerLinkValue(value ?? undefined);
}

export function normalizeHttpUrlList(
  values?: Array<string | null | undefined> | null,
) {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values ?? []) {
    const normalized = sanitizeHttpUrl(value ?? undefined);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    next.push(normalized);
  }

  return next;
}

export function normalizeTextList(values?: string[] | null) {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values ?? []) {
    const normalized = String(value ?? "").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    next.push(normalized);
  }

  return next;
}

export function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

export function normalizeAudience(values?: string[] | null) {
  return normalizePartnerAudience(values);
}

export function collectServiceMediaUrls(service?: MockChangeRequestServiceRecord | null) {
  if (!service) {
    return [];
  }
  return normalizeHttpUrlList([service.thumbnail ?? null, ...(service.images ?? [])]);
}

export function normalizeServiceRecord(
  service: Partial<MockChangeRequestServiceRecord> & {
    companyId: string;
    companyName: string;
    companySlug: string;
    partnerId: string;
    partnerName: string;
    partnerLocation: string;
    categoryLabel: string;
  },
): MockChangeRequestServiceRecord {
  return {
    companyId: service.companyId,
    companyName: service.companyName,
    companySlug: service.companySlug,
    partnerId: service.partnerId,
    partnerName: service.partnerName,
    partnerLocation: service.partnerLocation,
    categoryLabel: service.categoryLabel,
    categoryColor: service.categoryColor ?? null,
    visibility: service.visibility ?? "public",
    periodStart: service.periodStart ?? null,
    periodEnd: service.periodEnd ?? null,
    thumbnail: sanitizeHttpUrl(service.thumbnail ?? undefined),
    images: normalizeHttpUrlList(service.images),
    tags: [...(service.tags ?? [])],
    mapUrl: service.mapUrl ?? null,
    reservationLink: normalizeOptionalLink(service.reservationLink),
    inquiryLink: normalizeOptionalLink(service.inquiryLink),
    currentConditions: [...(service.currentConditions ?? [])],
    currentBenefits: [...(service.currentBenefits ?? [])],
    currentAppliesTo: [...(service.currentAppliesTo ?? [])],
  };
}

export function normalizeRequestRecord(
  request: Partial<MockChangeRequestRecord> & {
    id: string;
    companyId: string;
    companyName: string;
    companySlug: string;
    partnerId: string;
    partnerName: string;
    partnerLocation: string;
    categoryLabel: string;
    status: PartnerChangeRequestSummary["status"];
    requestedByAccountId: string;
    requestedByLoginId: string | null;
    requestedByDisplayName: string | null;
    currentPartnerName?: string | null;
    currentPartnerLocation?: string | null;
    currentMapUrl?: string | null;
    currentConditions?: string[] | null;
    currentBenefits?: string[] | null;
    currentAppliesTo?: string[] | null;
    currentTags?: string[] | null;
    currentThumbnail?: string | null;
    currentImages?: string[] | null;
    currentReservationLink?: string | null;
    currentInquiryLink?: string | null;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    requestedPartnerName?: string | null;
    requestedPartnerLocation?: string | null;
    requestedMapUrl?: string | null;
    requestedConditions?: string[] | null;
    requestedBenefits?: string[] | null;
    requestedAppliesTo?: string[] | null;
    requestedTags?: string[] | null;
    requestedThumbnail?: string | null;
    requestedImages?: string[] | null;
    requestedReservationLink?: string | null;
    requestedInquiryLink?: string | null;
    requestedPeriodStart?: string | null;
    requestedPeriodEnd?: string | null;
  },
  service?: MockChangeRequestServiceRecord | null,
): MockChangeRequestRecord {
  const currentPartnerNameSource =
    request.currentPartnerName === undefined
      ? service?.partnerName
      : request.currentPartnerName;
  const currentPartnerLocationSource =
    request.currentPartnerLocation === undefined
      ? service?.partnerLocation
      : request.currentPartnerLocation;
  const currentMapUrlSource =
    request.currentMapUrl === undefined ? service?.mapUrl : request.currentMapUrl;
  const currentConditionsSource =
    request.currentConditions === undefined
      ? service?.currentConditions
      : request.currentConditions;
  const currentBenefitsSource =
    request.currentBenefits === undefined
      ? service?.currentBenefits
      : request.currentBenefits;
  const currentAppliesToSource =
    request.currentAppliesTo === undefined
      ? service?.currentAppliesTo
      : request.currentAppliesTo;
  const currentThumbnailSource =
    request.currentThumbnail === undefined ? service?.thumbnail : request.currentThumbnail;
  const currentImagesSource =
    request.currentImages === undefined ? service?.images : request.currentImages;
  const currentReservationLinkSource =
    request.currentReservationLink === undefined
      ? service?.reservationLink
      : request.currentReservationLink;
  const currentInquiryLinkSource =
    request.currentInquiryLink === undefined
      ? service?.inquiryLink
      : request.currentInquiryLink;
  const currentTagsSource =
    request.currentTags === undefined ? service?.tags : request.currentTags;
  const currentPeriodStartSource =
    request.currentPeriodStart === undefined
      ? service?.periodStart
      : request.currentPeriodStart;
  const currentPeriodEndSource =
    request.currentPeriodEnd === undefined ? service?.periodEnd : request.currentPeriodEnd;
  const requestedThumbnailSource =
    request.requestedThumbnail === undefined
      ? service?.thumbnail
      : request.requestedThumbnail;
  const requestedImagesSource =
    request.requestedImages === undefined ? service?.images : request.requestedImages;
  const requestedReservationLinkSource =
    request.requestedReservationLink === undefined
      ? service?.reservationLink
      : request.requestedReservationLink;
  const requestedInquiryLinkSource =
    request.requestedInquiryLink === undefined
      ? service?.inquiryLink
      : request.requestedInquiryLink;
  const requestedTagsSource =
    request.requestedTags === undefined ? service?.tags : request.requestedTags;
  const requestedPeriodStartSource =
    request.requestedPeriodStart === undefined
      ? service?.periodStart
      : request.requestedPeriodStart;
  const requestedPeriodEndSource =
    request.requestedPeriodEnd === undefined
      ? service?.periodEnd
      : request.requestedPeriodEnd;
  const requestedPartnerNameSource =
    request.requestedPartnerName === undefined
      ? currentPartnerNameSource
      : request.requestedPartnerName;
  const requestedPartnerLocationSource =
    request.requestedPartnerLocation === undefined
      ? currentPartnerLocationSource
      : request.requestedPartnerLocation;
  const requestedMapUrlSource =
    request.requestedMapUrl === undefined ? currentMapUrlSource : request.requestedMapUrl;
  const reviewedByAdminId = request.reviewedByAdminId ?? null;
  const reviewedAt = request.reviewedAt ?? null;
  const cancelledByAccountId = request.cancelledByAccountId ?? null;
  const cancelledAt = request.cancelledAt ?? null;
  const createdAt = request.createdAt ?? new Date().toISOString();
  const updatedAt = request.updatedAt ?? createdAt;

  return {
    ...request,
    partnerName: normalizeRequiredText(
      currentPartnerNameSource || service?.partnerName || request.partnerName,
    ),
    partnerLocation: normalizeRequiredText(
      currentPartnerLocationSource ||
        service?.partnerLocation ||
        request.partnerLocation,
    ),
    currentPartnerName: normalizeRequiredText(
      currentPartnerNameSource || service?.partnerName || request.partnerName,
    ),
    currentPartnerLocation: normalizeRequiredText(
      currentPartnerLocationSource ||
        service?.partnerLocation ||
        request.partnerLocation,
    ),
    currentMapUrl: sanitizeHttpUrl(currentMapUrlSource ?? undefined),
    currentConditions: normalizeTextList(currentConditionsSource),
    currentBenefits: normalizeTextList(currentBenefitsSource),
    currentAppliesTo: normalizeAudience(currentAppliesToSource),
    currentTags: normalizeTextList(currentTagsSource),
    currentThumbnail: sanitizeHttpUrl(currentThumbnailSource ?? undefined),
    currentImages: normalizeHttpUrlList(currentImagesSource),
    currentReservationLink: normalizeOptionalLink(currentReservationLinkSource),
    currentInquiryLink: normalizeOptionalLink(currentInquiryLinkSource),
    currentPeriodStart: normalizeOptionalText(currentPeriodStartSource),
    currentPeriodEnd: normalizeOptionalText(currentPeriodEndSource),
    requestedPartnerName: normalizeRequiredText(
      requestedPartnerNameSource ||
        currentPartnerNameSource ||
        service?.partnerName ||
        request.partnerName,
    ),
    requestedPartnerLocation: normalizeRequiredText(
      requestedPartnerLocationSource ||
        currentPartnerLocationSource ||
        service?.partnerLocation ||
        request.partnerLocation,
    ),
    requestedMapUrl: sanitizeHttpUrl(requestedMapUrlSource ?? undefined),
    requestedConditions: normalizeTextList(request.requestedConditions),
    requestedBenefits: normalizeTextList(request.requestedBenefits),
    requestedAppliesTo: normalizeAudience(request.requestedAppliesTo),
    requestedTags: normalizeTextList(requestedTagsSource),
    requestedThumbnail: sanitizeHttpUrl(requestedThumbnailSource ?? undefined),
    requestedImages: normalizeHttpUrlList(requestedImagesSource),
    requestedReservationLink: normalizeOptionalLink(requestedReservationLinkSource),
    requestedInquiryLink: normalizeOptionalLink(requestedInquiryLinkSource),
    requestedPeriodStart: normalizeOptionalText(requestedPeriodStartSource),
    requestedPeriodEnd: normalizeOptionalText(requestedPeriodEndSource),
    reviewedByAdminId,
    reviewedAt,
    cancelledByAccountId,
    cancelledAt,
    createdAt,
    updatedAt,
  };
}

export function toSummary(request: MockChangeRequestRecord): PartnerChangeRequestSummary {
  return {
    ...request,
    currentConditions: normalizeTextList(request.currentConditions),
    currentBenefits: normalizeTextList(request.currentBenefits),
    currentAppliesTo: normalizeAudience(request.currentAppliesTo),
    currentTags: normalizeTextList(request.currentTags),
    requestedTags: normalizeTextList(request.requestedTags),
    requestedConditions: normalizeTextList(request.requestedConditions),
    requestedBenefits: normalizeTextList(request.requestedBenefits),
    requestedAppliesTo: normalizeAudience(request.requestedAppliesTo),
  };
}
