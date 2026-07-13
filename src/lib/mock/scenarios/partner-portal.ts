import type {
  PartnerPortalCompanyDashboard,
  PartnerPortalDashboard,
  PartnerPortalServiceMetrics,
} from "../../partner-dashboard.ts";
import type { PartnerPortalCompanyScope } from "../../partner-portal-scope.ts";
import type { PartnerSession } from "../../partner-session.ts";
import {
  buildMockPartnerPortalDashboardFromSetups,
} from "../partner-portal/dashboard.ts";
import {
  cloneSetupRecord,
  seededSetups,
  type MockPortalSetupRecord,
} from "../partner-portal/shared.ts";
import { mockScenarios, type MockScenarioId } from "./registry.ts";
import type { MockScenarioSeed } from "./types.ts";

const STORY_NOW = Date.UTC(2026, 6, 5, 9, 0, 0);

type PartnerCompanySelectionScenarioId = Extract<
  MockScenarioId,
  "partner.company.selection.multi-company" | "partner.company.selection.empty"
>;

type PartnerDashboardScenarioId = Extract<
  MockScenarioId,
  | "partner.company.dashboard.cafe-ssafy-mixed-plans"
  | "partner.company.dashboard.empty"
  | "partner.company.dashboard.pending-review"
>;

type PartnerCompanySelectionMockScenario = {
  scenarioId: PartnerCompanySelectionScenarioId;
  session: PartnerSession;
  companies: PartnerPortalCompanyScope[];
};

type PartnerDashboardMockScenario = {
  scenarioId: PartnerDashboardScenarioId;
  session: PartnerSession;
  selectedCompany: PartnerPortalCompanyScope;
  dashboard: PartnerPortalDashboard;
};

type ReadonlyMockScenarioSeed = {
  readonly accountId?: string;
  readonly companyIds?: readonly string[];
  readonly selectedCompanyId?: string;
  readonly partnerIds?: readonly string[];
  readonly routeParams?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, string>>;
};

const emptyMetrics = (): PartnerPortalServiceMetrics => ({
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

function getSeededSetupByCompanyId(companyId: string) {
  return seededSetups.find((setup) => setup.company.id === companyId) ?? null;
}

function getSeededSetupByAccountId(accountId: string) {
  return seededSetups.find((setup) => setup.account.id === accountId) ?? null;
}

function toSession({
  accountId,
  companyIds,
}: {
  accountId: string;
  companyIds: string[];
}): PartnerSession {
  const setup = getSeededSetupByAccountId(accountId);
  return {
    accountId,
    loginId: setup?.account.loginId ?? "partner-empty@example",
    displayName: setup?.account.displayName ?? "테스트 파트너",
    companyIds: [...companyIds],
    mustChangePassword: false,
    issuedAt: STORY_NOW,
    expiresAt: STORY_NOW + 7 * 24 * 60 * 60 * 1000,
  };
}

function toCompanyScope(setup: MockPortalSetupRecord): PartnerPortalCompanyScope {
  return {
    id: setup.company.id,
    name: setup.company.name,
    slug: setup.company.slug,
    description: setup.company.description ?? null,
    serviceCount: setup.company.services.length,
  };
}

function createEmptyCompanyScope(): PartnerPortalCompanyScope {
  return {
    id: "mock-partner-company-empty",
    name: "제휴처 미연결 파트너사",
    slug: "empty-company",
    description: "아직 등록된 제휴처가 없어 제휴처 추가 신청부터 시작하는 상태입니다.",
    serviceCount: 0,
  };
}

function createEmptyCompanyDashboard(): PartnerPortalCompanyDashboard {
  const company = createEmptyCompanyScope();
  return {
    ...company,
    services: [],
    totals: emptyMetrics(),
  };
}

function createEmptyDashboard(): PartnerPortalDashboard {
  return {
    companies: [createEmptyCompanyDashboard()],
    totals: {
      ...emptyMetrics(),
      companyCount: 1,
      serviceCount: 0,
    },
    warningMessage: null,
  };
}

function getCompanySetups(companyIds: string[]) {
  return companyIds
    .map((companyId) => getSeededSetupByCompanyId(companyId))
    .filter((setup): setup is MockPortalSetupRecord => Boolean(setup))
    .map(cloneSetupRecord);
}

function getScenarioSeed(scenarioId: MockScenarioId): MockScenarioSeed {
  const scenario = mockScenarios.find((item) => item.id === scenarioId);
  if (!scenario) {
    throw new Error(`Unknown mock scenario: ${scenarioId}`);
  }
  const seed = (
    "seed" in scenario ? scenario.seed : undefined
  ) as ReadonlyMockScenarioSeed | undefined;
  return {
    ...(seed?.accountId ? { accountId: seed.accountId } : {}),
    ...(seed?.companyIds ? { companyIds: [...seed.companyIds] } : {}),
    ...(seed?.selectedCompanyId
      ? { selectedCompanyId: seed.selectedCompanyId }
      : {}),
    ...(seed?.partnerIds ? { partnerIds: [...seed.partnerIds] } : {}),
    ...(seed?.routeParams ? { routeParams: { ...seed.routeParams } } : {}),
    ...(seed?.query ? { query: { ...seed.query } } : {}),
  };
}

export function getPartnerCompanySelectionMockScenario(
  scenarioId: PartnerCompanySelectionScenarioId,
): PartnerCompanySelectionMockScenario {
  const seed = getScenarioSeed(scenarioId);
  const accountId = seed.accountId ?? "mock-partner-account-empty";
  const companyIds = seed.companyIds ?? [];
  const setups = getCompanySetups(companyIds);

  return {
    scenarioId,
    session: toSession({ accountId, companyIds }),
    companies:
      scenarioId === "partner.company.selection.empty"
        ? []
        : setups.map(toCompanyScope),
  };
}

export function getPartnerDashboardMockScenario(
  scenarioId: PartnerDashboardScenarioId,
): PartnerDashboardMockScenario {
  const seed = getScenarioSeed(scenarioId);
  const accountId = seed.accountId ?? "mock-partner-account-cafe-ssafy";
  const companyIds = seed.companyIds ?? [];

  if (scenarioId === "partner.company.dashboard.empty") {
    const selectedCompany = createEmptyCompanyScope();
    return {
      scenarioId,
      session: toSession({ accountId, companyIds }),
      selectedCompany,
      dashboard: createEmptyDashboard(),
    };
  }

  const setups = getCompanySetups(companyIds);
  const dashboard = buildMockPartnerPortalDashboardFromSetups(setups);
  const selectedCompanySetup =
    setups.find((setup) => setup.company.id === seed.selectedCompanyId) ??
    setups[0];

  return {
    scenarioId,
    session: toSession({ accountId, companyIds }),
    selectedCompany: selectedCompanySetup
      ? toCompanyScope(selectedCompanySetup)
      : createEmptyCompanyScope(),
    dashboard,
  };
}
