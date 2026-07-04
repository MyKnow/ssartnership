import {
  generateTempPassword,
  hashPassword,
} from "../../password.ts";
import type {
  PartnerPortalCompanySummary,
  PartnerPortalDemoSetupSummary,
} from "../../partner-portal.ts";
import type {
  PartnerPortalServiceDashboard,
} from "../../partner-dashboard.ts";

export type MockPortalAccountRecord = {
  id: string;
  loginId: string;
  displayName: string;
  email: string;
  linkedCompanyIds?: string[];
  mustChangePassword: boolean;
  emailVerifiedAt: string | null;
  initialSetupCompletedAt: string | null;
  isActive: boolean;
  passwordHash: string;
  passwordSalt: string;
  setupToken: string;
  lastLoginAt: string | null;
};

export type MockPortalServiceRecord = Omit<
  PartnerPortalServiceDashboard,
  "status"
>;

export type MockPortalCompanyRecord = Omit<PartnerPortalCompanySummary, "services"> & {
  services: MockPortalServiceRecord[];
};

export type MockPortalSetupRecord = {
  token: string;
  account: MockPortalAccountRecord;
  company: MockPortalCompanyRecord;
};

export type MockPortalStore = {
  setups: MockPortalSetupRecord[];
};

const CAFE_SSAFY_SETUP_ID = "mock-partner-setup-cafe-ssafy";

function createMockPortalAccountRecord({
  id,
  loginId,
  displayName,
  email,
  setupToken,
}: {
  id: string;
  loginId: string;
  displayName: string;
  email: string;
  setupToken: string;
}): MockPortalAccountRecord {
  const generatedPassword = generateTempPassword(12);
  const passwordRecord = hashPassword(generatedPassword);

  return {
    id,
    loginId,
    displayName,
    email,
    mustChangePassword: true,
    emailVerifiedAt: null,
    initialSetupCompletedAt: null,
    isActive: true,
    passwordHash: passwordRecord.hash,
    passwordSalt: passwordRecord.salt,
    setupToken,
    lastLoginAt: null,
  };
}

export const seededSetups: MockPortalSetupRecord[] = [
  {
    token: CAFE_SSAFY_SETUP_ID,
    account: createMockPortalAccountRecord({
      id: "mock-partner-account-cafe-ssafy",
      loginId: "partner@cafessafy.example",
      displayName: "김도연",
      email: "partner@cafessafy.example",
      setupToken: CAFE_SSAFY_SETUP_ID,
    }),
    company: {
      id: "mock-partner-company-cafe-ssafy",
      name: "카페 싸피",
      slug: "cafe-ssafy",
      description: "서울 주요 학습권역에서 여러 지점을 운영하는 가상 프랜차이즈 카페입니다.",
      services: [
        {
          id: "mock-partner-service-cafe-ssafy-yeoksam",
          name: "카페 싸피 역삼본점",
          location: "서울 강남구 역삼로 123",
          categoryLabel: "카페",
          planTier: "basic",
          visibility: "public",
          metrics: {
            favoriteCount: 124,
            detailViews: 1240,
            detailUv: 782,
            cardClicks: 360,
            mapClicks: 58,
            reservationClicks: 81,
            inquiryClicks: 26,
            reviewCount: 24,
            totalClicks: 525,
          },
        },
        {
          id: "mock-partner-service-cafe-ssafy-gangnam",
          name: "카페 싸피 강남역점",
          location: "서울 강남구 테헤란로 212",
          categoryLabel: "카페",
          planTier: "partner",
          visibility: "public",
          metrics: {
            favoriteCount: 63,
            detailViews: 520,
            detailUv: 338,
            cardClicks: 120,
            mapClicks: 22,
            reservationClicks: 14,
            inquiryClicks: 6,
            reviewCount: 11,
            totalClicks: 162,
          },
        },
        {
          id: "mock-partner-service-cafe-ssafy-seolleung",
          name: "카페 싸피 선릉점",
          location: "서울 강남구 선릉로 521",
          categoryLabel: "카페",
          planTier: "basic",
          visibility: "public",
          metrics: {
            favoriteCount: 52,
            detailViews: 430,
            detailUv: 265,
            cardClicks: 96,
            mapClicks: 18,
            reservationClicks: 12,
            inquiryClicks: 5,
            reviewCount: 9,
            totalClicks: 131,
          },
        },
        {
          id: "mock-partner-service-cafe-ssafy-samseong",
          name: "카페 싸피 삼성점",
          location: "서울 강남구 영동대로 513",
          categoryLabel: "카페",
          planTier: "boost",
          visibility: "public",
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
        {
          id: "mock-partner-service-cafe-ssafy-seocho",
          name: "카페 싸피 서초점",
          location: "서울 서초구 서초대로 398",
          categoryLabel: "카페",
          planTier: "partner",
          visibility: "public",
          metrics: {
            favoriteCount: 70,
            detailViews: 610,
            detailUv: 402,
            cardClicks: 132,
            mapClicks: 26,
            reservationClicks: 24,
            inquiryClicks: 8,
            reviewCount: 14,
            totalClicks: 190,
          },
        },
        {
          id: "mock-partner-service-cafe-ssafy-jamsil",
          name: "카페 싸피 잠실점",
          location: "서울 송파구 올림픽로 300",
          categoryLabel: "카페",
          planTier: "basic",
          visibility: "confidential",
          metrics: {
            favoriteCount: 18,
            detailViews: 190,
            detailUv: 121,
            cardClicks: 44,
            mapClicks: 7,
            reservationClicks: 3,
            inquiryClicks: 1,
            reviewCount: 5,
            totalClicks: 55,
          },
        },
      ],
    },
  },
  {
    token: "mock-partner-setup-urban-gym",
    account: createMockPortalAccountRecord({
      id: "mock-partner-account-urban-gym",
      loginId: "admin@urbangym.example",
      displayName: "박지수",
      email: "admin@urbangym.example",
      setupToken: "mock-partner-setup-urban-gym",
    }),
    company: {
      id: "mock-partner-company-urban-gym",
      name: "어반짐 역삼",
      slug: "urban-gym",
      description: "헬스와 PT 패키지를 운영하는 복합 피트니스 브랜드입니다.",
      services: [
        {
          id: "mock-partner-service-urban-gym-pt",
          name: "어반짐 PT 패키지",
          location: "서울 강남구 봉은사로 11",
          categoryLabel: "헬스",
          planTier: "boost",
          visibility: "public",
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
    },
  },
];

seededSetups[0].account.linkedCompanyIds = [
  seededSetups[0].company.id,
  seededSetups[1].company.id,
];

export function cloneSetupRecord(setup: MockPortalSetupRecord): MockPortalSetupRecord {
  return {
    token: setup.token,
    account: {
      ...setup.account,
      linkedCompanyIds: setup.account.linkedCompanyIds
        ? [...setup.account.linkedCompanyIds]
        : undefined,
    },
    company: {
      ...setup.company,
      services: setup.company.services.map((service) => ({
        ...service,
        metrics: { ...service.metrics },
      })),
    },
  };
}

export function cloneSetupSummary(record: MockPortalSetupRecord): PartnerPortalDemoSetupSummary {
  return {
    token: record.token,
    companyName: record.company.name,
    loginId: record.account.loginId,
    serviceCount: record.company.services.length,
    isSetupComplete: Boolean(record.account.initialSetupCompletedAt),
  };
}
