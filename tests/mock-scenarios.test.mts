import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

type ScenarioModule = typeof import("../src/lib/mock/scenarios");

const scenarioModulePromise = import(
  new URL("../src/lib/mock/scenarios/index.ts", import.meta.url).href
) as Promise<ScenarioModule>;

const appDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/app",
);

function collectPageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const absolutePath = path.join(dir, entry);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      return collectPageFiles(absolutePath);
    }
    return entry === "page.tsx" ? [absolutePath] : [];
  });
}

function routePathFromPageFile(pageFile: string) {
  const relativePath = path.relative(appDir, path.dirname(pageFile));
  const routePath = relativePath
    .split(path.sep)
    .filter((part) => !part.startsWith("("))
    .join("/");

  return routePath.length === 0 ? "/" : `/${routePath}`;
}

test("route inventory covers every App Router page route", async () => {
  const { getMockRouteInventory } = await scenarioModulePromise;
  const inventoryRoutes = new Set(
    getMockRouteInventory().map((item) => item.routePath),
  );
  const pageRoutes = collectPageFiles(appDir)
    .map(routePathFromPageFile)
    .sort((left, right) => left.localeCompare(right));

  assert.deepStrictEqual(
    pageRoutes.filter((routePath) => !inventoryRoutes.has(routePath)),
    [],
  );
});

test("every route has at least one stable scenario id", async () => {
  const { getMockRouteInventory, getMockScenario } = await scenarioModulePromise;
  const inventory = getMockRouteInventory();

  assert.ok(inventory.length > 40);
  for (const route of inventory) {
    assert.ok(
      route.requiredScenarioIds.length > 0,
      `${route.routePath} has no required scenarios`,
    );
    for (const scenarioId of route.requiredScenarioIds) {
      assert.ok(getMockScenario(scenarioId), `${scenarioId} is not registered`);
    }
  }
});

test("scenario registry keeps synthetic data isolated from production-like identifiers", async () => {
  const { findMockScenarioPiiLeaks, listMockScenarios } =
    await scenarioModulePromise;
  const scenarios = listMockScenarios();

  assert.ok(scenarios.length >= 10);
  assert.deepStrictEqual(findMockScenarioPiiLeaks(scenarios), []);
  assert.equal(
    scenarios.every((scenario) => scenario.syntheticOnly),
    true,
  );
});

test("partner portal scenarios expose deterministic seeds for stories and local QA", async () => {
  const {
    getMockScenario,
    getMockScenarioSeed,
    listMockScenariosForRoute,
  } = await scenarioModulePromise;
  const dashboardScenarios = listMockScenariosForRoute(
    "/partner/companies/[companyId]",
  );

  assert.deepStrictEqual(
    dashboardScenarios.map((scenario) => scenario.id),
    [
      "partner.company.dashboard.cafe-ssafy-mixed-plans",
      "partner.company.dashboard.empty",
      "partner.company.dashboard.pending-review",
    ],
  );
  assert.equal(
    getMockScenario("partner.company.dashboard.cafe-ssafy-mixed-plans")?.label,
    "카페 싸피 운영 대시보드",
  );
  assert.deepStrictEqual(
    getMockScenarioSeed("partner.company.dashboard.cafe-ssafy-mixed-plans"),
    {
      accountId: "mock-partner-account-cafe-ssafy",
      companyIds: ["mock-partner-company-cafe-ssafy"],
      selectedCompanyId: "mock-partner-company-cafe-ssafy",
      partnerIds: [
        "mock-partner-service-cafe-ssafy-yeoksam",
        "mock-partner-service-cafe-ssafy-gangnam",
        "mock-partner-service-cafe-ssafy-samseong",
      ],
    },
  );
});

test("partner portal scenario adapters build fresh view props", async () => {
  const {
    getPartnerCompanySelectionMockScenario,
    getPartnerDashboardMockScenario,
  } = await scenarioModulePromise;

  const selection = getPartnerCompanySelectionMockScenario(
    "partner.company.selection.multi-company",
  );
  const dashboard = await getPartnerDashboardMockScenario(
    "partner.company.dashboard.cafe-ssafy-mixed-plans",
  );
  const emptyDashboard = await getPartnerDashboardMockScenario(
    "partner.company.dashboard.empty",
  );

  assert.equal(selection.session.loginId, "partner@cafessafy.example");
  assert.deepStrictEqual(selection.session.companyIds, [
    "mock-partner-company-cafe-ssafy",
    "mock-partner-company-urban-gym",
  ]);
  assert.deepStrictEqual(
    selection.companies.map((company) => company.name),
    ["카페 싸피", "어반짐 역삼"],
  );

  assert.equal(dashboard.selectedCompany.name, "카페 싸피");
  assert.equal(dashboard.dashboard.companies[0]?.services.length, 6);
  assert.equal(dashboard.dashboard.companies[0]?.services[0]?.metrics.detailUv, 0);
  assert.equal(dashboard.dashboard.companies[0]?.services[1]?.metrics.detailUv, 338);

  assert.equal(emptyDashboard.selectedCompany.name, "브랜드 미연결 협력사");
  assert.equal(emptyDashboard.dashboard.companies[0]?.services.length, 0);
  emptyDashboard.dashboard.companies[0]?.services.push(
    dashboard.dashboard.companies[0]!.services[0]!,
  );

  const freshEmptyDashboard = await getPartnerDashboardMockScenario(
    "partner.company.dashboard.empty",
  );
  assert.equal(freshEmptyDashboard.dashboard.companies[0]?.services.length, 0);
});

test("coverage matrix exposes route, scenario, storybook, and viewport traceability", async () => {
  const {
    buildMockCoverageMatrix,
    listMockStorybookScenarioCoverage,
    summarizeMockCoverageMatrix,
  } = await scenarioModulePromise;
  const matrix = buildMockCoverageMatrix();
  const summary = summarizeMockCoverageMatrix(matrix);

  assert.equal(summary.totalRoutes, 62);
  assert.equal(summary.scenarioCount, 46);
  assert.equal(summary.storybookStoryCount, 27);
  assert.equal(summary.storybookCompleteRoutes, 23);
  assert.equal(summary.storybookPartialRoutes, 0);
  assert.equal(summary.storybookMissingRoutes, 6);
  assert.equal(summary.routeInventoryOnlyRoutes, 33);

  const partnerSelection = matrix.find((row) => row.routePath === "/partner");
  assert.ok(partnerSelection);
  assert.equal(partnerSelection.coverageLevel, "storybook-complete");
  assert.deepStrictEqual(partnerSelection.missingStorybookScenarioIds, []);
  assert.deepStrictEqual(
    partnerSelection.storybookStories.map((story) => story.storyId),
    [
      "domains-partner-pagestates-companyselection--multi-company",
      "domains-partner-pagestates-companyselection--empty",
    ],
  );

  const registration = matrix.find(
    (row) => row.routePath === "/partner-registration",
  );
  assert.ok(registration);
  assert.equal(registration.coverageLevel, "storybook-complete");
  assert.deepStrictEqual(registration.missingStorybookScenarioIds, []);
  assert.deepStrictEqual(
    registration.storybookStories.map((story) => story.storyId),
    [
      "domains-partner-pagestates-core--registration-web-input",
      "domains-partner-pagestates-core--registration-excel-upload",
    ],
  );

  const adminCompanyBilling = matrix.find(
    (row) => row.routePath === "/admin/companies",
  );
  assert.ok(adminCompanyBilling);
  assert.equal(adminCompanyBilling.coverageLevel, "storybook-complete");
  assert.deepStrictEqual(adminCompanyBilling.missingStorybookScenarioIds, []);
  assert.deepStrictEqual(
    adminCompanyBilling.storybookStories.map((story) => story.storyId),
    ["domains-admin-pagestates--company-billing"],
  );

  const adminNotificationInbox = matrix.find(
    (row) => row.routePath === "/admin/notifications",
  );
  assert.ok(adminNotificationInbox);
  assert.equal(adminNotificationInbox.coverageLevel, "storybook-complete");
  assert.deepStrictEqual(
    adminNotificationInbox.storybookStories.map((story) => story.storyId),
    ["domains-admin-pagestates--notifications-inbox"],
  );

  const partnerNotifications = matrix.find(
    (row) => row.routePath === "/partner/companies/[companyId]/notifications",
  );
  assert.ok(partnerNotifications);
  assert.equal(partnerNotifications.coverageLevel, "storybook-complete");
  assert.deepStrictEqual(partnerNotifications.missingStorybookScenarioIds, []);

  const partnerSetup = matrix.find(
    (row) => row.routePath === "/partner/setup/[token]",
  );
  assert.ok(partnerSetup);
  assert.equal(partnerSetup.coverageLevel, "storybook-complete");

  for (const story of listMockStorybookScenarioCoverage()) {
    const row = matrix.find((item) => item.routePath === story.routePath);
    assert.ok(row, `${story.storyId} has no route row`);
    assert.ok(
      row.requiredScenarioIds.includes(story.scenarioId),
      `${story.storyId} references an unrelated scenario`,
    );
    assert.deepStrictEqual(story.viewportKeys, [
      "mobile-360",
      "tablet-820",
      "desktop-1366",
    ]);
  }
});

test("required state policy gives every route machine-readable QA states", async () => {
  const {
    buildMockCoverageMatrix,
    listMockRequiredStateDefinitions,
    requiredCaptureViewportKeys,
  } = await scenarioModulePromise;
  const knownStateKeys = new Set(
    listMockRequiredStateDefinitions().map((definition) => definition.key),
  );
  const matrix = buildMockCoverageMatrix();

  assert.deepStrictEqual(requiredCaptureViewportKeys, [
    "mobile-320",
    "mobile-360",
    "mobile-390",
    "tablet-768",
    "tablet-820",
    "desktop-1366",
    "desktop-1440",
    "desktop-1536",
  ]);

  for (const row of matrix) {
    assert.ok(row.requiredStateKeys.includes("default"));
    assert.ok(row.requiredStateKeys.includes("long-korean"));
    assert.ok(row.requiredStateKeys.includes("mobile-overflow"));
    for (const key of row.requiredStateKeys) {
      assert.ok(knownStateKeys.has(key), `${row.routePath} has unknown state ${key}`);
    }
  }

  const partnerPlan = matrix.find(
    (row) => row.routePath === "/partner/companies/[companyId]/plans",
  );
  assert.ok(partnerPlan);
  assert.ok(partnerPlan.requiredStateKeys.includes("locked-metric"));
  assert.ok(partnerPlan.requiredStateKeys.includes("payment-pending"));
  assert.ok(partnerPlan.requiredStateKeys.includes("billing-profile"));
  assert.ok(partnerPlan.requiredStateKeys.includes("unauthorized"));

  const redirect = matrix.find((row) => row.routePath === "/partner/plans");
  assert.ok(redirect);
  assert.equal(redirect.coverageLevel, "route-inventory-only");
  assert.ok(redirect.requiredStateKeys.includes("redirect"));
});

test("adoption policy requires scenarios only when the UI behavior surface changes", async () => {
  const {
    getMockScenarioAdoptionDecision,
    getMockScenarioNetworkMockingDecision,
    listMockScenarioAdoptionChangeKinds,
  } = await scenarioModulePromise;

  assert.deepStrictEqual(listMockScenarioAdoptionChangeKinds(), [
    "style-only",
    "copy-only",
    "new-route",
    "new-view",
    "new-data-branch",
    "new-auth-branch",
    "new-async-action",
    "new-form-validation",
    "new-media-flow",
    "new-pagination-flow",
  ]);

  assert.deepStrictEqual(getMockScenarioAdoptionDecision("copy-only"), {
    requiresScenario: false,
    requiresStorybookState: false,
    requiresCoverageMatrixUpdate: false,
    reason:
      "문구나 시각 polish만 바뀌고 새 상태/분기/데이터 계약이 없으면 기존 시나리오를 재사용합니다.",
  });
  assert.deepStrictEqual(getMockScenarioAdoptionDecision("new-pagination-flow"), {
    requiresScenario: true,
    requiresStorybookState: true,
    requiresCoverageMatrixUpdate: true,
    reason:
      "새 화면, 데이터 분기, 권한 분기, 비동기 동작, 폼 검증, 이미지, 페이지네이션은 재현 가능한 scenario/story coverage가 필요합니다.",
  });
  assert.deepStrictEqual(
    getMockScenarioNetworkMockingDecision({
      dataSources: ["repository", "service", "storybook"],
      exercisesClientFetch: false,
    }),
    {
      preferredStrategy: "scenario-adapter",
      requiresMsw: false,
      reason:
        "Repository/service/view props로 표현 가능한 상태는 scenario adapter를 우선 사용합니다.",
    },
  );
  assert.deepStrictEqual(
    getMockScenarioNetworkMockingDecision({
      dataSources: ["api-route", "storybook"],
      exercisesClientFetch: true,
    }),
    {
      preferredStrategy: "msw",
      requiresMsw: true,
      reason:
        "Storybook play/test에서 fetch, PATCH/DELETE, 더보기 같은 client API 상호작용을 실행하면 MSW로 응답을 고정합니다.",
    },
  );
});
