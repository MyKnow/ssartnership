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
  mustChangePassword: boolean;
  emailVerifiedAt: string | null;
  initialSetupCompletedAt: string | null;
  isActive: boolean;
  passwordHash: string;
  passwordSalt: string;
  setupToken: string;
  setupVerificationCode: string;
  lastLoginAt: string | null;
};

export type MockPortalServiceRecord = PartnerPortalServiceDashboard;

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

function createMockPortalAccountRecord({
  id,
  loginId,
  displayName,
  email,
  setupToken,
  setupVerificationCode,
}: {
  id: string;
  loginId: string;
  displayName: string;
  email: string;
  setupToken: string;
  setupVerificationCode: string;
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
    setupVerificationCode,
    lastLoginAt: null,
  };
}

export const seededSetups: MockPortalSetupRecord[] = [
  {
    token: "mock-partner-setup-cafe-haeon",
    account: createMockPortalAccountRecord({
      id: "mock-partner-account-cafe-haeon",
      loginId: "partner@cafehaeon.example",
      displayName: "김도연",
      email: "partner@cafehaeon.example",
      setupToken: "mock-partner-setup-cafe-haeon",
      setupVerificationCode: "HAEON-2041",
    }),
    company: {
      id: "mock-partner-company-cafe-haeon",
      name: "카페 해온",
      slug: "cafe-haeon",
      description: "역삼역 인근에서 세 개의 매장을 운영하는 카페 브랜드입니다.",
      contactName: "김도연",
      contactEmail: "partner@cafehaeon.example",
      contactPhone: "02-555-8123",
      services: [
        {
          id: "mock-partner-service-cafe-haeon-main",
          name: "카페 해온 본점",
          location: "서울 강남구 역삼로 123",
          categoryLabel: "카페",
          visibility: "public",
          metrics: {
            detailViews: 1240,
            cardClicks: 360,
            mapClicks: 58,
            reservationClicks: 81,
            inquiryClicks: 26,
            totalClicks: 525,
          },
        },
        {
          id: "mock-partner-service-cafe-haeon-station",
          name: "카페 해온 스터디룸",
          location: "서울 강남구 테헤란로 222",
          categoryLabel: "공간제휴",
          visibility: "public",
          metrics: {
            detailViews: 520,
            cardClicks: 120,
            mapClicks: 22,
            reservationClicks: 14,
            inquiryClicks: 6,
            totalClicks: 162,
          },
        },
        {
          id: "mock-partner-service-cafe-haeon-dessert",
          name: "카페 해온 디저트 바",
          location: "서울 강남구 논현로 45",
          categoryLabel: "카페",
          visibility: "confidential",
          metrics: {
            detailViews: 190,
            cardClicks: 44,
            mapClicks: 7,
            reservationClicks: 3,
            inquiryClicks: 1,
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
      setupVerificationCode: "URBAN-7782",
    }),
    company: {
      id: "mock-partner-company-urban-gym",
      name: "어반짐 역삼",
      slug: "urban-gym",
      description: "헬스와 PT 패키지를 운영하는 복합 피트니스 브랜드입니다.",
      contactName: "박지수",
      contactEmail: "admin@urbangym.example",
      contactPhone: "02-777-8811",
      services: [
        {
          id: "mock-partner-service-urban-gym-pt",
          name: "어반짐 PT 패키지",
          location: "서울 강남구 봉은사로 11",
          categoryLabel: "헬스",
          visibility: "public",
          metrics: {
            detailViews: 1560,
            cardClicks: 410,
            mapClicks: 74,
            reservationClicks: 126,
            inquiryClicks: 31,
            totalClicks: 641,
          },
        },
        {
          id: "mock-partner-service-urban-gym-sauna",
          name: "어반짐 사우나",
          location: "서울 강남구 봉은사로 11, B1",
          categoryLabel: "헬스",
          visibility: "confidential",
          metrics: {
            detailViews: 240,
            cardClicks: 56,
            mapClicks: 10,
            reservationClicks: 8,
            inquiryClicks: 3,
            totalClicks: 77,
          },
        },
      ],
    },
  },
];

export function cloneSetupRecord(setup: MockPortalSetupRecord): MockPortalSetupRecord {
  return {
    token: setup.token,
    account: { ...setup.account },
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
    demoVerificationCode: record.account.setupVerificationCode,
    isSetupComplete: Boolean(record.account.initialSetupCompletedAt),
  };
}
