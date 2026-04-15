import { PartnerChangeRequestError } from "../../partner-change-request-errors.ts";
import type {
  PartnerChangeRequestCancelInput,
  PartnerChangeRequestCreateInput,
  PartnerChangeRequestReviewInput,
} from "../../partner-change-requests/shared.ts";
import {
  arraysEqual,
  normalizeAudience,
  normalizeHttpUrlList,
  normalizeOptionalLink,
  normalizeOptionalText,
  normalizeRequiredText,
  normalizeTextList,
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
      "해당 서비스의 변경 요청을 만들 수 없습니다.",
    );
  }

  if (findPendingRequest(input.partnerId)) {
    throw new PartnerChangeRequestError(
      "pending_exists",
      "이미 승인 대기 중인 요청이 있습니다.",
    );
  }

  const requestedConditions = normalizeTextList(input.requestedConditions);
  const requestedBenefits = normalizeTextList(input.requestedBenefits);
  const requestedAppliesTo = normalizeAudience(input.requestedAppliesTo);
  const requestedTags = normalizeTextList(input.requestedTags);
  const requestedPartnerName = normalizeRequiredText(input.requestedPartnerName);
  const requestedPartnerLocation = normalizeRequiredText(
    input.requestedPartnerLocation,
  );
  const requestedMapUrl = normalizeOptionalText(input.requestedMapUrl);
  const requestedThumbnail = normalizeOptionalText(input.requestedThumbnail);
  const requestedImages = normalizeHttpUrlList(input.requestedImages);
  const requestedReservationLink = normalizeOptionalLink(
    input.requestedReservationLink,
  );
  const requestedInquiryLink = normalizeOptionalLink(input.requestedInquiryLink);
  const requestedPeriodStart = normalizeOptionalText(input.requestedPeriodStart);
  const requestedPeriodEnd = normalizeOptionalText(input.requestedPeriodEnd);

  if (
    service.partnerName === requestedPartnerName &&
    service.partnerLocation === requestedPartnerLocation &&
    service.mapUrl === requestedMapUrl &&
    arraysEqual(service.currentConditions, requestedConditions) &&
    arraysEqual(service.currentBenefits, requestedBenefits) &&
    arraysEqual(service.currentAppliesTo, requestedAppliesTo) &&
    service.periodStart === requestedPeriodStart &&
    service.periodEnd === requestedPeriodEnd
  ) {
    throw new PartnerChangeRequestError(
      "no_changes",
      "현재 값과 다른 변경이 없어 요청을 보낼 수 없습니다.",
    );
  }

  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    companyId: service.companyId,
    companyName: service.companyName,
    companySlug: service.companySlug,
    companyContactName: service.companyContactName,
    companyContactEmail: service.companyContactEmail,
    companyContactPhone: service.companyContactPhone,
    partnerId: service.partnerId,
    partnerName: service.partnerName,
    partnerLocation: service.partnerLocation,
    currentPartnerName: service.partnerName,
    currentPartnerLocation: service.partnerLocation,
    currentMapUrl: service.mapUrl,
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
    requestedMapUrl,
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
    service.mapUrl = request.requestedMapUrl;
    service.currentConditions = [...request.requestedConditions];
    service.currentBenefits = [...request.requestedBenefits];
    service.currentAppliesTo = [...request.requestedAppliesTo];
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
