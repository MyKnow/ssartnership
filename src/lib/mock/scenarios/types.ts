export type MockScenarioSurface = "public" | "auth" | "admin" | "partner";

export type MockScenarioDataSource =
  | "repository"
  | "service"
  | "storybook"
  | "api-route"
  | "redirect";

export type MockViewportKey =
  | "mobile-320"
  | "mobile-360"
  | "mobile-390"
  | "tablet-768"
  | "tablet-820"
  | "desktop-1366"
  | "desktop-1440"
  | "desktop-1536";

export type MockRequiredStateKey =
  | "default"
  | "empty"
  | "many"
  | "loading"
  | "error"
  | "validation-error"
  | "unauthorized"
  | "forbidden"
  | "expired"
  | "pending"
  | "rejected"
  | "success"
  | "redirect"
  | "long-korean"
  | "long-url"
  | "mobile-overflow"
  | "image-gallery"
  | "broken-image"
  | "async-pending"
  | "pagination"
  | "filter"
  | "locked-metric"
  | "payment-pending"
  | "billing-profile"
  | "setup-token";

export type MockCoverageLevel =
  | "storybook-complete"
  | "storybook-partial"
  | "storybook-missing"
  | "route-inventory-only";

export type MockScenarioSeed = {
  accountId?: string;
  companyIds?: string[];
  selectedCompanyId?: string;
  partnerIds?: string[];
  routeParams?: Record<string, string>;
  query?: Record<string, string>;
};

export type MockScenario = {
  id: string;
  label: string;
  surface: MockScenarioSurface;
  description: string;
  syntheticOnly: true;
  dataSources: MockScenarioDataSource[];
  requiredStates: string[];
  seed?: MockScenarioSeed;
};

export type MockRouteInventoryItem = {
  routePath: string;
  surface: MockScenarioSurface;
  authScope:
    | "public"
    | "member"
    | "admin"
    | "partner"
    | "setup-token";
  viewComponent: string;
  dataSources: MockScenarioDataSource[];
  requiredScenarioIds: string[];
  notes?: string;
};

export type MockStorybookScenarioCoverage = {
  routePath: string;
  scenarioId: string;
  storyId: string;
  storyFile: string;
  viewportKeys: MockViewportKey[];
};

export type MockCoverageMatrixRow = {
  routePath: string;
  surface: MockScenarioSurface;
  authScope: MockRouteInventoryItem["authScope"];
  viewComponent: string;
  dataSources: MockScenarioDataSource[];
  requiredScenarioIds: string[];
  requiredStateKeys: MockRequiredStateKey[];
  viewportKeys: MockViewportKey[];
  storybookStories: MockStorybookScenarioCoverage[];
  missingStorybookScenarioIds: string[];
  coverageLevel: MockCoverageLevel;
};

export type MockCoverageSummary = {
  totalRoutes: number;
  scenarioCount: number;
  storybookCompleteRoutes: number;
  storybookPartialRoutes: number;
  storybookMissingRoutes: number;
  routeInventoryOnlyRoutes: number;
  storybookStoryCount: number;
};

export type MockScenarioPiiLeak = {
  scenarioId: string;
  path: string;
  value: string;
  reason: string;
};
