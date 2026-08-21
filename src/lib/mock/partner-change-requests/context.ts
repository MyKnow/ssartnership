import type {
  PartnerChangeRequestContext,
  PartnerChangeRequestListInput,
  PartnerChangeRequestPage,
} from "../../partner-change-requests/shared.ts";
import { findPendingRequest, findService, getStore } from "./service-store.ts";
import { normalizeServiceRecord, toSummary } from "./normalizers.ts";
import { normalizePartnerBenefitItems } from "../../partner-benefit-items.ts";

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
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listMockPartnerChangeRequestPage(
  input: PartnerChangeRequestListInput,
): Promise<PartnerChangeRequestPage> {
  const partnerIds = new Set(
    (input.partnerIds ?? []).map((id) => id.trim()).filter(Boolean),
  );
  const allRequests = await listMockPartnerChangeRequests(input.companyIds);
  const scopedRequests = input.partnerIds === undefined
    ? allRequests
    : allRequests.filter((request) => partnerIds.has(request.partnerId));
  const page = Math.max(1, input.page);
  const pageSize = Math.max(1, input.pageSize);
  const from = (page - 1) * pageSize;

  return {
    requests: scopedRequests.slice(from, from + pageSize),
    totalCount: scopedRequests.length,
    page,
    pageSize,
  };
}

export async function getMockPartnerChangeRequestContext(
  companyIds: string[],
  partnerId: string,
  accountId?: string,
): Promise<PartnerChangeRequestContext | null> {
  const uniqueCompanyIds = [...new Set(companyIds.map((id) => id.trim()).filter(Boolean))];
  const service = findService(partnerId);
  if (!service || !uniqueCompanyIds.includes(service.companyId)) {
    return null;
  }

  const pendingRequest = findPendingRequest(partnerId);
  const requestHistory = getStore()
    .requests.filter(
      (request) =>
        request.partnerId === partnerId &&
        (!accountId || request.requestedByAccountId === accountId),
    )
    .map(toSummary)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const normalizedService = normalizeServiceRecord(service);
  return {
    companyId: normalizedService.companyId,
    companyName: normalizedService.companyName,
    companySlug: normalizedService.companySlug,
    brandPlanTier: normalizedService.brandPlanTier,
    partnerId: normalizedService.partnerId,
    partnerName: normalizedService.partnerName,
    partnerLocation: normalizedService.partnerLocation,
    detailDescription: normalizedService.detailDescription,
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
    benefitActionType: normalizedService.benefitActionType,
    benefitActionLink: normalizedService.benefitActionLink,
    benefitItems: normalizedService.benefitItems ?? normalizePartnerBenefitItems(
      normalizedService.currentBenefits.map((title, index) => ({ id: `mock-benefit-${index + 1}`, title })),
    ),
    reservationLink: normalizedService.reservationLink,
    inquiryLink: normalizedService.inquiryLink,
    currentConditions: [...normalizedService.currentConditions],
    currentDetailDescription: normalizedService.detailDescription,
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
    requestHistory,
  };
}
