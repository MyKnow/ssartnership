import type { PartnerAudienceKey } from "../partner-audience.ts";
import {
  PartnerChangeRequestError,
} from "../partner-change-request-errors.ts";
import type {
  PartnerChangeRequestContext,
  PartnerChangeRequestCreateInput,
  PartnerChangeRequestCancelInput,
  PartnerChangeRequestReviewInput,
  PartnerChangeRequestSummary,
} from "../partner-change-requests.ts";
import { normalizePartnerAudience } from "../partner-audience.ts";
import type { PartnerVisibility } from "../types.ts";
import { sanitizeHttpUrl, sanitizePartnerLinkValue } from "../validation.ts";

type MockChangeRequestServiceRecord = {
  companyId: string;
  companyName: string;
  companySlug: string;
  partnerId: string;
  partnerName: string;
  partnerLocation: string;
  categoryLabel: string;
  categoryColor: string | null;
  visibility: PartnerVisibility;
  periodStart: string | null;
  periodEnd: string | null;
  thumbnail: string | null;
  images: string[];
  tags: string[];
  mapUrl: string | null;
  reservationLink: string | null;
  inquiryLink: string | null;
  currentConditions: string[];
  currentBenefits: string[];
  currentAppliesTo: PartnerAudienceKey[];
};

type MockChangeRequestRecord = PartnerChangeRequestSummary & {
  requestedByAccountId: string;
};

type MockChangeRequestSeed = Partial<MockChangeRequestRecord> & {
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
};

type MockChangeRequestStore = {
  services: MockChangeRequestServiceRecord[];
  requests: MockChangeRequestRecord[];
};

function normalizeOptionalText(value?: string | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeOptionalLink(value?: string | null) {
  return sanitizePartnerLinkValue(value ?? undefined);
}

function normalizeHttpUrlList(
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

function normalizeServiceRecord(
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

const seededServices: MockChangeRequestServiceRecord[] = [
  {
    companyId: "mock-partner-company-cafe-haeon",
    companyName: "카페 해온",
    companySlug: "cafe-haeon",
    partnerId: "mock-partner-service-cafe-haeon-main",
    partnerName: "카페 해온 본점",
    partnerLocation: "서울 강남구 역삼로 123",
    categoryLabel: "카페",
    categoryColor: "#38bdf8",
    visibility: "public",
    periodStart: "2026-03-01",
    periodEnd: "2026-08-31",
    thumbnail: null,
    images: [],
    tags: ["작업", "디저트"],
    mapUrl: "https://map.naver.com/",
    reservationLink: "https://booking.naver.com/",
    inquiryLink: "02-555-8123",
    currentConditions: ["전 직원 SSAFY 구성원 인증"],
    currentBenefits: ["월 이용권 20% 할인", "PT 5회 패키지 10% 할인"],
    currentAppliesTo: ["staff", "student"],
  },
  {
    companyId: "mock-partner-company-cafe-haeon",
    companyName: "카페 해온",
    companySlug: "cafe-haeon",
    partnerId: "mock-partner-service-cafe-haeon-dessert",
    partnerName: "카페 해온 디저트 바",
    partnerLocation: "서울 강남구 논현로 45",
    categoryLabel: "카페",
    categoryColor: "#38bdf8",
    visibility: "confidential",
    periodStart: "2026-03-01",
    periodEnd: "2026-08-31",
    thumbnail: null,
    images: [],
    tags: ["디저트"],
    mapUrl: "https://map.naver.com/",
    reservationLink: "https://booking.naver.com/",
    inquiryLink: "02-555-8133",
    currentConditions: ["예약 후 이용", "2인 이상 주문 시"],
    currentBenefits: ["아메리카노 15% 할인", "디저트 세트 1,000원 할인"],
    currentAppliesTo: ["student"],
  },
  {
    companyId: "mock-partner-company-urban-gym",
    companyName: "어반짐 역삼",
    companySlug: "urban-gym",
    partnerId: "mock-partner-service-urban-gym-pt",
    partnerName: "어반짐 PT 패키지",
    partnerLocation: "서울 강남구 봉은사로 11",
    categoryLabel: "헬스",
    categoryColor: "#10b981",
    visibility: "public",
    periodStart: "2026-03-10",
    periodEnd: "2026-12-31",
    thumbnail: null,
    images: [],
    tags: ["PT", "운동복"],
    mapUrl: "https://map.kakao.com/",
    reservationLink: "https://booking.naver.com/",
    inquiryLink: "02-777-8811",
    currentConditions: ["상담 예약 필수"],
    currentBenefits: ["PT 5회 15% 할인", "운동복 무료 대여"],
    currentAppliesTo: ["staff", "student", "graduate"],
  },
  {
    companyId: "mock-partner-company-urban-gym",
    companyName: "어반짐 역삼",
    companySlug: "urban-gym",
    partnerId: "mock-partner-service-urban-gym-sauna",
    partnerName: "어반짐 사우나",
    partnerLocation: "서울 강남구 봉은사로 11, B1",
    categoryLabel: "헬스",
    categoryColor: "#10b981",
    visibility: "confidential",
    periodStart: "2026-03-10",
    periodEnd: "2026-12-31",
    thumbnail: null,
    images: [],
    tags: ["사우나"],
    mapUrl: "https://map.kakao.com/",
    reservationLink: "https://booking.naver.com/",
    inquiryLink: "02-777-8811",
    currentConditions: ["평일 1일 1회", "운동복 착용"],
    currentBenefits: ["사우나 20% 할인"],
    currentAppliesTo: ["staff", "graduate"],
  },
];

const seededRequests: MockChangeRequestSeed[] = [
  {
    id: "mock-change-request-urban-gym-sauna-001",
    companyId: "mock-partner-company-urban-gym",
    companyName: "어반짐 역삼",
    companySlug: "urban-gym",
    partnerId: "mock-partner-service-urban-gym-sauna",
    partnerName: "어반짐 사우나",
    partnerLocation: "서울 강남구 봉은사로 11, B1",
    categoryLabel: "헬스",
    status: "pending",
    requestedByAccountId: "mock-partner-account-urban-gym",
    requestedByLoginId: "admin@urbangym.example",
    requestedByDisplayName: "박지수",
    currentConditions: ["평일 1일 1회", "운동복 착용"],
    currentBenefits: ["사우나 20% 할인"],
    currentAppliesTo: ["staff", "graduate"],
    requestedConditions: ["평일 1일 1회", "세면도구 지참"],
    requestedBenefits: ["사우나 25% 할인", "수건 무료 제공"],
    requestedAppliesTo: ["staff", "student", "graduate"],
    reviewedByAdminId: null,
    reviewedAt: null,
    cancelledByAccountId: null,
    cancelledAt: null,
    createdAt: new Date("2026-04-10T09:00:00.000Z").toISOString(),
    updatedAt: new Date("2026-04-10T09:00:00.000Z").toISOString(),
  },
];

const globalScope = globalThis as typeof globalThis & {
  __mockPartnerChangeRequestStore?: MockChangeRequestStore;
};

function getStore() {
  if (!globalScope.__mockPartnerChangeRequestStore) {
    globalScope.__mockPartnerChangeRequestStore = {
      services: seededServices.map((service) => normalizeServiceRecord(service)),
      requests: seededRequests.map((request) =>
        normalizeRequestRecord(
          request,
          seededServices.find((service) => service.partnerId === request.partnerId) ??
            null,
        ),
      ),
    };
  }

  globalScope.__mockPartnerChangeRequestStore.services =
    globalScope.__mockPartnerChangeRequestStore.services.map((service) =>
      normalizeServiceRecord(service),
    );
  globalScope.__mockPartnerChangeRequestStore.requests =
    globalScope.__mockPartnerChangeRequestStore.requests.map((request) =>
      normalizeRequestRecord(
        request,
        globalScope.__mockPartnerChangeRequestStore?.services.find(
          (service) => service.partnerId === request.partnerId,
        ) ?? null,
      ),
    );

  return globalScope.__mockPartnerChangeRequestStore;
}

export function resetMockPartnerChangeRequestStore() {
  delete globalScope.__mockPartnerChangeRequestStore;
}

function normalizeTextList(values?: string[] | null) {
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

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

function normalizeAudience(values?: string[] | null) {
  return normalizePartnerAudience(values);
}

function normalizeRequestRecord(
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
    request.currentThumbnail === undefined
      ? service?.thumbnail
      : request.currentThumbnail;
  const currentImagesSource =
    request.currentImages === undefined
      ? service?.images
      : request.currentImages;
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
    request.currentPeriodEnd === undefined
      ? service?.periodEnd
      : request.currentPeriodEnd;
  const requestedThumbnailSource =
    request.requestedThumbnail === undefined
      ? service?.thumbnail
      : request.requestedThumbnail;
  const requestedImagesSource =
    request.requestedImages === undefined
      ? service?.images
      : request.requestedImages;
  const requestedReservationLinkSource =
    request.requestedReservationLink === undefined
      ? service?.reservationLink
      : request.requestedReservationLink;
  const requestedInquiryLinkSource =
    request.requestedInquiryLink === undefined
      ? service?.inquiryLink
      : request.requestedInquiryLink;
  const requestedTagsSource =
    request.requestedTags === undefined
      ? service?.tags
      : request.requestedTags;
  const requestedPeriodStartSource =
    request.requestedPeriodStart === undefined
      ? service?.periodStart
      : request.requestedPeriodStart;
  const requestedPeriodEndSource =
    request.requestedPeriodEnd === undefined
      ? service?.periodEnd
      : request.requestedPeriodEnd;
  const reviewedByAdminId = request.reviewedByAdminId ?? null;
  const reviewedAt = request.reviewedAt ?? null;
  const cancelledByAccountId = request.cancelledByAccountId ?? null;
  const cancelledAt = request.cancelledAt ?? null;
  const createdAt = request.createdAt ?? new Date().toISOString();
  const updatedAt = request.updatedAt ?? createdAt;

  return {
    ...request,
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

function toSummary(request: MockChangeRequestRecord): PartnerChangeRequestSummary {
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

function findService(partnerId: string) {
  return getStore().services.find((service) => service.partnerId === partnerId) ?? null;
}

function findRequest(requestId: string) {
  return getStore().requests.find((request) => request.id === requestId) ?? null;
}

function findPendingRequest(partnerId: string) {
  return (
    getStore().requests.find(
      (request) => request.partnerId === partnerId && request.status === "pending",
    ) ?? null
  );
}

function findDisplayNameByAccountId(accountId: string) {
  const request = getStore().requests.find(
    (item) => item.requestedByAccountId === accountId,
  );
  return request?.requestedByDisplayName ?? request?.requestedByLoginId ?? null;
}

export async function listMockPartnerChangeRequests(
  companyIds?: string[],
): Promise<PartnerChangeRequestSummary[]> {
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

export async function createMockPartnerChangeRequest(
  input: PartnerChangeRequestCreateInput,
): Promise<PartnerChangeRequestSummary> {
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
  const requestedThumbnail = sanitizeHttpUrl(input.requestedThumbnail ?? undefined);
  const requestedImages = normalizeHttpUrlList(input.requestedImages);
  const requestedReservationLink = normalizeOptionalLink(
    input.requestedReservationLink,
  );
  const requestedInquiryLink = normalizeOptionalLink(input.requestedInquiryLink);
  const requestedPeriodStart = normalizeOptionalText(input.requestedPeriodStart);
  const requestedPeriodEnd = normalizeOptionalText(input.requestedPeriodEnd);

  if (
    arraysEqual(service.currentConditions, requestedConditions) &&
    arraysEqual(service.currentBenefits, requestedBenefits) &&
    arraysEqual(service.currentAppliesTo, requestedAppliesTo) &&
    arraysEqual(service.tags, requestedTags) &&
    service.thumbnail === requestedThumbnail &&
    arraysEqual(service.images, requestedImages) &&
    service.reservationLink === requestedReservationLink &&
    service.inquiryLink === requestedInquiryLink &&
    service.periodStart === requestedPeriodStart &&
    service.periodEnd === requestedPeriodEnd
  ) {
    throw new PartnerChangeRequestError(
      "no_changes",
      "현재 값과 다른 변경이 없어 요청을 보낼 수 없습니다.",
    );
  }

  const now = new Date().toISOString();
  const record: MockChangeRequestRecord = {
    id: crypto.randomUUID(),
    companyId: service.companyId,
    companyName: service.companyName,
    companySlug: service.companySlug,
    partnerId: service.partnerId,
    partnerName: service.partnerName,
    partnerLocation: service.partnerLocation,
    categoryLabel: service.categoryLabel,
    status: "pending",
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
): Promise<PartnerChangeRequestSummary> {
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
): Promise<PartnerChangeRequestSummary> {
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
    service.currentConditions = [...request.requestedConditions];
    service.currentBenefits = [...request.requestedBenefits];
    service.currentAppliesTo = [...request.requestedAppliesTo];
    service.tags = [...request.requestedTags];
    service.thumbnail = request.requestedThumbnail;
    service.images = [...request.requestedImages];
    service.reservationLink = request.requestedReservationLink;
    service.inquiryLink = request.requestedInquiryLink;
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
): Promise<PartnerChangeRequestSummary> {
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
