import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  ADMIN_NAV_GROUPS,
  filterAdminNavGroupsByPermissions,
} from "../src/components/admin/admin-navigation.ts";
import { ADMIN_PERMISSION_TEMPLATES } from "../src/lib/admin-permissions.ts";

test("관리 메뉴는 의도 기반 여섯 업무 그룹과 기존 권한 필터를 유지한다", () => {
  assert.deepEqual(
    ADMIN_NAV_GROUPS.map((group) => group.label),
    ["홈", "작업함", "데이터", "리포트", "자동화", "설정"],
  );

  const operationsGroup = ADMIN_NAV_GROUPS.find(
    (group) => group.label === "리포트",
  );
  assert.ok(operationsGroup?.items.some((item) => item.href === "/admin/logs"));

  const regionalPermissions = ADMIN_PERMISSION_TEMPLATES.find(
    (template) => template.key === "regional_partner_manager",
  )?.permissions;
  assert.ok(regionalPermissions);
  const regionalGroups = filterAdminNavGroupsByPermissions(
    ADMIN_NAV_GROUPS,
    regionalPermissions,
    { includeGlobalItems: false },
  );
  assert.equal(
    regionalGroups
      .flatMap((group) => group.items)
      .some((item) => item.href === "/admin/categories"),
    false,
  );
});

test("회원 화면은 내부 오류를 노출하지 않고 목록 이후에 보조 운영 도구를 둔다", async () => {
  const [source, operationsSource] = await Promise.all([
    readFile(
      new URL("../src/app/admin/(protected)/members/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/admin/AdminMemberOperationsPanel.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  const memberListIndex = source.indexOf('title="회원 목록"');
  const operationsToolIndex = source.indexOf("<AdminMemberOperationsPanel");

  assert.ok(memberListIndex >= 0);
  assert.ok(operationsToolIndex > memberListIndex);
  assert.doesNotMatch(source, /membersError\.message/);
  assert.match(operationsSource, /title="운영 도구"/);
});

test("회원과 제휴처 목록은 URL 페이지 전환을 즉시 상태로 알리고 중복 요청을 막는다", async () => {
  const [memberSource, partnerSource] = await Promise.all([
    readFile(
      new URL(
        "../src/components/admin/AdminMemberManager.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/AdminPartnerManager.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  for (const source of [memberSource, partnerSource]) {
    assert.match(source, /useTransition/);
    assert.match(source, /requestedPage/);
    assert.match(source, /router\.prefetch/);
    assert.match(source, /prefetchPage/);
    assert.match(source, /페이지 결과를 불러오는 중입니다/);
    assert.match(
      source,
      /aria-busy=\{isPageNavigationPending \|\| undefined\}/,
    );
    assert.match(source, /router\.replace/);
  }

  assert.match(memberSource, /<fieldset\s+disabled=\{isPending\}/);
  assert.match(memberSource, /disabled=\{currentPage === 1 \|\| isPending\}/);
  assert.match(partnerSource, /disabled=\{currentPage === 1 \|\| isPending\}/);
});

test("관리 셸은 문서 제목을 만들지 않고 페이지 헤더가 단일 h1을 맡는다", async () => {
  const [shellSource, pageHeaderSource] = await Promise.all([
    readFile(
      new URL("../src/components/admin/AdminShellView.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/admin/AdminPageHeader.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.doesNotMatch(shellSource, /<h1[\s>]/);
  assert.match(pageHeaderSource, /<h1 className=/);
});

test("관리 셸은 반복 탐색을 건너뛰고 빠른 찾기 전환 중 즉시 상태를 알린다", async () => {
  const [shellSource, navigatorSource] = await Promise.all([
    readFile(
      new URL("../src/components/admin/AdminShellView.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/AdminQuickNavigator.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(shellSource, /href="#admin-main-content"/);
  assert.match(shellSource, /id="admin-main-content" tabIndex=\{-1\}/);
  assert.match(navigatorSource, /useTransition/);
  assert.match(navigatorSource, /aria-busy=\{isRoutePending \|\| undefined\}/);
  assert.match(navigatorSource, /role="status" aria-live="polite"/);
  assert.match(navigatorSource, /선택한 관리 화면을 여는 중입니다\./);
  assert.match(
    navigatorSource,
    /aria-disabled=\{isRoutePending \|\| undefined\}/,
  );
  assert.match(navigatorSource, /aria-label="빠른 찾기 배경 닫기"/);
  assert.match(shellSource, /<Link\s+key=\{item\.href\}\s+href=\{item\.href\}\s+prefetch=\{false\}/);
  assert.match(shellSource, /<Link\s+href="\/admin"\s+prefetch=\{false\}/);
  assert.match(shellSource, /prefetchOnIntent/);
  assert.match(shellSource, /onPointerEnter=\{\(\) => prefetchOnIntent/);
});

test("관리자 전환 계측은 Next.js insertion effect 중 동기 상태 갱신을 피한다", async () => {
  const source = await readFile(
    new URL(
      "../src/components/analytics/AdminNavigationTiming.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /navigationIndicatorTimer/);
  assert.match(source, /ADMIN_NAVIGATION_PROGRESS_ID/);
  assert.match(source, /window\.setTimeout\(\(\) => \{/);
  assert.match(source, /\}, 80\);/);
  assert.doesNotMatch(
    source,
    /ADMIN_NAVIGATION_START_EVENT|setIsNavigationPending|useState\(/,
  );
});

test("관리자 공통 진입점은 외래어 대신 한국어 업무 맥락을 표시한다", async () => {
  const [
    shellSource,
    mobileNavSource,
    quickNavigatorSource,
    taskInboxSource,
    dashboardSource,
  ] = await Promise.all([
    readFile(
      new URL("../src/components/admin/AdminShellView.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/admin/AdminMobileNav.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/AdminQuickNavigator.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/AdminTaskInboxView.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/AdminDashboardView.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(shellSource, />\s*관리자\s*</);
  assert.match(shellSource, /group\.label === "데이터"/);
  assert.match(shellSource, /item\.href === "\/admin\/members"/);
  assert.match(shellSource, /activeNavItem\?\.label \?\? title/);
  assert.match(mobileNavSource, />\s*관리자 메뉴\s*</);
  assert.match(mobileNavSource, /aria-label="관리 메뉴 배경 닫기"/);
  assert.match(mobileNavSource, /href=\{href\}\s+prefetch=\{false\}/);
  assert.doesNotMatch(
    mobileNavSource,
    /className="fixed inset-0 isolate z-\[70\] md:hidden" aria-hidden=/,
  );
  assert.match(quickNavigatorSource, />\s*바로 이동\s*</);
  assert.match(taskInboxSource, /eyebrow="작업함"/);
  assert.match(dashboardSource, /eyebrow="홈"/);
  assert.doesNotMatch(mobileNavSource, /Admin Workspace/);
  assert.doesNotMatch(shellSource, /회원·검토/);
  assert.doesNotMatch(quickNavigatorSource, />Go to</);
  assert.doesNotMatch(taskInboxSource, /eyebrow="Task inbox"/);
  assert.doesNotMatch(dashboardSource, /eyebrow="Operations"/);
});

test("대표 셸 Story는 작업 중심 콘텐츠와 새 데이터 분류를 보여준다", async () => {
  const [shellStorySource, partnerNewSource, partnerRequestsSource, partnersSource] =
    await Promise.all([
      readFile(
        new URL(
          "../src/components/admin/AdminShell.stories.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/components/admin/AdminPartnerNewView.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/app/admin/(protected)/partner-requests/page.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/app/admin/(protected)/partners/page.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

  assert.match(shellStorySource, /다음으로 처리/);
  assert.match(shellStorySource, /작업함에서 이어서 처리/);
  assert.match(shellStorySource, /href="\/admin\/members"/);
  assert.match(partnerNewSource, /eyebrow="데이터"/);
  assert.match(partnerRequestsSource, /eyebrow="작업함"/);
  assert.match(partnersSource, /eyebrow="데이터"/);
  assert.doesNotMatch(shellStorySource, /상위 레이아웃/);
  assert.doesNotMatch(partnerNewSource, /eyebrow="제휴 운영"/);
  assert.doesNotMatch(partnerRequestsSource, /eyebrow="제휴 운영"/);
  assert.doesNotMatch(partnersSource, /eyebrow="제휴 운영"/);
});

test("관리자 검색·리뷰 필터는 한국어 accessible name을 제공한다", async () => {
  const sources = await Promise.all([
    readFile(
      new URL("../src/components/admin/AdminMemberManager.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/admin/AdminPartnerManager.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/review-manager/AdminReviewFilters.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/partner-detail/AdminPartnerReviewManager.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(sources[0], /aria-label="회원 검색"/);
  assert.match(sources[1], /aria-label="제휴처명 검색"/);
  assert.match(sources[2], /aria-label="리뷰 작성자 검색"/);
  assert.match(sources[2], /aria-label="리뷰 파트너사"/);
  assert.match(sources[2], /aria-label="리뷰 정렬"/);
  assert.match(sources[3], /aria-label="제휴처 리뷰 작성자 검색"/);
  assert.match(sources[3], /aria-label="제휴처 리뷰 상태"/);
});

test("관리 홈의 환경 오류는 내부 설정 이름 대신 안전한 한국어 복구 안내를 표시한다", async () => {
  const source = await readFile(
    new URL("../src/app/admin/(protected)/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /eyebrow="홈"/);
  assert.match(source, /운영 정보를 준비하지 못했습니다\./);
  assert.doesNotMatch(source, /`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`/);
  assert.doesNotMatch(source, /eyebrow="Operations"/);
});

test("관리 홈의 집계 실패는 0을 정상값으로 오인시키지 않는다", async () => {
  const source = await readFile(
    new URL("../src/components/admin/AdminDashboardView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /isDataUnavailable\s*\?\s*"확인 필요"/);
  assert.match(source, /isDataUnavailable \? "확인 필요" : item\.meta/);
  assert.match(source, /isDataUnavailable \? "확인 필요" : item\.value/);
  assert.match(source, /counts\.companyCount\.toLocaleString\("ko-KR"\)/);
  assert.match(source, /counts\.accountCount\.toLocaleString\("ko-KR"\)/);
});

test("서비스 활성도는 약어보다 한국어 업무 의미를 먼저 표시한다", async () => {
  const source = await readFile(
    new URL(
      "../src/components/admin/AdminPlatformActivityMetricsPanel.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /label: "일간 활성"/);
  assert.match(source, /label: "주간 활성"/);
  assert.match(source, /label: "월간 활성"/);
  assert.doesNotMatch(source, /\{ label: "DAU"/);
});

test("실제 관리자 화면의 eyebrow는 한국어 업무 맥락을 사용한다", async () => {
  const sourceRoots = [
    new URL("../src/app/admin/(protected)/", import.meta.url),
    new URL("../src/components/admin/", import.meta.url),
  ];
  const sources = await Promise.all(
    sourceRoots.map(async (sourceRoot) => {
      const paths = await readdir(sourceRoot, { recursive: true });
      const files = paths
        .filter(
          (file) =>
            file.endsWith(".tsx") &&
            !file.endsWith(".stories.tsx") &&
            !file.includes(`${path.sep}__`),
        )
        .map((file) => new URL(file, sourceRoot));
      return Promise.all(files.map((file) => readFile(file, "utf8")));
    }),
  );

  assert.doesNotMatch(sources.flat().join("\n"), /eyebrow="[A-Za-z]/);
});

test("실제 관리자 화면의 kicker는 한국어 업무 맥락을 사용한다", async () => {
  const sourceRoots = [
    new URL("../src/app/admin/(protected)/", import.meta.url),
    new URL("../src/components/admin/", import.meta.url),
  ];
  const sources = await Promise.all(
    sourceRoots.map(async (sourceRoot) => {
      const paths = await readdir(sourceRoot, { recursive: true });
      const files = paths
        .filter(
          (file) =>
            file.endsWith(".tsx") &&
            !file.endsWith(".stories.tsx") &&
            !file.includes(`${path.sep}__`),
        )
        .map((file) => new URL(file, sourceRoot));
      return Promise.all(files.map((file) => readFile(file, "utf8")));
    }),
  );

  assert.doesNotMatch(sources.flat().join("\n"), /className="ui-kicker">[A-Za-z]/);
});

test("관리자 운영 표는 모바일에서 카드 표현으로 전환하고 모션 감소를 존중한다", async () => {
  const [eventSource, routeTimingSource, taskOutcomeSource, globalStyleSource] =
    await Promise.all([
      readFile(
        new URL(
          "../src/app/admin/(protected)/event/[slug]/page.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/components/admin/AdminRouteTimingSummaryPanel.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../src/components/admin/AdminTaskOutcomeSummaryPanel.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../src/app/globals.css", import.meta.url),
        "utf8",
      ),
    ]);

  for (const source of [eventSource, routeTimingSource, taskOutcomeSource]) {
    assert.match(source, /hidden[^\"]*md:block/);
    assert.match(source, /md:hidden/);
  }
  assert.match(eventSource, /eventRewardNotificationStatusLabel/);
  assert.doesNotMatch(eventSource, /\{winner\.notificationStatus\}/);
  assert.match(globalStyleSource, /prefers-reduced-motion: reduce/);
  assert.match(globalStyleSource, /scroll-behavior: auto/);
});

test("관리자 민감 작업은 공용 접근성 확인 모달을 사용한다", async () => {
  const sources = await Promise.all(
    [
      "../src/components/admin/AdminConfirmDialog.tsx",
      "../src/components/admin/AdminLogoutButton.tsx",
      "../src/components/admin/AdminNotificationInbox.tsx",
      "../src/components/admin/AdminPushManager.tsx",
      "../src/components/admin/member-detail/AdminMemberAccountManager.tsx",
      "../src/components/admin/push-manager/useAdminPushManager.ts",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  assert.match(sources[0]!, /<Modal/);
  for (const source of sources.slice(1, 5)) {
    assert.match(source, /AdminConfirmDialog/);
    assert.doesNotMatch(source, /window\.confirm/);
  }
  assert.doesNotMatch(sources[5]!, /window\.confirm/);
});

test("푸시 관리 화면은 가로 overflow를 숨겨 결함을 가리지 않는다", async () => {
  const sources = await Promise.all(
    [
      "../src/components/admin/AdminPushManager.tsx",
      "../src/components/admin/push-manager/PushComposerSection.tsx",
      "../src/components/admin/push-manager/PushLogsSection.tsx",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  for (const source of sources) {
    assert.doesNotMatch(source, /overflow-x-hidden/);
  }
  assert.match(sources[0]!, /className="grid min-w-0 gap-8"/);
  assert.match(sources[2]!, /className="grid min-w-0 gap-3"/);
});

test("주요 관리자 라우트는 화면별 route-level loading skeleton을 제공한다", async () => {
  const loadingRoutes = [
    "../src/app/admin/(protected)/admins/loading.tsx",
    "../src/app/admin/(protected)/advertisement/loading.tsx",
    "../src/app/admin/(protected)/event/loading.tsx",
    "../src/app/admin/(protected)/event/[slug]/loading.tsx",
    "../src/app/admin/(protected)/graduate-verifications/loading.tsx",
    "../src/app/admin/(protected)/profile-photos/loading.tsx",
    "../src/app/admin/(protected)/member-signup-requests/loading.tsx",
    "../src/app/admin/(protected)/member-signup-requests/[requestId]/loading.tsx",
    "../src/app/admin/(protected)/members/[memberId]/loading.tsx",
    "../src/app/admin/(protected)/notifications/loading.tsx",
    "../src/app/admin/(protected)/notification-templates/loading.tsx",
    "../src/app/admin/(protected)/partner-registrations/loading.tsx",
    "../src/app/admin/(protected)/partners/[partnerId]/edit/loading.tsx",
    "../src/app/admin/(protected)/promotions/loading.tsx",
    "../src/app/admin/(protected)/tasks/loading.tsx",
    "../src/app/admin/(protected)/cycle/mock/loading.tsx",
  ];
  const sources = await Promise.all(
    loadingRoutes.map((route) => readFile(new URL(route, import.meta.url), "utf8")),
  );

  for (const source of sources) {
    assert.match(source, /export default function Loading/);
    assert.match(source, /SkeletonContent/);
  }
});
