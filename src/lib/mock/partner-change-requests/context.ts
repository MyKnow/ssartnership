import type { PartnerChangeRequestContext } from "../../partner-change-requests/shared.ts";
import { findPendingRequest, findService, getStore } from "./service-store.ts";
import { normalizeServiceRecord, toSummary } from "./normalizers.ts";

export async function listMockPartnerChangeRequests(
  companyIds?: string[],
) {
  const uniqueCompanyIds = [...new Set((companyIds ?? []).map((id) => id.trim()).filter(Boolean))];
  return getStore()
    .requests.filter((request) =>
      request.status === "pending" &&
      (uniqueCompanyIds.length === 0 || uniqueCompanyIds.includes(request.companyId)),
    )
    .map(toSummary)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getMockPartnerChangeRequestContext(
  companyIds: string[],
  partnerId: string,
): Promise<PartnerChangeRequestContext | null> {
  const uniqueCompanyIds = [...new Set(companyIds.map((id) => id.trim()).filter(Boolean))];
  const service = findService(partnerId);
  if (!service || !uniqueCompanyIds.includes(service.companyId)) {
    return null;
  }

  const pendingRequest = findPendingRequest(partnerId);
  const normalizedService = normalizeServiceRecord(service);
  return {
    companyId: normalizedService.companyId,
    companyName: normalizedService.companyName,
    companySlug: normalizedService.companySlug,
    partnerId: normalizedService.partnerId,
    partnerName: normalizedService.partnerName,
    partnerLocation: normalizedService.partnerLocation,
    partnerCreatedAt: normalizedService.partnerCreatedAt,
    categoryLabel: normalizedService.categoryLabel,
    categoryColor: normalizedService.categoryColor,
    visibility: normalizedService.visibility,
    periodStart: normalizedService.periodStart,
    periodEnd: normalizedService.periodEnd,
    thumbnail: normalizedService.thumbnail,
    images: [...normalizedService.images],
    tags: [...normalizedService.tags],
    mapUrl: normalizedService.mapUrl,
    reservationLink: normalizedService.reservationLink,
    inquiryLink: normalizedService.inquiryLink,
    currentConditions: [...normalizedService.currentConditions],
    currentBenefits: [...normalizedService.currentBenefits],
    currentAppliesTo: [...normalizedService.currentAppliesTo],
    currentCampusSlugs: [...normalizedService.currentCampusSlugs],
    currentTags: [...normalizedService.tags],
    currentThumbnail: normalizedService.thumbnail,
    currentImages: [...normalizedService.images],
    currentReservationLink: normalizedService.reservationLink,
    currentInquiryLink: normalizedService.inquiryLink,
    currentPeriodStart: normalizedService.periodStart,
    currentPeriodEnd: normalizedService.periodEnd,
    pendingRequest: pendingRequest ? toSummary(pendingRequest) : null,
  };
}
