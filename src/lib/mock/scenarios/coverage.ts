import { mockRouteInventory } from "./route-inventory.ts";
import { mockScenarios } from "./registry.ts";
import { listMockStorybookScenarioCoverage } from "./storybook-coverage.ts";
import { getPolicyViewportKeysForRoute } from "./required-states.ts";
import type {
  MockCoverageLevel,
  MockCoverageMatrixRow,
  MockCoverageSummary,
  MockRequiredStateKey,
  MockStateStoryTrace,
  MockStorybookScenarioCoverage,
  MockViewportKey,
} from "./types.ts";

function getCoverageLevel({
  routeWantsStorybook,
  storybookStories,
  stateStoryTrace,
}: {
  routeWantsStorybook: boolean;
  storybookStories: MockStorybookScenarioCoverage[];
  stateStoryTrace: MockStateStoryTrace[];
}): MockCoverageLevel {
  if (!routeWantsStorybook) {
    return "route-inventory-only";
  }

  if (
    stateStoryTrace.every(
      (trace) =>
        trace.status === "actual-view" &&
        trace.missingViewportKeys.length === 0,
    )
  ) {
    return "storybook-complete";
  }
  if (stateStoryTrace.some((trace) => trace.status === "actual-view")) {
    return "storybook-partial";
  }
  if (storybookStories.length > 0) {
    return "storybook-reference-only";
  }
  return "storybook-missing";
}

function uniqueViewportKeys(
  viewportKeys: MockViewportKey[],
  policyViewportKeys: MockViewportKey[],
) {
  const viewportSet = new Set(viewportKeys);
  return policyViewportKeys.filter((viewportKey) => viewportSet.has(viewportKey));
}

function buildStateStoryTrace({
  requiredStateKeys,
  viewportKeys,
  storybookStories,
}: {
  requiredStateKeys: MockRequiredStateKey[];
  viewportKeys: MockViewportKey[];
  storybookStories: MockStorybookScenarioCoverage[];
}): MockStateStoryTrace[] {
  return requiredStateKeys.map((stateKey) => {
    const stateStories = storybookStories.filter((story) =>
      story.coveredStateKeys.includes(stateKey),
    );
    const actualViewStories = stateStories.filter(
      (story) => story.renderKind === "actual-view",
    );
    const referenceStories = stateStories.filter(
      (story) => story.renderKind !== "actual-view",
    );
    const coveredViewportKeys = uniqueViewportKeys(
      actualViewStories.flatMap((story) => story.viewportKeys),
      viewportKeys,
    );
    const coveredViewportSet = new Set(coveredViewportKeys);

    return {
      stateKey,
      status:
        actualViewStories.length > 0
          ? "actual-view"
          : referenceStories.length > 0
            ? "reference-only"
            : "missing",
      actualViewStoryIds: actualViewStories.map((story) => story.storyId),
      referenceStoryIds: referenceStories.map((story) => story.storyId),
      coveredViewportKeys,
      missingViewportKeys: viewportKeys.filter(
        (viewportKey) => !coveredViewportSet.has(viewportKey),
      ),
    };
  });
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
    const requiredStateKeys = [...route.requiredStateKeys];
    const viewportKeys = getPolicyViewportKeysForRoute(route);
    const stateStoryTrace = buildStateStoryTrace({
      requiredStateKeys,
      viewportKeys,
      storybookStories,
    });

    return {
      routePath: route.routePath,
      routeKind: route.routeKind,
      screenContractId: route.screenContractId,
      primaryTask: route.primaryTask,
      surface: route.surface,
      authScope: route.authScope,
      viewComponent: route.viewComponent,
      dataSources,
      requiredScenarioIds: [...route.requiredScenarioIds],
      requiredStateKeys,
      viewportKeys,
      storybookStories,
      stateStoryTrace,
      missingStorybookScenarioIds: routeWantsStorybook
        ? missingStorybookScenarioIds
        : [],
      missingActualViewStateKeys: stateStoryTrace
        .filter(
          (trace) =>
            trace.status !== "actual-view" ||
            trace.missingViewportKeys.length > 0,
        )
        .map((trace) => trace.stateKey),
      coverageLevel: getCoverageLevel({
        routeWantsStorybook,
        storybookStories,
        stateStoryTrace,
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
    storybookReferenceOnlyRoutes: matrix.filter(
      (row) => row.coverageLevel === "storybook-reference-only",
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
      row.coverageLevel === "storybook-partial" ||
      row.coverageLevel === "storybook-reference-only",
  );
}
