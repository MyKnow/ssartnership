import { mockRouteInventory } from "./route-inventory.ts";
import { mockScenarios, type MockScenarioId } from "./registry.ts";
import { findMockScenarioPiiLeaks } from "./pii.ts";
import { buildMockCoverageMatrix } from "./coverage.ts";
import type {
  MockCoverageMatrixRow,
  MockRouteInventoryItem,
  MockScenario,
  MockScenarioSeed,
} from "./types.ts";

export type {
  MockRouteInventoryItem,
  MockScenario,
  MockScenarioDataSource,
  MockScenarioPiiLeak,
  MockScenarioSeed,
  MockScenarioSurface,
  MockCoverageLevel,
  MockCoverageMatrixRow,
  MockCoverageSummary,
  MockRequiredStateKey,
  MockRouteKind,
  MockStateStoryStatus,
  MockStateStoryTrace,
  MockStoryRenderKind,
  MockStorybookScenarioCoverage,
  MockViewportKey,
} from "./types.ts";
export type { MockScenarioId } from "./registry.ts";
export { findMockScenarioPiiLeaks } from "./pii.ts";
export {
  buildMockCoverageMatrix,
  listRoutesMissingStorybookCoverage,
  summarizeMockCoverageMatrix,
} from "./coverage.ts";
export {
  getMockScenarioAdoptionDecision,
  getMockScenarioNetworkMockingDecision,
  listMockScenarioAdoptionChangeKinds,
  type MockScenarioAdoptionDecision,
  type MockScenarioChangeKind,
  type MockScenarioNetworkMockingDecision,
} from "./adoption-policy.ts";
export {
  listMockRequiredStateDefinitions,
  mockRequiredStateDefinitions,
  mockViewportPolicy,
  requiredCaptureViewportKeys,
} from "./required-states.ts";
export {
  listMockStorybookScenarioCoverage,
  mockStorybookScenarioCoverage,
} from "./storybook-coverage.ts";
export {
  getPartnerCompanySelectionMockScenario,
  getPartnerDashboardMockScenario,
} from "./partner-portal.ts";

const scenarioById = new Map<string, MockScenario>(
  mockScenarios.map((scenario) => [scenario.id, scenario]),
);

function cloneSeed(seed: MockScenarioSeed | undefined) {
  if (!seed) {
    return undefined;
  }

  return {
    ...(seed.accountId ? { accountId: seed.accountId } : {}),
    ...(seed.companyIds ? { companyIds: [...seed.companyIds] } : {}),
    ...(seed.selectedCompanyId
      ? { selectedCompanyId: seed.selectedCompanyId }
      : {}),
    ...(seed.partnerIds ? { partnerIds: [...seed.partnerIds] } : {}),
    ...(seed.routeParams ? { routeParams: { ...seed.routeParams } } : {}),
    ...(seed.query ? { query: { ...seed.query } } : {}),
  } satisfies MockScenarioSeed;
}

function cloneScenario(scenario: MockScenario): MockScenario {
  return {
    ...scenario,
    dataSources: [...scenario.dataSources],
    requiredStates: [...scenario.requiredStates],
    seed: cloneSeed(scenario.seed),
  };
}

function cloneRouteInventoryItem(
  item: (typeof mockRouteInventory)[number],
): MockRouteInventoryItem {
  return {
    ...item,
    dataSources: [...item.dataSources],
    requiredScenarioIds: [...item.requiredScenarioIds],
    requiredStateKeys: [...item.requiredStateKeys],
  };
}

export function listMockScenarios({
  surface,
}: {
  surface?: MockScenario["surface"];
} = {}): MockScenario[] {
  return mockScenarios
    .filter((scenario) => !surface || scenario.surface === surface)
    .map(cloneScenario);
}

export function getMockScenario(id: string): MockScenario | null {
  const scenario = scenarioById.get(id);
  return scenario ? cloneScenario(scenario) : null;
}

export function requireMockScenario(id: MockScenarioId): MockScenario {
  const scenario = getMockScenario(id);
  if (!scenario) {
    throw new Error(`Unknown mock scenario: ${id}`);
  }
  return scenario;
}

export function getMockScenarioSeed(
  id: MockScenarioId,
): MockScenarioSeed | undefined {
  return cloneSeed(requireMockScenario(id).seed);
}

export function getMockRouteInventory(): MockRouteInventoryItem[] {
  return mockRouteInventory.map(cloneRouteInventoryItem);
}

export function getMockRouteCoverageMatrix(): MockCoverageMatrixRow[] {
  return buildMockCoverageMatrix();
}

export function getMockRouteInventoryItem(
  routePath: string,
): MockRouteInventoryItem | null {
  const item = mockRouteInventory.find((route) => route.routePath === routePath);
  return item ? cloneRouteInventoryItem(item) : null;
}

export function listMockScenariosForRoute(routePath: string): MockScenario[] {
  const route = getMockRouteInventoryItem(routePath);
  if (!route) {
    return [];
  }

  return route.requiredScenarioIds.map((scenarioId) =>
    requireMockScenario(scenarioId as MockScenarioId),
  );
}

export function assertMockScenariosAreSynthetic() {
  const leaks = findMockScenarioPiiLeaks(mockScenarios);
  if (leaks.length > 0) {
    throw new Error(
      `Mock scenarios contain production-like identifiers: ${leaks
        .map((leak) => `${leak.scenarioId}:${leak.path}`)
        .join(", ")}`,
    );
  }
}
