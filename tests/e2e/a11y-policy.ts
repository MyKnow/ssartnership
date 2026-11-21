/**
 * 접근성 스모크(axe) 판정 규칙. Playwright에 의존하지 않아 node 단위 테스트로도 검증한다.
 *
 * - critical·serious 영향 위반만 실패로 본다(moderate·minor는 리포트용).
 * - 이미 알려진 위반은 경로·규칙·색 모드 단위 allowlist로만 허용하고, 사유와 담당을 남긴다.
 *   전역 규칙 비활성화나 와일드카드 경로는 허용하지 않는다.
 */
export const A11Y_BLOCKING_IMPACTS = ["critical", "serious"] as const;

export const A11Y_SMOKE_VIEWPORT = { width: 360, height: 800 } as const;

export const A11Y_SMOKE_COLOR_SCHEMES = ["light", "dark"] as const;
export type A11yColorScheme = (typeof A11Y_SMOKE_COLOR_SCHEMES)[number];

/** axe 태그: WCAG 2.0~2.2 A/AA. best-practice는 스모크 실패 조건에서 뺀다. */
export const A11Y_SMOKE_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
] as const;

export type A11ySmokeRoute = {
  path: string;
  /** 모의 회원 세션(/auth/mock)으로 진입해야 하는 경로 */
  requiresMemberSession: boolean;
  /** 렌더 완료를 판단할 CSS 선택자 */
  readySelector: string;
};

export const A11Y_SMOKE_ROUTES: readonly A11ySmokeRoute[] = [
  { path: "/", requiresMemberSession: false, readySelector: "main" },
  { path: "/auth/login", requiresMemberSession: false, readySelector: "main" },
  {
    path: "/certification",
    requiresMemberSession: true,
    readySelector: "[data-testid=certification-card-frame]",
  },
  { path: "/install?platform=ios", requiresMemberSession: false, readySelector: "main" },
];

export type A11yAllowlistEntry = {
  path: string;
  ruleId: string;
  /** 생략하면 라이트·다크 모두에 적용 */
  colorScheme?: A11yColorScheme;
  /** 허용 사유와 해소 계획 */
  reason: string;
  /** 해소 담당 작업 단위 또는 Issue */
  owner: string;
};

/**
 * 기존 위반 allowlist. 통합 단계의 첫 실행 결과로 채우며, 항목마다 사유와 담당을 남긴다.
 * 해소되면 즉시 삭제한다(남은 항목은 `findStaleAllowlistEntries`로 드러난다).
 */
export const A11Y_KNOWN_VIOLATIONS: readonly A11yAllowlistEntry[] = [];

export type A11yViolationLike = {
  id: string;
  impact?: string | null;
  help?: string;
  nodes: ReadonlyArray<{ target: ReadonlyArray<unknown> }>;
};

export function isBlockingImpact(impact: string | null | undefined) {
  return (A11Y_BLOCKING_IMPACTS as readonly string[]).includes(impact ?? "");
}

function matchesAllowlist(
  entry: A11yAllowlistEntry,
  path: string,
  colorScheme: A11yColorScheme,
  ruleId: string,
) {
  return (
    entry.path === path &&
    entry.ruleId === ruleId &&
    (entry.colorScheme === undefined || entry.colorScheme === colorScheme)
  );
}

export function selectBlockingViolations<T extends A11yViolationLike>(
  path: string,
  colorScheme: A11yColorScheme,
  violations: readonly T[],
  allowlist: readonly A11yAllowlistEntry[] = A11Y_KNOWN_VIOLATIONS,
): T[] {
  return violations.filter(
    (violation) =>
      isBlockingImpact(violation.impact) &&
      !allowlist.some((entry) => matchesAllowlist(entry, path, colorScheme, violation.id)),
  );
}

/** 이번 실행에서 더 이상 발생하지 않은 allowlist 항목(삭제 대상). */
export function findStaleAllowlistEntries(
  path: string,
  colorScheme: A11yColorScheme,
  violations: readonly A11yViolationLike[],
  allowlist: readonly A11yAllowlistEntry[] = A11Y_KNOWN_VIOLATIONS,
): A11yAllowlistEntry[] {
  return allowlist.filter(
    (entry) =>
      entry.path === path &&
      (entry.colorScheme === undefined || entry.colorScheme === colorScheme) &&
      !violations.some(
        (violation) => violation.id === entry.ruleId && isBlockingImpact(violation.impact),
      ),
  );
}

export function summarizeViolations(violations: readonly A11yViolationLike[]) {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .slice(0, 3)
        .map((node) => node.target.map(String).join(" "))
        .join(", ");
      return `${violation.id} (${violation.impact ?? "unknown"}): ${violation.help ?? ""} → ${targets}`;
    })
    .join("\n");
}

export function buildA11ySmokeEntryPath(route: A11ySmokeRoute) {
  return route.requiresMemberSession
    ? `/auth/mock?returnTo=${encodeURIComponent(route.path)}`
    : route.path;
}
