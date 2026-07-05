import type { MockScenarioDataSource } from "./types.ts";

export type MockScenarioChangeKind =
  | "style-only"
  | "copy-only"
  | "new-route"
  | "new-view"
  | "new-data-branch"
  | "new-auth-branch"
  | "new-async-action"
  | "new-form-validation"
  | "new-media-flow"
  | "new-pagination-flow";

export type MockScenarioAdoptionDecision = {
  requiresScenario: boolean;
  requiresStorybookState: boolean;
  requiresCoverageMatrixUpdate: boolean;
  reason: string;
};

export type MockScenarioNetworkMockingDecision = {
  preferredStrategy: "scenario-adapter" | "msw";
  requiresMsw: boolean;
  reason: string;
};

const lowRiskChangeKinds = new Set<MockScenarioChangeKind>([
  "style-only",
  "copy-only",
]);

const storybookRequiredChangeKinds = new Set<MockScenarioChangeKind>([
  "new-route",
  "new-view",
  "new-data-branch",
  "new-auth-branch",
  "new-async-action",
  "new-form-validation",
  "new-media-flow",
  "new-pagination-flow",
]);

export function getMockScenarioAdoptionDecision(
  changeKind: MockScenarioChangeKind,
): MockScenarioAdoptionDecision {
  if (lowRiskChangeKinds.has(changeKind)) {
    return {
      requiresScenario: false,
      requiresStorybookState: false,
      requiresCoverageMatrixUpdate: false,
      reason:
        "문구나 시각 polish만 바뀌고 새 상태/분기/데이터 계약이 없으면 기존 시나리오를 재사용합니다.",
    };
  }

  if (storybookRequiredChangeKinds.has(changeKind)) {
    return {
      requiresScenario: true,
      requiresStorybookState: true,
      requiresCoverageMatrixUpdate: true,
      reason:
        "새 화면, 데이터 분기, 권한 분기, 비동기 동작, 폼 검증, 이미지, 페이지네이션은 재현 가능한 scenario/story coverage가 필요합니다.",
    };
  }

  return {
    requiresScenario: true,
    requiresStorybookState: false,
    requiresCoverageMatrixUpdate: true,
    reason: "알 수 없는 변경 유형은 최소 scenario와 coverage 기록을 요구합니다.",
  };
}

export function listMockScenarioAdoptionChangeKinds() {
  return [
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
  ] as const satisfies MockScenarioChangeKind[];
}

export function getMockScenarioNetworkMockingDecision({
  dataSources,
  exercisesClientFetch,
}: {
  dataSources: readonly MockScenarioDataSource[];
  exercisesClientFetch: boolean;
}): MockScenarioNetworkMockingDecision {
  if (exercisesClientFetch) {
    return {
      preferredStrategy: "msw",
      requiresMsw: true,
      reason:
        "Storybook play/test에서 fetch, PATCH/DELETE, 더보기 같은 client API 상호작용을 실행하면 MSW로 응답을 고정합니다.",
    };
  }

  if (
    dataSources.includes("repository") ||
    dataSources.includes("service") ||
    dataSources.includes("storybook")
  ) {
    return {
      preferredStrategy: "scenario-adapter",
      requiresMsw: false,
      reason:
        "Repository/service/view props로 표현 가능한 상태는 scenario adapter를 우선 사용합니다.",
    };
  }

  if (dataSources.includes("api-route")) {
    return {
      preferredStrategy: "scenario-adapter",
      requiresMsw: false,
      reason:
        "API route가 있어도 story가 네트워크 상호작용을 실행하지 않으면 초기 state fixture로 충분합니다.",
    };
  }

  return {
    preferredStrategy: "scenario-adapter",
    requiresMsw: false,
    reason: "네트워크 의존이 명확하지 않으면 MSW를 추가하지 않습니다.",
  };
}
