import type { PartnerAudienceKey } from "../../partner-audience.ts";
import type { CampusSlug } from "../../campuses.ts";
import type {
  PartnerChangeRequestSummary,
} from "../../partner-change-requests/shared.ts";
import type { PartnerVisibility } from "../../types.ts";
import type { PartnerBenefitActionType } from "../../partner-benefit-action.ts";

export type MockChangeRequestServiceRecord = {
  companyId: string;
  companyName: string;
  companySlug: string;
  partnerId: string;
  partnerName: string;
  partnerCreatedAt: string;
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
  benefitActionType: PartnerBenefitActionType;
  benefitActionLink: string | null;
  reservationLink: string | null;
  inquiryLink: string | null;
  currentConditions: string[];
  currentBenefits: string[];
  currentAppliesTo: PartnerAudienceKey[];
  currentCampusSlugs: CampusSlug[];
};

export type MockChangeRequestRecord = PartnerChangeRequestSummary & {
  requestedByAccountId: string;
};

export type MockChangeRequestSeed = Partial<MockChangeRequestRecord> & {
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

export type MockChangeRequestStore = {
  services: MockChangeRequestServiceRecord[];
  requests: MockChangeRequestRecord[];
};

export const seededServices: MockChangeRequestServiceRecord[] = [
  {
    companyId: "mock-partner-company-cafe-haeon",
    companyName: "카페 해온",
    companySlug: "cafe-haeon",
    partnerId: "mock-partner-service-cafe-haeon-main",
    partnerName: "카페 해온 본점",
    partnerCreatedAt: "2026-03-01T00:00:00.000Z",
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
    benefitActionType: "external_link",
    benefitActionLink: "https://booking.naver.com/",
    reservationLink: "https://booking.naver.com/",
    inquiryLink: "02-555-8123",
    currentConditions: ["전 직원 SSAFY 구성원 인증"],
    currentBenefits: ["월 이용권 20% 할인", "PT 5회 패키지 10% 할인"],
    currentAppliesTo: ["staff", "student"],
    currentCampusSlugs: ["seoul"],
  },
  {
    companyId: "mock-partner-company-cafe-haeon",
    companyName: "카페 해온",
    companySlug: "cafe-haeon",
    partnerId: "mock-partner-service-cafe-haeon-dessert",
    partnerName: "카페 해온 디저트 바",
    partnerCreatedAt: "2026-03-01T00:00:00.000Z",
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
    benefitActionType: "external_link",
    benefitActionLink: "https://booking.naver.com/",
    reservationLink: "https://booking.naver.com/",
    inquiryLink: "02-555-8133",
    currentConditions: ["예약 후 이용", "2인 이상 주문 시"],
    currentBenefits: ["아메리카노 15% 할인", "디저트 세트 1,000원 할인"],
    currentAppliesTo: ["student"],
    currentCampusSlugs: ["seoul"],
  },
  {
    companyId: "mock-partner-company-urban-gym",
    companyName: "어반짐 역삼",
    companySlug: "urban-gym",
    partnerId: "mock-partner-service-urban-gym-pt",
    partnerName: "어반짐 PT 패키지",
    partnerCreatedAt: "2026-03-10T00:00:00.000Z",
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
    benefitActionType: "external_link",
    benefitActionLink: "https://booking.naver.com/",
    reservationLink: "https://booking.naver.com/",
    inquiryLink: "02-777-8811",
    currentConditions: ["상담 예약 필수"],
    currentBenefits: ["PT 5회 15% 할인", "운동복 무료 대여"],
    currentAppliesTo: ["staff", "student", "graduate"],
    currentCampusSlugs: ["seoul"],
  },
  {
    companyId: "mock-partner-company-urban-gym",
    companyName: "어반짐 역삼",
    companySlug: "urban-gym",
    partnerId: "mock-partner-service-urban-gym-sauna",
    partnerName: "어반짐 사우나",
    partnerCreatedAt: "2026-03-10T00:00:00.000Z",
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
    benefitActionType: "external_link",
    benefitActionLink: "https://booking.naver.com/",
    reservationLink: "https://booking.naver.com/",
    inquiryLink: "02-777-8811",
    currentConditions: ["평일 1일 1회", "운동복 착용"],
    currentBenefits: ["사우나 20% 할인"],
    currentAppliesTo: ["staff", "graduate"],
    currentCampusSlugs: ["seoul"],
  },
];

export const seededRequests: MockChangeRequestSeed[] = [
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
    currentCampusSlugs: ["seoul"],
    requestedConditions: ["평일 1일 1회", "세면도구 지참"],
    requestedBenefits: ["사우나 25% 할인", "수건 무료 제공"],
    requestedAppliesTo: ["staff", "student", "graduate"],
    requestedCampusSlugs: ["seoul"],
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

export function getRawMockPartnerChangeRequestStore() {
  if (!globalScope.__mockPartnerChangeRequestStore) {
    globalScope.__mockPartnerChangeRequestStore = {
      services: seededServices.map((service) => ({ ...service })),
      requests: seededRequests.map((request) => ({ ...request })) as MockChangeRequestRecord[],
    };
  }

  return globalScope.__mockPartnerChangeRequestStore;
}

export function resetMockPartnerChangeRequestStore() {
  delete globalScope.__mockPartnerChangeRequestStore;
}
