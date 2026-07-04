import { mockRouteInventory } from "./route-inventory.ts";
import { mockScenarios } from "./registry.ts";
import { listMockStorybookScenarioCoverage } from "./storybook-coverage.ts";
import {
  getPolicyViewportKeysForRoute,
  getRequiredStateKeysForRoute,
} from "./required-states.ts";
import type {
  MockCoverageLevel,
  MockCoverageMatrixRow,
  MockCoverageSummary,
  MockStorybookScenarioCoverage,
} from "./types.ts";

function getCoverageLevel({
  routeWantsStorybook,
  requiredScenarioIds,
  storybookStories,
}: {
  routeWantsStorybook: boolean;
  requiredScenarioIds: string[];
  storybookStories: MockStorybookScenarioCoverage[];
}): MockCoverageLevel {
  if (!routeWantsStorybook) {
    return "route-inventory-only";
  }

  const coveredScenarioIds = new Set(
    storybookStories.map((story) => story.scenarioId),
  );
  const coveredCount = requiredScenarioIds.filter((scenarioId) =>
    coveredScenarioIds.has(scenarioId),
  ).length;

  if (coveredCount === requiredScenarioIds.length) {
    return "storybook-complete";
  }
  if (coveredCount > 0) {
    return "storybook-partial";
  }
  return "storybook-missing";
}

export function buildMockCoverageMatrix(): MockCoverageMatrixRow[] {
  const storybookCoverage = listMockStorybookScenarioCoverage();

  return mockRouteInventory.map((route) => {
    const storybookStories = storybookCoverage.filter(
      (entry) => entry.routePath === route.routePath,
    );
    const coveredScenarioIds = new Set<string>(
      storybookStories.map((entry) => entry.scenarioId),
    );
    const missingStorybookScenarioIds = route.requiredScenarioIds.filter(
      (scenarioId) => !coveredScenarioIds.has(scenarioId),
    );
    const dataSources = [...route.dataSources];
    const routeWantsStorybook = dataSources.includes("storybook");

    return {
      routePath: route.routePath,
      surface: route.surface,
      authScope: route.authScope,
      viewComponent: route.viewComponent,
      dataSources,
      requiredScenarioIds: [...route.requiredScenarioIds],
      requiredStateKeys: getRequiredStateKeysForRoute(route),
      viewportKeys: getPolicyViewportKeysForRoute(route),
      storybookStories,
      missingStorybookScenarioIds: routeWantsStorybook
        ? missingStorybookScenarioIds
        : [],
      coverageLevel: getCoverageLevel({
        routeWantsStorybook,
        requiredScenarioIds: route.requiredScenarioIds,
        storybookStories,
      }),
    };
  });
}

export function summarizeMockCoverageMatrix(
  matrix: MockCoverageMatrixRow[] = buildMockCoverageMatrix(),
): MockCoverageSummary {
  return {
    totalRoutes: matrix.length,
    scenarioCount: mockScenarios.length,
    storybookCompleteRoutes: matrix.filter(
      (row) => row.coverageLevel === "storybook-complete",
    ).length,
    storybookPartialRoutes: matrix.filter(
      (row) => row.coverageLevel === "storybook-partial",
    ).length,
    storybookMissingRoutes: matrix.filter(
      (row) => row.coverageLevel === "storybook-missing",
    ).length,
    routeInventoryOnlyRoutes: matrix.filter(
      (row) => row.coverageLevel === "route-inventory-only",
    ).length,
    storybookStoryCount: listMockStorybookScenarioCoverage().length,
  };
}

export function listRoutesMissingStorybookCoverage(
  matrix: MockCoverageMatrixRow[] = buildMockCoverageMatrix(),
) {
  return matrix.filter(
    (row) =>
      row.coverageLevel === "storybook-missing" ||
      row.coverageLevel === "storybook-partial",
  );
}
