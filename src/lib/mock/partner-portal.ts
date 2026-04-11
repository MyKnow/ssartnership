import {
  generateTempPassword,
  hashPassword,
  isValidPassword,
  verifyPassword,
} from "../password.ts";
import { normalizePartnerLoginId } from "../partner-utils.ts";
import type {
  PartnerPortalCompanyDashboard,
  PartnerPortalDashboard,
  PartnerPortalServiceDashboard,
  PartnerPortalServiceMetrics,
} from "../partner-dashboard.ts";
import {
  type PartnerPortalAccountSummary,
  type PartnerPortalCompanySummary,
  type PartnerPortalDemoSetupSummary,
  type PartnerPortalRepository,
  type PartnerPortalLoginResult,
  type PartnerPortalPasswordChangeResult,
  type PartnerPortalPasswordResetResult,
  type PartnerPortalSetupContext,
  type PartnerPortalSetupInput,
  type PartnerPortalSetupResult,
} from "../partner-portal.ts";
import {
  PartnerPortalSetupError,
  PartnerPortalLoginError,
} from "../partner-portal-errors.ts";
import {
  PartnerPortalPasswordChangeError,
  PartnerPortalPasswordResetError,
} from "../partner-password-errors.ts";

type MockPortalAccountRecord = PartnerPortalAccountSummary & {
  passwordHash: string;
  passwordSalt: string;
  setupToken: string;
  setupVerificationCode: string;
  lastLoginAt: string | null;
  emailVerifiedAt: string | null;
  initialSetupCompletedAt: string | null;
};

type MockPortalServiceRecord = PartnerPortalServiceDashboard;

type MockPortalCompanyRecord = Omit<PartnerPortalCompanySummary, "services"> & {
  services: MockPortalServiceRecord[];
};

type MockPortalSetupRecord = {
  token: string;
  account: MockPortalAccountRecord;
  company: MockPortalCompanyRecord;
};

type MockPortalStore = {
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

const seededSetups: MockPortalSetupRecord[] = [
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

const globalScope = globalThis as typeof globalThis & {
  __mockPartnerPortalStore?: MockPortalStore;
};

function getStore() {
  if (!globalScope.__mockPartnerPortalStore) {
    globalScope.__mockPartnerPortalStore = {
      setups: seededSetups.map((setup) => ({
        token: setup.token,
        account: { ...setup.account },
        company: {
          ...setup.company,
          services: setup.company.services.map((service) => ({
            ...service,
            metrics: { ...service.metrics },
          })),
        },
      })),
    };
  }

  return globalScope.__mockPartnerPortalStore;
}

export function resetMockPartnerPortalStore() {
  delete globalScope.__mockPartnerPortalStore;
}

function toContext(record: MockPortalSetupRecord): PartnerPortalSetupContext {
  return {
    token: record.token,
    account: {
      id: record.account.id,
      loginId: record.account.loginId,
      displayName: record.account.displayName,
      email: record.account.email,
      mustChangePassword: record.account.mustChangePassword,
      emailVerifiedAt: record.account.emailVerifiedAt,
      initialSetupCompletedAt: record.account.initialSetupCompletedAt,
      isActive: record.account.isActive,
    },
    company: {
      id: record.company.id,
      name: record.company.name,
      slug: record.company.slug,
      description: record.company.description ?? null,
      contactName: record.company.contactName ?? null,
      contactEmail: record.company.contactEmail ?? null,
      contactPhone: record.company.contactPhone ?? null,
      services: record.company.services.map((service) => ({
        id: service.id,
        name: service.name,
        location: service.location,
        categoryLabel: service.categoryLabel,
        visibility: service.visibility,
      })),
    },
    demoVerificationCode: record.account.setupVerificationCode,
    isSetupComplete: Boolean(record.account.initialSetupCompletedAt),
    isMock: true,
  };
}

function findSetup(token: string) {
  return getStore().setups.find((setup) => setup.token === token) ?? null;
}

function cloneSetupSummary(record: MockPortalSetupRecord): PartnerPortalDemoSetupSummary {
  return {
    token: record.token,
    companyName: record.company.name,
    loginId: record.account.loginId,
    serviceCount: record.company.services.length,
    demoVerificationCode: record.account.setupVerificationCode,
    isSetupComplete: Boolean(record.account.initialSetupCompletedAt),
  };
}

export async function listMockPartnerPortalSetups() {
  return getStore().setups.map(cloneSetupSummary);
}

export async function getMockPartnerPortalSetupContext(token: string) {
  const setup = findSetup(token);
  if (!setup) {
    return null;
  }
  return toContext(setup);
}

export async function completeMockPartnerPortalInitialSetup(
  input: PartnerPortalSetupInput,
): Promise<PartnerPortalSetupResult> {
  const setup = findSetup(input.token);
  if (!setup) {
    throw new PartnerPortalSetupError(
      "not_found",
      "초기 설정 링크를 찾을 수 없습니다.",
    );
  }

  if (setup.account.initialSetupCompletedAt) {
    throw new PartnerPortalSetupError(
      "already_completed",
      "이미 초기 설정이 완료되었습니다.",
    );
  }

  if (input.verificationCode.trim() !== setup.account.setupVerificationCode) {
    throw new PartnerPortalSetupError(
      "invalid_code",
      "이메일 인증 코드가 올바르지 않습니다.",
    );
  }

  if (input.password !== input.confirmPassword) {
    throw new PartnerPortalSetupError(
      "password_mismatch",
      "비밀번호 확인이 일치하지 않습니다.",
    );
  }

  if (!isValidPassword(input.password)) {
    throw new PartnerPortalSetupError(
      "invalid_password",
      "비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.",
    );
  }

  const passwordRecord = hashPassword(input.password);
  const completedAt = new Date().toISOString();

  setup.account.passwordHash = passwordRecord.hash;
  setup.account.passwordSalt = passwordRecord.salt;
  setup.account.mustChangePassword = false;
  setup.account.emailVerifiedAt = completedAt;
  setup.account.initialSetupCompletedAt = completedAt;
  setup.account.isActive = true;

  return {
    token: setup.token,
    accountId: setup.account.id,
    companyId: setup.company.id,
    loginId: setup.account.loginId,
    completedAt,
  };
}

export async function authenticateMockPartnerPortalLogin(
  loginId: string,
  password: string,
): Promise<PartnerPortalLoginResult> {
  const normalizedLoginId = normalizePartnerLoginId(loginId);
  const setup = getStore().setups.find(
    (item) => normalizePartnerLoginId(item.account.loginId) === normalizedLoginId,
  );

  if (!setup) {
    throw new PartnerPortalLoginError(
      "invalid_credentials",
      "이메일 또는 비밀번호가 올바르지 않습니다.",
    );
  }

  if (!setup.account.isActive) {
    throw new PartnerPortalLoginError(
      "inactive_account",
      "비활성화된 계정입니다. 관리자에게 문의해 주세요.",
    );
  }

  if (setup.account.mustChangePassword && !setup.account.initialSetupCompletedAt) {
    throw new PartnerPortalLoginError(
      "setup_required",
      "초기 설정이 필요합니다. 받은 링크로 먼저 비밀번호를 설정해 주세요.",
    );
  }

  const ok = verifyPassword(
    password,
    setup.account.passwordSalt,
    setup.account.passwordHash,
  );
  if (!ok) {
    throw new PartnerPortalLoginError(
      "invalid_credentials",
      "이메일 또는 비밀번호가 올바르지 않습니다.",
    );
  }

  const completedAt = new Date().toISOString();
  setup.account.lastLoginAt = completedAt;

  return {
    account: {
      id: setup.account.id,
      loginId: setup.account.loginId,
      displayName: setup.account.displayName,
      email: setup.account.email,
      mustChangePassword: setup.account.mustChangePassword,
      emailVerifiedAt: setup.account.emailVerifiedAt,
      initialSetupCompletedAt: setup.account.initialSetupCompletedAt,
      isActive: setup.account.isActive,
    },
    companyIds: [setup.company.id],
  };
}

function findAccountByEmail(email: string) {
  const normalized = normalizePartnerLoginId(email);
  return (
    getStore().setups.find(
      (item) =>
        normalizePartnerLoginId(item.account.loginId) === normalized ||
        normalizePartnerLoginId(item.account.email) === normalized,
    ) ?? null
  );
}

export async function requestMockPartnerPortalPasswordReset(
  email: string,
): Promise<PartnerPortalPasswordResetResult> {
  const setup = findAccountByEmail(email);
  if (!setup) {
    throw new PartnerPortalPasswordResetError(
      "not_found",
      "해당 이메일로 등록된 계정을 찾을 수 없습니다.",
    );
  }
  if (!setup.account.isActive) {
    throw new PartnerPortalPasswordResetError(
      "inactive_account",
      "비활성화된 계정입니다. 관리자에게 문의해 주세요.",
    );
  }
  if (!setup.account.initialSetupCompletedAt) {
    throw new PartnerPortalPasswordResetError(
      "setup_required",
      "아직 초기 설정이 완료되지 않았습니다. 초기 설정 링크를 먼저 사용해 주세요.",
    );
  }

  const temporaryPassword = generateTempPassword(12);
  const passwordRecord = hashPassword(temporaryPassword);
  const emailVerifiedAt = new Date().toISOString();

  setup.account.passwordHash = passwordRecord.hash;
  setup.account.passwordSalt = passwordRecord.salt;
  setup.account.mustChangePassword = true;
  setup.account.emailVerifiedAt = emailVerifiedAt;

  return {
    account: {
      id: setup.account.id,
      loginId: setup.account.loginId,
      displayName: setup.account.displayName,
      email: setup.account.email,
      mustChangePassword: true,
      emailVerifiedAt: emailVerifiedAt,
      initialSetupCompletedAt: setup.account.initialSetupCompletedAt,
      isActive: setup.account.isActive,
    },
    temporaryPassword,
    emailSentTo: setup.account.email,
  };
}

export async function changeMockPartnerPortalPassword(input: {
  accountId: string;
  currentPassword: string;
  nextPassword: string;
}): Promise<PartnerPortalPasswordChangeResult> {
  const setup = getStore().setups.find(
    (item) => item.account.id === input.accountId,
  );

  if (!setup || !setup.account.isActive) {
    throw new PartnerPortalPasswordChangeError(
      "unauthorized",
      "로그인 후 다시 시도해 주세요.",
    );
  }

  const ok = verifyPassword(
    input.currentPassword,
    setup.account.passwordSalt,
    setup.account.passwordHash,
  );
  if (!ok) {
    throw new PartnerPortalPasswordChangeError(
      "wrong_password",
      "현재 비밀번호가 올바르지 않습니다.",
    );
  }

  if (!isValidPassword(input.nextPassword)) {
    throw new PartnerPortalPasswordChangeError(
      "invalid_password",
      "비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.",
    );
  }

  const passwordRecord = hashPassword(input.nextPassword);
  setup.account.passwordHash = passwordRecord.hash;
  setup.account.passwordSalt = passwordRecord.salt;
  setup.account.mustChangePassword = false;

  return {
    account: {
      id: setup.account.id,
      loginId: setup.account.loginId,
      displayName: setup.account.displayName,
      email: setup.account.email,
      mustChangePassword: false,
      emailVerifiedAt: setup.account.emailVerifiedAt,
      initialSetupCompletedAt: setup.account.initialSetupCompletedAt,
      isActive: setup.account.isActive,
    },
    companyIds: [setup.company.id],
  };
}

function cloneMetrics(metrics: PartnerPortalServiceMetrics) {
  return {
    detailViews: metrics.detailViews,
    cardClicks: metrics.cardClicks,
    mapClicks: metrics.mapClicks,
    reservationClicks: metrics.reservationClicks,
    inquiryClicks: metrics.inquiryClicks,
    totalClicks: metrics.totalClicks,
  };
}

function normalizeMetrics(
  metrics?: Partial<PartnerPortalServiceMetrics> | null,
): PartnerPortalServiceMetrics {
  return {
    detailViews: metrics?.detailViews ?? 0,
    cardClicks: metrics?.cardClicks ?? 0,
    mapClicks: metrics?.mapClicks ?? 0,
    reservationClicks: metrics?.reservationClicks ?? 0,
    inquiryClicks: metrics?.inquiryClicks ?? 0,
    totalClicks: metrics?.totalClicks ?? 0,
  };
}

function sumMetrics(records: PartnerPortalServiceMetrics[]) {
  return records.reduce<PartnerPortalServiceMetrics>(
    (accumulator, metrics) => ({
      detailViews: accumulator.detailViews + metrics.detailViews,
      cardClicks: accumulator.cardClicks + metrics.cardClicks,
      mapClicks: accumulator.mapClicks + metrics.mapClicks,
      reservationClicks:
        accumulator.reservationClicks + metrics.reservationClicks,
      inquiryClicks: accumulator.inquiryClicks + metrics.inquiryClicks,
      totalClicks: accumulator.totalClicks + metrics.totalClicks,
    }),
    {
      detailViews: 0,
      cardClicks: 0,
      mapClicks: 0,
      reservationClicks: 0,
      inquiryClicks: 0,
      totalClicks: 0,
    },
  );
}

function toDashboardCompany(
  record: MockPortalSetupRecord,
): PartnerPortalCompanyDashboard {
  return {
    id: record.company.id,
    name: record.company.name,
    slug: record.company.slug,
    description: record.company.description ?? null,
    contactName: record.company.contactName ?? null,
    contactEmail: record.company.contactEmail ?? null,
    contactPhone: record.company.contactPhone ?? null,
    services: record.company.services.map((service) => ({
      id: service.id,
      name: service.name,
      location: service.location,
      categoryLabel: service.categoryLabel,
      visibility: service.visibility,
      metrics: cloneMetrics(normalizeMetrics(service.metrics)),
    })),
    totals: sumMetrics(
      record.company.services.map((service) => normalizeMetrics(service.metrics)),
    ),
  };
}

export async function getMockPartnerPortalDashboard(
  companyIds: string[],
): Promise<PartnerPortalDashboard> {
  const uniqueCompanyIds = [...new Set(companyIds.map((id) => id.trim()).filter(Boolean))];
  const companies = getStore()
    .setups.filter((setup) => uniqueCompanyIds.includes(setup.company.id))
    .map((setup) => toDashboardCompany(setup));

  const totals = sumMetrics(companies.map((company) => company.totals));
  return {
    companies,
    totals: {
      ...totals,
      companyCount: companies.length,
      serviceCount: companies.reduce(
        (count, company) => count + company.services.length,
        0,
      ),
    },
  };
}

export const mockPartnerPortalRepository: PartnerPortalRepository = {
  async listDemoSetups() {
    return listMockPartnerPortalSetups();
  },

  async getSetupContext(token: string) {
    return getMockPartnerPortalSetupContext(token);
  },

  async completeInitialSetup(input: PartnerPortalSetupInput) {
    return completeMockPartnerPortalInitialSetup(input);
  },
};

export const mockPartnerPortalSetupTokens = seededSetups.map((setup) => ({
  token: setup.token,
  companyName: setup.company.name,
  loginId: setup.account.loginId,
  serviceCount: setup.company.services.length,
  demoVerificationCode: setup.account.setupVerificationCode,
}));
