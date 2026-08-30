import { PartnerChangeRequestError } from "../../partner-change-request-errors.ts";
import {
  assertPartnerChangeRequestHasChanges,
  normalizePartnerChangeRequestCreateFields,
  requirePartnerChangeRequestAuditContext,
} from "../../partner-change-requests/contracts.ts";
import type {
  PartnerChangeRequestCancelInput,
  PartnerChangeRequestCreateInput,
  PartnerChangeRequestReviewInput,
} from "../../partner-change-requests/shared.ts";
import {
  toSummary,
} from "./normalizers.ts";
import { findDisplayNameByAccountId, findRequest, findPendingRequest, findService, getStore } from "./service-store.ts";

export async function createMockPartnerChangeRequest(
  input: PartnerChangeRequestCreateInput,
) {
  const service = findService(input.partnerId);
  if (!service || !input.companyIds.includes(service.companyId)) {
    throw new PartnerChangeRequestError(
      "forbidden",
      "해당 제휴처의 변경 요청을 만들 수 없습니다.",
    );
  }

  if (findPendingRequest(input.partnerId)) {
    throw new PartnerChangeRequestError(
      "pending_exists",
      "이미 승인 대기 중인 요청이 있습니다.",
    );
  }

  const normalized = normalizePartnerChangeRequestCreateFields(input);
  assertPartnerChangeRequestHasChanges(
    {
      partnerName: service.partnerName,
      partnerLocation: service.partnerLocation,
      detailDescription: service.detailDescription,
      mapUrl: service.mapUrl,
      campusSlugs: service.currentCampusSlugs,
      conditions: service.currentConditions,
      benefits: service.currentBenefits,
      appliesTo: service.currentAppliesTo,
      periodStart: service.periodStart,
      periodEnd: service.periodEnd,
    },
    normalized,
  );
  const {
    requestedConditions,
    requestedBenefits,
    requestedAppliesTo,
    requestedTags,
    requestedPartnerName,
    requestedPartnerLocation,
    requestedDetailDescription,
    requestedMapUrl,
    requestedCampusSlugs,
    requestedThumbnail,
    requestedImages,
    requestedReservationLink,
    requestedInquiryLink,
    requestedPeriodStart,
    requestedPeriodEnd,
  } = normalized;

  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    companyId: service.companyId,
    companyName: service.companyName,
    companySlug: service.companySlug,
    partnerId: service.partnerId,
    partnerName: service.partnerName,
    partnerLocation: service.partnerLocation,
    currentDetailDescription: service.detailDescription,
    currentPartnerName: service.partnerName,
    currentPartnerLocation: service.partnerLocation,
    currentMapUrl: service.mapUrl,
    currentCampusSlugs: [...service.currentCampusSlugs],
    categoryLabel: service.categoryLabel,
    status: "pending" as const,
    requestedByAccountId: input.requestedByAccountId,
    requestedByLoginId: input.requestedByLoginId,
    requestedByDisplayName:
      input.requestedByDisplayName ||
      findDisplayNameByAccountId(input.requestedByAccountId) ||
      null,
    currentConditions: [...service.currentConditions],
    currentBenefits: [...service.currentBenefits],
    currentAppliesTo: [...service.currentAppliesTo],
    currentTags: [...service.tags],
    currentThumbnail: service.thumbnail,
    currentImages: [...service.images],
    currentReservationLink: service.reservationLink,
    currentInquiryLink: service.inquiryLink,
    currentPeriodStart: service.periodStart,
    currentPeriodEnd: service.periodEnd,
    requestedPartnerName,
    requestedPartnerLocation,
    requestedDetailDescription,
    requestedMapUrl,
    requestedCampusSlugs,
    requestedConditions,
    requestedBenefits,
    requestedAppliesTo,
    requestedTags,
    requestedThumbnail,
    requestedImages,
    requestedReservationLink,
    requestedInquiryLink,
    requestedPeriodStart,
    requestedPeriodEnd,
    reviewedByAdminId: null,
    reviewedAt: null,
    cancelledByAccountId: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
  };

  getStore().requests.unshift(record);
  return toSummary(record);
}

export async function cancelMockPartnerChangeRequest(
  input: PartnerChangeRequestCancelInput,
) {
  const request = findRequest(input.requestId);
  if (!request) {
    throw new PartnerChangeRequestError("not_found", "요청을 찾을 수 없습니다.");
  }
  if (request.status !== "pending") {
    throw new PartnerChangeRequestError(
      "already_resolved",
      "이미 처리된 요청입니다.",
    );
  }
  if (
    request.requestedByAccountId !== input.accountId ||
    !input.companyIds.includes(request.companyId)
  ) {
    throw new PartnerChangeRequestError(
      "forbidden",
      "해당 요청을 취소할 수 없습니다.",
    );
  }

  request.status = "cancelled";
  request.cancelledByAccountId = input.accountId;
  request.cancelledAt = new Date().toISOString();
  request.updatedAt = request.cancelledAt;
  return toSummary(request);
}

export async function approveMockPartnerChangeRequest(
  input: PartnerChangeRequestReviewInput,
) {
  requirePartnerChangeRequestAuditContext(
    input.auditContext,
    "감사 요청 문맥이 없어 변경 요청을 승인할 수 없습니다.",
  );
  const request = findRequest(input.requestId);
  if (!request) {
    throw new PartnerChangeRequestError("not_found", "요청을 찾을 수 없습니다.");
  }
  if (request.status !== "pending") {
    throw new PartnerChangeRequestError(
      "already_resolved",
      "이미 처리된 요청입니다.",
    );
  }

  const service = findService(request.partnerId);
  if (service) {
    service.partnerName = request.requestedPartnerName;
    service.partnerLocation = request.requestedPartnerLocation;
    service.detailDescription = request.requestedDetailDescription ?? null;
    service.mapUrl = request.requestedMapUrl;
    service.currentConditions = [...request.requestedConditions];
    service.currentBenefits = [...request.requestedBenefits];
    service.currentAppliesTo = [...request.requestedAppliesTo];
    service.currentCampusSlugs = [...request.requestedCampusSlugs];
    service.periodStart = request.requestedPeriodStart;
    service.periodEnd = request.requestedPeriodEnd;
  }

  request.status = "approved";
  request.reviewedByAdminId = input.adminId;
  request.reviewedAt = new Date().toISOString();
  request.updatedAt = request.reviewedAt;
  return toSummary(request);
}

export async function rejectMockPartnerChangeRequest(
  input: PartnerChangeRequestReviewInput,
) {
  requirePartnerChangeRequestAuditContext(
    input.auditContext,
    "감사 요청 문맥이 없어 변경 요청을 거절할 수 없습니다.",
  );
  const request = findRequest(input.requestId);
  if (!request) {
    throw new PartnerChangeRequestError("not_found", "요청을 찾을 수 없습니다.");
  }
  if (request.status !== "pending") {
    throw new PartnerChangeRequestError(
      "already_resolved",
      "이미 처리된 요청입니다.",
    );
  }

  request.status = "rejected";
  request.reviewedByAdminId = input.adminId;
  request.reviewedAt = new Date().toISOString();
  request.updatedAt = request.reviewedAt;
  return toSummary(request);
}
