import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

type ScenarioModule = typeof import("../src/lib/mock/scenarios");

const scenarioModulePromise = import(
  new URL("../src/lib/mock/scenarios/index.ts", import.meta.url).href
) as Promise<ScenarioModule>;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(repoRoot, "src/app");
const screenSpecsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../docs/product/screen-specs",
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

  assert.deepStrictEqual([...inventoryRoutes].sort(), pageRoutes);
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

test("route inventory classifies IA purpose and declares screen contracts", async () => {
  const { getMockRouteInventory } = await scenarioModulePromise;
  const inventory = getMockRouteInventory();
  const knownRouteKinds = new Set([
    "canonical",
    "conditional",
    "compat-redirect",
    "mock-only",
  ]);

  for (const route of inventory) {
    assert.ok(
      knownRouteKinds.has(route.routeKind),
      `${route.routePath} has unknown route kind ${route.routeKind}`,
    );
    assert.ok(route.primaryTask.trim().length > 0, `${route.routePath} has no primary task`);
    assert.ok(
      route.requiredStateKeys.length > 0,
      `${route.routePath} has no required state keys`,
    );

    if (route.routeKind === "canonical") {
      assert.ok(
        route.screenContractId?.trim(),
        `${route.routePath} canonical route has no screen contract`,
      );
    }
    if (route.routeKind === "compat-redirect") {
      assert.deepStrictEqual(route.requiredStateKeys, ["redirect"]);
      assert.ok(route.dataSources.includes("redirect"));
    }
  }

  assert.equal(
    inventory.find((route) => route.routePath === "/")?.routeKind,
    "canonical",
  );
  assert.equal(
    inventory.find((route) => route.routePath === "/admin/members/mock")
      ?.routeKind,
    "mock-only",
  );
  assert.equal(
    inventory.find((route) => route.routePath === "/admin/promotions")
      ?.routeKind,
    "compat-redirect",
  );
});

test("every canonical route is backed by a decision-complete screen contract", async () => {
  const { getMockRouteInventory } = await scenarioModulePromise;
  const canonicalContracts = getMockRouteInventory()
    .filter((route) => route.routeKind === "canonical")
    .map((route) => route.screenContractId);
  const screenSpecText = readdirSync(screenSpecsDir)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => readFileSync(path.join(screenSpecsDir, fileName), "utf8"))
    .join("\n");

  for (const contractId of canonicalContracts) {
    assert.ok(contractId);
    assert.ok(
      screenSpecText.includes(`<!-- screen-contract: ${contractId} -->`),
      `${contractId} is missing from docs/product/screen-specs`,
    );
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

  assert.equal(emptyDashboard.selectedCompany.name, "제휴처 미연결 파트너사");
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

  assert.equal(summary.totalRoutes, collectPageFiles(appDir).length);
  assert.ok(summary.scenarioCount >= 50);
  assert.ok(summary.storybookStoryCount >= 102);
  assert.ok(summary.storybookCompleteRoutes >= 6);
  assert.ok(summary.storybookPartialRoutes >= 30);
  assert.ok(summary.storybookReferenceOnlyRoutes >= 2);
  assert.equal(summary.storybookMissingRoutes, 0);
  assert.equal(
    summary.storybookCompleteRoutes +
      summary.storybookPartialRoutes +
      summary.storybookReferenceOnlyRoutes +
      summary.storybookMissingRoutes +
      summary.routeInventoryOnlyRoutes,
    summary.totalRoutes,
  );

  const partnerSelection = matrix.find((row) => row.routePath === "/partner");
  assert.ok(partnerSelection);
  assert.equal(partnerSelection.coverageLevel, "storybook-partial");
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
      "domains-partnerregistration-actualview--web-input",
      "domains-partnerregistration-actualview--excel-disclosure",
      "domains-partnerregistration-actualview--validation-error",
      "domains-partnerregistration-actualview--image-gallery",
      "domains-partnerregistration-actualview--long-korean-content",
      "domains-partnerregistration-actualview--broken-image",
      "domains-partnerregistration-actualview--action-success",
      "domains-partnerregistration-actualview--action-error",
      "domains-partnerregistration-actualview--async-pending",
    ],
  );

  const completePartnerDashboard = matrix.find(
    (row) => row.routePath === "/partner/companies/[companyId]",
  );
  assert.ok(completePartnerDashboard);
  assert.equal(completePartnerDashboard.coverageLevel, "storybook-complete");
  assert.deepStrictEqual(completePartnerDashboard.missingActualViewStateKeys, []);

  const adminCompanyBilling = matrix.find(
    (row) => row.routePath === "/admin/companies",
  );
  assert.ok(adminCompanyBilling);
  assert.equal(adminCompanyBilling.coverageLevel, "storybook-partial");
  assert.deepStrictEqual(adminCompanyBilling.missingStorybookScenarioIds, []);
  assert.deepStrictEqual(
    adminCompanyBilling.storybookStories.map((story) => story.storyId),
    ["domains-admin-admincompaniesview--default"],
  );

  const adminNotificationInbox = matrix.find(
    (row) => row.routePath === "/admin/notifications",
  );
  assert.ok(adminNotificationInbox);
  assert.equal(adminNotificationInbox.coverageLevel, "storybook-partial");
  assert.deepStrictEqual(
    adminNotificationInbox.storybookStories.map((story) => story.storyId),
    ["domains-admin-adminnotificationsview--default"],
  );

  const partnerNotifications = matrix.find(
    (row) => row.routePath === "/partner/notifications",
  );
  assert.ok(partnerNotifications);
  assert.equal(
    partnerNotifications.coverageLevel,
    "storybook-partial",
  );
  assert.deepStrictEqual(partnerNotifications.missingStorybookScenarioIds, []);

  const partnerSetup = matrix.find(
    (row) => row.routePath === "/partner/setup/[token]",
  );
  assert.ok(partnerSetup);
  assert.equal(partnerSetup.coverageLevel, "storybook-reference-only");

  for (const story of listMockStorybookScenarioCoverage()) {
    const row = matrix.find((item) => item.routePath === story.routePath);
    assert.ok(row, `${story.storyId} has no route row`);
    assert.ok(
      row.requiredScenarioIds.includes(story.scenarioId),
      `${story.storyId} references an unrelated scenario`,
    );
    assert.ok(story.coveredStateKeys.length > 0);
    assert.ok(
      ["actual-view", "component-fragment", "state-model"].includes(
        story.renderKind,
      ),
    );
    assert.deepStrictEqual(story.viewportKeys, [
      "mobile-360",
      "tablet-820",
      "desktop-1366",
    ]);

    const storySource = readFileSync(path.join(repoRoot, story.storyFile), "utf8");
    if (story.renderKind === "actual-view") {
      assert.ok(
        story.actualViewComponent,
        `${story.storyId} has no actual view component`,
      );
      const escapedViewComponent = story.actualViewComponent.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );
      assert.match(
        storySource,
        new RegExp(
          `(?:component:\\s*|<|function\\s+)${escapedViewComponent}\\b`,
        ),
        `${story.storyId} is marked actual-view but does not render ${story.actualViewComponent}`,
      );
    }
  }

  for (const row of matrix) {
    assert.deepStrictEqual(
      row.stateStoryTrace.map((trace) => trace.stateKey),
      row.requiredStateKeys,
      `${row.routePath} state trace is incomplete`,
    );
    if (row.coverageLevel === "storybook-complete") {
      assert.equal(
        row.stateStoryTrace.every(
          (trace) =>
            trace.status === "actual-view" &&
            trace.missingViewportKeys.length === 0,
        ),
        true,
      );
    }
  }

  const syntheticCompanyBilling = matrix.find(
    (row) => row.routePath === "/admin/companies",
  );
  assert.ok(syntheticCompanyBilling);
  assert.equal(
    syntheticCompanyBilling.storybookStories[0]?.renderKind,
    "actual-view",
  );
  assert.notEqual(
    syntheticCompanyBilling.coverageLevel,
    "storybook-complete",
  );

  const partnerDashboard = matrix.find(
    (row) => row.routePath === "/partner/companies/[companyId]",
  );
  assert.ok(partnerDashboard);
  assert.equal(partnerDashboard.storybookStories[0]?.renderKind, "actual-view");
  assert.equal(
    partnerDashboard.stateStoryTrace.find((trace) => trace.stateKey === "default")
      ?.status,
    "actual-view",
  );
});

test("canonical partner screens expose default actual-view stories at every required viewport", async () => {
  const { buildMockCoverageMatrix } = await scenarioModulePromise;
  const matrix = buildMockCoverageMatrix();
  const expectedActualViews = new Map([
    ["/partner/account", "PartnerAccountScreen"],
    ["/partner/companies/[companyId]/plans", "PartnerPlanScreen"],
    [
      "/partner/companies/[companyId]/services/[partnerId]",
      "PartnerServiceDetailView",
    ],
    ["/partner/companies/[companyId]/services/new", "PartnerServiceNewScreen"],
    ["/partner/login", "PartnerLoginScreen"],
    ["/partner/notifications", "PartnerNotificationsScreen"],
    ["/partner/reset", "PartnerResetScreen"],
    ["/partner/support", "PartnerSupportScreen"],
  ]);

  for (const [routePath, actualViewComponent] of expectedActualViews) {
    const route = matrix.find((row) => row.routePath === routePath);
    assert.ok(route, `${routePath} must exist in the route coverage matrix`);
    const defaultActualView = route.storybookStories.find(
      (story) =>
        story.renderKind === "actual-view" &&
        story.actualViewComponent === actualViewComponent &&
        story.coveredStateKeys.includes("default"),
    );
    assert.ok(
      defaultActualView,
      `${routePath} must expose a default actual-view story for ${actualViewComponent}`,
    );
    assert.deepStrictEqual(defaultActualView.viewportKeys, [
      "mobile-360",
      "tablet-820",
      "desktop-1366",
    ]);
  }
});

test("canonical admin screens expose default actual-view stories at every required viewport", async () => {
  const { buildMockCoverageMatrix } = await scenarioModulePromise;
  const matrix = buildMockCoverageMatrix();
  const expectedActualViews = new Map([
    ["/admin", "AdminDashboardView"],
    ["/admin/admins", "AdminAccountsView"],
    ["/admin/advertisement", "AdminAdvertisementView"],
    ["/admin/companies", "AdminCompaniesView"],
    ["/admin/categories", "AdminCategoryManager"],
    ["/admin/cycle", "AdminCycleView"],
    ["/admin/event", "AdminEventListView"],
    ["/admin/event/[slug]", "AdminEventDetailView"],
    ["/admin/logs", "AdminLogsManager"],
    ["/admin/graduate-verifications", "AdminGraduateVerificationQueue"],
    ["/admin/profile-photos", "AdminProfilePhotoReviewQueue"],
    ["/admin/members", "AdminMemberManager"],
    ["/admin/members/[memberId]", "AdminMemberDetailView"],
    ["/admin/notifications", "AdminNotificationsView"],
    ["/admin/partner-registrations", "AdminPartnerRegistrationsView"],
    ["/admin/partner-requests", "PartnerChangeRequestQueue"],
    ["/admin/partners", "AdminPartnerManager"],
    ["/admin/partners/[partnerId]", "PartnerCardForm"],
    ["/admin/partners/new", "AdminPartnerNewView"],
    ["/admin/push", "AdminPushManager"],
    ["/admin/reviews", "AdminReviewManagerView"],
  ]);
  const canonicalAdminRoutes = matrix.filter(
    (route) => route.surface === "admin" && route.routeKind === "canonical",
  );

  assert.equal(canonicalAdminRoutes.length, expectedActualViews.size);
  assert.deepStrictEqual(
    canonicalAdminRoutes.map((route) => route.routePath).sort(),
    [...expectedActualViews.keys()].sort(),
  );

  for (const [routePath, actualViewComponent] of expectedActualViews) {
    const route = matrix.find((row) => row.routePath === routePath);
    assert.ok(route, `${routePath} must exist in the route coverage matrix`);
    const defaultActualView = route.storybookStories.find(
      (story) =>
        story.renderKind === "actual-view" &&
        story.actualViewComponent === actualViewComponent &&
        story.coveredStateKeys.includes("default"),
    );
    assert.ok(
      defaultActualView,
      `${routePath} must expose a default actual-view story for ${actualViewComponent}`,
    );
    assert.deepStrictEqual(defaultActualView.viewportKeys, [
      "mobile-360",
      "tablet-820",
      "desktop-1366",
    ]);
  }
});

test("required state policy gives every route machine-readable QA states", async () => {
  const {
    buildMockCoverageMatrix,
    getMockRouteInventory,
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
    "tablet-1024",
    "desktop-1366",
    "desktop-1440",
    "desktop-1536",
  ]);

  for (const row of matrix) {
    if (row.routeKind === "compat-redirect") {
      assert.deepStrictEqual(row.requiredStateKeys, ["redirect"]);
    } else {
      assert.ok(row.requiredStateKeys.includes("default"));
      assert.ok(row.requiredStateKeys.includes("long-korean"));
      assert.ok(row.requiredStateKeys.includes("mobile-overflow"));
    }
    for (const key of row.requiredStateKeys) {
      assert.ok(knownStateKeys.has(key), `${row.routePath} has unknown state ${key}`);
    }
    assert.deepStrictEqual(
      row.requiredStateKeys,
      getMockRouteInventory().find((route) => route.routePath === row.routePath)
        ?.requiredStateKeys,
    );
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
