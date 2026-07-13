import type { PartnerPortalDashboard } from "../../partner-dashboard.ts";
import type { PartnerPortalCompanyScope } from "../../partner-portal-scope.ts";
import type { PartnerSession } from "../../partner-session.ts";
import type { MockScenarioId } from "./registry.ts";

type CompanySelectionStoryScenarioId = Extract<
  MockScenarioId,
  "partner.company.selection.multi-company" | "partner.company.selection.empty"
>;

type DashboardStoryScenarioId = Extract<
  MockScenarioId,
  | "partner.company.dashboard.cafe-ssafy-mixed-plans"
  | "partner.company.dashboard.empty"
  | "partner.company.dashboard.pending-review"
>;

type CompanySelectionStoryScenario = {
  scenarioId: CompanySelectionStoryScenarioId;
  session: PartnerSession;
  companies: PartnerPortalCompanyScope[];
};

type DashboardStoryScenario = {
  scenarioId: DashboardStoryScenarioId;
  session: PartnerSession;
  selectedCompany: PartnerPortalCompanyScope;
  dashboard: PartnerPortalDashboard;
};

const STORY_NOW = Date.UTC(2026, 6, 5, 9, 0, 0);

const cafeSsafyCompany: PartnerPortalCompanyScope = {
  id: "mock-partner-company-cafe-ssafy",
  name: "카페 싸피",
  slug: "cafe-ssafy",
  description: "서울 학습권역의 가상 프랜차이즈 카페입니다.",
  serviceCount: 6,
};

const urbanGymCompany: PartnerPortalCompanyScope = {
  id: "mock-partner-company-urban-gym",
  name: "어반짐 역삼",
  slug: "urban-gym",
  description: "헬스와 PT 패키지를 운영하는 복합 피트니스 제휴처입니다.",
  serviceCount: 2,
};

const emptyCompany: PartnerPortalCompanyScope = {
  id: "mock-partner-company-empty",
  name: "제휴처 미연결 파트너사",
  slug: "empty-company",
  description: "아직 등록된 제휴처가 없어 제휴처 추가 신청부터 시작하는 상태입니다.",
  serviceCount: 0,
};

function createStorySession({
  accountId,
  loginId,
  displayName,
  companyIds,
}: {
  accountId: string;
  loginId: string;
  displayName: string;
  companyIds: string[];
}): PartnerSession {
  return {
    accountId,
    loginId,
    displayName,
    companyIds: [...companyIds],
    mustChangePassword: false,
    issuedAt: STORY_NOW,
    expiresAt: STORY_NOW + 7 * 24 * 60 * 60 * 1000,
  };
}

const cafeSsafySession = createStorySession({
  accountId: "mock-partner-account-cafe-ssafy",
  loginId: "partner@cafessafy.example",
  displayName: "김도연",
  companyIds: [cafeSsafyCompany.id, urbanGymCompany.id],
});

const emptySession = createStorySession({
  accountId: "mock-partner-account-empty",
  loginId: "partner-empty@example",
  displayName: "테스트 파트너",
  companyIds: [emptyCompany.id],
});

const urbanGymSession = createStorySession({
  accountId: "mock-partner-account-urban-gym",
  loginId: "admin@urbangym.example",
  displayName: "박지수",
  companyIds: [urbanGymCompany.id],
});

const zeroMetrics = () => ({
  favoriteCount: 0,
  detailViews: 0,
  detailUv: 0,
  cardClicks: 0,
  mapClicks: 0,
  reservationClicks: 0,
  inquiryClicks: 0,
  reviewCount: 0,
  totalClicks: 0,
});

const cafeSsafyDashboard: PartnerPortalDashboard = {
  companies: [
    {
      ...cafeSsafyCompany,
      services: [
        {
          id: "mock-partner-service-cafe-ssafy-yeoksam",
          name: "카페 싸피 역삼본점",
          location: "서울 강남구 역삼로 123",
          categoryLabel: "카페",
          planTier: "basic",
          visibility: "public",
          status: "approved",
          metrics: {
            favoriteCount: 124,
            detailViews: 1240,
            detailUv: 0,
            cardClicks: 0,
            mapClicks: 0,
            reservationClicks: 0,
            inquiryClicks: 0,
            reviewCount: 24,
            totalClicks: 0,
          },
        },
        {
          id: "mock-partner-service-cafe-ssafy-gangnam",
          name: "카페 싸피 강남역점",
          location: "서울 강남구 테헤란로 212",
          categoryLabel: "카페",
          planTier: "partner",
          visibility: "public",
          status: "approved",
          metrics: {
            favoriteCount: 63,
            detailViews: 520,
            detailUv: 338,
            cardClicks: 0,
            mapClicks: 0,
            reservationClicks: 0,
            inquiryClicks: 0,
            reviewCount: 11,
            totalClicks: 0,
          },
        },
        {
          id: "mock-partner-service-cafe-ssafy-samseong",
          name: "카페 싸피 삼성점",
          location: "서울 강남구 영동대로 513",
          categoryLabel: "카페",
          planTier: "boost",
          visibility: "public",
          status: "approved",
          metrics: {
            favoriteCount: 88,
            detailViews: 860,
            detailUv: 544,
            cardClicks: 212,
            mapClicks: 41,
            reservationClicks: 49,
            inquiryClicks: 13,
            reviewCount: 16,
            totalClicks: 315,
          },
        },
      ],
      totals: {
        favoriteCount: 275,
        detailViews: 2620,
        detailUv: 882,
        cardClicks: 212,
        mapClicks: 41,
        reservationClicks: 49,
        inquiryClicks: 13,
        reviewCount: 51,
        totalClicks: 315,
      },
    },
  ],
  totals: {
    favoriteCount: 275,
    detailViews: 2620,
    detailUv: 882,
    cardClicks: 212,
    mapClicks: 41,
    reservationClicks: 49,
    inquiryClicks: 13,
    reviewCount: 51,
    totalClicks: 315,
    companyCount: 1,
    serviceCount: 3,
  },
  warningMessage: null,
};

const emptyDashboard: PartnerPortalDashboard = {
  companies: [
    {
      ...emptyCompany,
      services: [],
      totals: zeroMetrics(),
    },
  ],
  totals: {
    ...zeroMetrics(),
    companyCount: 1,
    serviceCount: 0,
  },
  warningMessage: null,
};

const pendingReviewDashboard: PartnerPortalDashboard = {
  companies: [
    {
      ...urbanGymCompany,
      services: [
        {
          id: "mock-partner-service-urban-gym-pt",
          name: "어반짐 PT 패키지",
          location: "서울 강남구 봉은사로 11",
          categoryLabel: "헬스",
          planTier: "boost",
          visibility: "public",
          status: "approved",
          metrics: {
            favoriteCount: 168,
            detailViews: 1560,
            detailUv: 968,
            cardClicks: 410,
            mapClicks: 74,
            reservationClicks: 126,
            inquiryClicks: 31,
            reviewCount: 18,
            totalClicks: 641,
          },
        },
        {
          id: "mock-partner-service-urban-gym-sauna",
          name: "어반짐 사우나",
          location: "서울 강남구 봉은사로 11, B1",
          categoryLabel: "헬스",
          planTier: "boost",
          visibility: "confidential",
          status: "pending",
          metrics: {
            favoriteCount: 29,
            detailViews: 240,
            detailUv: 155,
            cardClicks: 56,
            mapClicks: 10,
            reservationClicks: 8,
            inquiryClicks: 3,
            reviewCount: 7,
            totalClicks: 77,
          },
        },
      ],
      totals: {
        favoriteCount: 197,
        detailViews: 1800,
        detailUv: 1123,
        cardClicks: 466,
        mapClicks: 84,
        reservationClicks: 134,
        inquiryClicks: 34,
        reviewCount: 25,
        totalClicks: 718,
      },
    },
  ],
  totals: {
    favoriteCount: 197,
    detailViews: 1800,
    detailUv: 1123,
    cardClicks: 466,
    mapClicks: 84,
    reservationClicks: 134,
    inquiryClicks: 34,
    reviewCount: 25,
    totalClicks: 718,
    companyCount: 1,
    serviceCount: 2,
  },
  warningMessage: null,
};

export function getPartnerCompanySelectionStoryScenario(
  scenarioId: CompanySelectionStoryScenarioId,
): CompanySelectionStoryScenario {
  if (scenarioId === "partner.company.selection.empty") {
    return {
      scenarioId,
      session: emptySession,
      companies: [],
    };
  }

  return {
    scenarioId,
    session: cafeSsafySession,
    companies: [cafeSsafyCompany, urbanGymCompany],
  };
}

export function getPartnerDashboardStoryScenario(
  scenarioId: DashboardStoryScenarioId,
): DashboardStoryScenario {
  if (scenarioId === "partner.company.dashboard.empty") {
    return {
      scenarioId,
      session: emptySession,
      selectedCompany: emptyCompany,
      dashboard: emptyDashboard,
    };
  }

  if (scenarioId === "partner.company.dashboard.pending-review") {
    return {
      scenarioId,
      session: urbanGymSession,
      selectedCompany: urbanGymCompany,
      dashboard: pendingReviewDashboard,
    };
  }

  return {
    scenarioId,
    session: cafeSsafySession,
    selectedCompany: cafeSsafyCompany,
    dashboard: cafeSsafyDashboard,
  };
}
