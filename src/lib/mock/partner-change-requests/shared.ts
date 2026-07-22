import type { PartnerAudienceKey } from "../../partner-audience.ts";
import type { CampusSlug } from "../../campuses.ts";
import type {
  PartnerChangeRequestSummary,
} from "../../partner-change-requests/shared.ts";
import type { PartnerVisibility } from "../../types.ts";
import type { PartnerBenefitActionType } from "../../partner-benefit-action.ts";
import type { PartnerCompanyPlanTier } from "../../partner-company-plans.ts";
import type { PartnerBenefit } from "../../partner-benefit-items.ts";

export type MockChangeRequestServiceRecord = {
  companyId: string;
  companyName: string;
  companySlug: string;
  brandPlanTier: PartnerCompanyPlanTier;
  partnerId: string;
  partnerName: string;
  partnerCreatedAt: string;
  partnerLocation: string;
  detailDescription: string | null;
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
  benefitItems?: PartnerBenefit[];
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
    companyId: "mock-partner-company-cafe-ssafy",
    companyName: "카페 싸피",
    companySlug: "cafe-ssafy",
    brandPlanTier: "basic",
    partnerId: "mock-partner-service-cafe-ssafy-yeoksam",
    partnerName: "카페 싸피 역삼본점",
    partnerCreatedAt: "2026-03-01T00:00:00.000Z",
    partnerLocation: "서울 강남구 역삼로 123",
    detailDescription: "역삼역 인근에서 커피와 작업 좌석을 함께 제공하는 카페 싸피 대표 매장입니다.",
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
    benefitItems: [
      { id: "mock-cafe-benefit-1", title: "아메리카노 20% 할인", maxApplyCount: null },
      { id: "mock-cafe-benefit-2", title: "디저트 세트 1,500원 할인", maxApplyCount: null },
    ],
    reservationLink: "https://booking.naver.com/",
    inquiryLink: "02-555-8123",
    currentConditions: ["SSAFY 구성원 인증", "매장 주문 시 적용"],
    currentBenefits: ["아메리카노 20% 할인", "디저트 세트 1,500원 할인"],
    currentAppliesTo: ["staff", "student"],
    currentCampusSlugs: ["seoul"],
  },
  {
    companyId: "mock-partner-company-cafe-ssafy",
    companyName: "카페 싸피",
    companySlug: "cafe-ssafy",
    brandPlanTier: "partner",
    partnerId: "mock-partner-service-cafe-ssafy-gangnam",
    partnerName: "카페 싸피 강남역점",
    partnerCreatedAt: "2026-03-01T00:00:00.000Z",
    partnerLocation: "서울 강남구 테헤란로 212",
    detailDescription: "강남역 인근 모임과 테이크아웃 수요를 함께 운영하는 지점입니다.",
    categoryLabel: "카페",
    categoryColor: "#38bdf8",
    visibility: "public",
    periodStart: "2026-03-01",
    periodEnd: "2026-08-31",
    thumbnail: null,
    images: [],
    tags: ["테이크아웃", "모임"],
    mapUrl: "https://map.naver.com/",
    benefitActionType: "external_link",
    benefitActionLink: "https://booking.naver.com/",
    reservationLink: "https://booking.naver.com/",
    inquiryLink: "02-555-8130",
    currentConditions: ["SSAFY 구성원 인증", "평일 11시 이후"],
    currentBenefits: ["전 음료 15% 할인", "텀블러 지참 시 샷 추가"],
    currentAppliesTo: ["staff", "student", "graduate"],
    currentCampusSlugs: ["seoul"],
  },
  {
    companyId: "mock-partner-company-cafe-ssafy",
    companyName: "카페 싸피",
    companySlug: "cafe-ssafy",
    brandPlanTier: "basic",
    partnerId: "mock-partner-service-cafe-ssafy-seolleung",
    partnerName: "카페 싸피 선릉점",
    partnerCreatedAt: "2026-03-01T00:00:00.000Z",
    partnerLocation: "서울 강남구 선릉로 521",
    detailDescription: "선릉역 출퇴근 동선에서 간단한 커피 픽업에 적합한 지점입니다.",
    categoryLabel: "카페",
    categoryColor: "#38bdf8",
    visibility: "public",
    periodStart: "2026-03-01",
    periodEnd: "2026-08-31",
    thumbnail: null,
    images: [],
    tags: ["픽업", "출근길"],
    mapUrl: "https://map.naver.com/",
    benefitActionType: "external_link",
    benefitActionLink: "https://booking.naver.com/",
    reservationLink: "https://booking.naver.com/",
    inquiryLink: "02-555-8131",
    currentConditions: ["SSAFY 구성원 인증", "포장 주문 한정"],
    currentBenefits: ["커피 메뉴 15% 할인", "베이커리 1,000원 할인"],
    currentAppliesTo: ["student"],
    currentCampusSlugs: ["seoul"],
  },
  {
    companyId: "mock-partner-company-cafe-ssafy",
    companyName: "카페 싸피",
    companySlug: "cafe-ssafy",
    brandPlanTier: "boost",
    partnerId: "mock-partner-service-cafe-ssafy-samseong",
    partnerName: "카페 싸피 삼성점",
    partnerCreatedAt: "2026-03-01T00:00:00.000Z",
    partnerLocation: "서울 강남구 영동대로 513",
    detailDescription: "코엑스와 삼성역 인근 유동 인구를 대상으로 운영하는 대형 지점입니다.",
    categoryLabel: "카페",
    categoryColor: "#38bdf8",
    visibility: "public",
    periodStart: "2026-03-01",
    periodEnd: "2026-08-31",
    thumbnail: null,
    images: [],
    tags: ["대형매장", "광고"],
    mapUrl: "https://map.naver.com/",
    benefitActionType: "external_link",
    benefitActionLink: "https://booking.naver.com/",
    reservationLink: "https://booking.naver.com/",
    inquiryLink: "02-555-8132",
    currentConditions: ["SSAFY 구성원 인증", "매장 주문 시 적용"],
    currentBenefits: ["시그니처 라떼 20% 할인", "단체 주문 10% 할인"],
    currentAppliesTo: ["staff", "student", "graduate"],
    currentCampusSlugs: ["seoul"],
  },
  {
    companyId: "mock-partner-company-cafe-ssafy",
    companyName: "카페 싸피",
    companySlug: "cafe-ssafy",
    brandPlanTier: "partner",
    partnerId: "mock-partner-service-cafe-ssafy-seocho",
    partnerName: "카페 싸피 서초점",
    partnerCreatedAt: "2026-03-01T00:00:00.000Z",
    partnerLocation: "서울 서초구 서초대로 398",
    detailDescription: "서초권 스터디와 미팅 수요를 위한 조용한 좌석 중심 지점입니다.",
    categoryLabel: "카페",
    categoryColor: "#38bdf8",
    visibility: "public",
    periodStart: "2026-03-01",
    periodEnd: "2026-08-31",
    thumbnail: null,
    images: [],
    tags: ["스터디", "좌석"],
    mapUrl: "https://map.naver.com/",
    benefitActionType: "external_link",
    benefitActionLink: "https://booking.naver.com/",
    reservationLink: "https://booking.naver.com/",
    inquiryLink: "02-555-8133",
    currentConditions: ["SSAFY 구성원 인증", "2시간 이상 이용 시"],
    currentBenefits: ["음료 15% 할인", "스터디 좌석 1시간 무료"],
    currentAppliesTo: ["staff", "student"],
    currentCampusSlugs: ["seoul"],
  },
  {
    companyId: "mock-partner-company-cafe-ssafy",
    companyName: "카페 싸피",
    companySlug: "cafe-ssafy",
    brandPlanTier: "basic",
    partnerId: "mock-partner-service-cafe-ssafy-jamsil",
    partnerName: "카페 싸피 잠실점",
    partnerCreatedAt: "2026-03-01T00:00:00.000Z",
    partnerLocation: "서울 송파구 올림픽로 300",
    detailDescription: "잠실권 방문 고객을 위한 포장 디저트와 커피 중심 지점입니다.",
    categoryLabel: "카페",
    categoryColor: "#38bdf8",
    visibility: "confidential",
    periodStart: "2026-03-01",
    periodEnd: "2026-08-31",
    thumbnail: null,
    images: [],
    tags: ["디저트", "잠실"],
    mapUrl: "https://map.naver.com/",
    benefitActionType: "external_link",
    benefitActionLink: "https://booking.naver.com/",
    reservationLink: "https://booking.naver.com/",
    inquiryLink: "02-555-8134",
    currentConditions: ["예약 후 이용", "2인 이상 주문 시"],
    currentBenefits: ["아메리카노 15% 할인", "디저트 세트 1,000원 할인"],
    currentAppliesTo: ["student"],
    currentCampusSlugs: ["seoul"],
  },
  {
    companyId: "mock-partner-company-urban-gym",
    companyName: "어반짐 역삼",
    companySlug: "urban-gym",
    brandPlanTier: "boost",
    partnerId: "mock-partner-service-urban-gym-pt",
    partnerName: "어반짐 PT 패키지",
    partnerCreatedAt: "2026-03-10T00:00:00.000Z",
    partnerLocation: "서울 강남구 봉은사로 11",
    detailDescription: "기초 체력 상담 후 PT 패키지를 선택할 수 있는 운동 공간입니다.",
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
    brandPlanTier: "boost",
    partnerId: "mock-partner-service-urban-gym-sauna",
    partnerName: "어반짐 사우나",
    partnerCreatedAt: "2026-03-10T00:00:00.000Z",
    partnerLocation: "서울 강남구 봉은사로 11, B1",
    detailDescription: "운동 후 이용할 수 있는 사우나 시설입니다.",
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
    currentDetailDescription: "운동 후 이용할 수 있는 사우나 시설입니다.",
    requestedDetailDescription: "운동 후 간단히 정리하고 쉬어갈 수 있는 사우나 시설입니다.",
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
