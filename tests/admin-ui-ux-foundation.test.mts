import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("회원 화면은 내부 오류를 노출하지 않고 보조 운영 도구 이후에 목록을 둔다", async () => {
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
  const summaryIndex = source.indexOf('aria-label="회원 운영 요약"');
  const operationsToolIndex = source.indexOf("<AdminMemberOperationsPanel");

  assert.ok(memberListIndex >= 0);
  assert.ok(summaryIndex < memberListIndex);
  assert.ok(operationsToolIndex < memberListIndex);
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

test("관리자 모바일 헤더는 스크롤과 무관하게 계속 노출된다", async () => {
  const [shellSource, headerHeightSource] = await Promise.all([
    readFile(
      new URL("../src/components/admin/AdminShellView.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/hooks/useHeaderHeight.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(shellSource, /useHeaderHeight/);
  assert.doesNotMatch(shellSource, /useAutoHideHeader|hidden \? "-translate-y-full"/);
  assert.doesNotMatch(headerHeightSource, /addEventListener\("scroll"|requestAnimationFrame/);
  assert.match(headerHeightSource, /ResizeObserver/);
});

test("핵심 관리자 화면은 데이터 본문보다 페이지 헤더를 먼저 스트리밍한다", async () => {
  const pageSources = await Promise.all(
    [
      "../src/app/admin/(protected)/page.tsx",
      "../src/app/admin/(protected)/members/page.tsx",
      "../src/app/admin/(protected)/push/page.tsx",
      "../src/app/admin/(protected)/admins/page.tsx",
    ].map((file) => readFile(new URL(file, import.meta.url), "utf8")),
  );

  for (const [index, source] of pageSources.entries()) {
    const headerIndex = source.indexOf(
      index === 0 ? "<AdminDashboardHeader" : "<AdminPageHeader",
    );
    const suspenseIndex = source.indexOf(
      `<Suspense fallback={<${
        [
          "AdminDashboardSkeletonContent",
          "AdminMembersSkeletonContent",
          "AdminPushSkeletonContent",
          "AdminAccountsSkeletonContent",
        ][index]
      }`,
    );

    assert.ok(headerIndex >= 0, "화면별 단일 페이지 헤더가 필요합니다");
    assert.ok(
      suspenseIndex > headerIndex,
      "데이터 Suspense보다 페이지 헤더가 먼저 선언되어야 합니다",
    );
    assert.match(source, /showHeader=\{false\}/);
  }

  assert.match(pageSources[0], /<AdminDashboardHeader\s*\/>/);
});

test("제휴처 상세의 오류·로딩 상태도 데이터와 무관한 페이지 h1을 유지한다", async () => {
  const source = await readFile(
    new URL(
      "../src/app/admin/(protected)/partners/[partnerId]/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const headerIndex = source.indexOf("<AdminPageHeader");
  const suspenseIndex = source.indexOf(
    "<Suspense fallback={<AdminPartnerDetailSkeletonContent",
  );

  assert.ok(headerIndex >= 0);
  assert.ok(suspenseIndex > headerIndex);
  assert.match(source, /AdminStatePanel/);
  assert.match(source, /<AdminSectionHeading/);
  assert.match(source, /showHeader=\{false\}/);
});

test("나머지 관리자 목록도 데이터 Suspense보다 공통 페이지 헤더를 먼저 스트리밍한다", async () => {
  const routes = [
    ["advertisement/page.tsx", "AdminAdvertisementSkeletonContent"],
    ["categories/page.tsx", "AdminCategoriesSkeletonContent"],
    ["companies/page.tsx", "AdminCompaniesSkeletonContent"],
    ["cycle/page.tsx", "AdminCycleSkeletonContent"],
    ["event/page.tsx", "AdminEventSkeletonContent"],
    ["graduate-verifications/page.tsx", "AdminGraduateVerificationsSkeletonContent"],
    ["logs/page.tsx", "AdminLogsSkeletonContent"],
    ["member-signup-requests/page.tsx", "AdminMemberSignupRequestsSkeletonContent"],
    ["notification-templates/page.tsx", "AdminNotificationTemplatesSkeletonContent"],
    ["notifications/page.tsx", "AdminNotificationsSkeletonContent"],
    ["partner-registrations/page.tsx", "AdminPartnerRegistrationsSkeletonContent"],
    ["partner-requests/page.tsx", "AdminPartnerRequestsSkeletonContent"],
    ["partners/page.tsx", "AdminPartnersSkeletonContent"],
    ["profile-photos/page.tsx", "AdminProfilePhotosSkeletonContent"],
    ["reviews/page.tsx", "AdminReviewsSkeletonContent"],
    ["search/page.tsx", "AdminGlobalSearchSkeletonContent"],
  ] as const;

  for (const [route, fallback] of routes) {
    const source = await readFile(
      new URL(`../src/app/admin/(protected)/${route}`, import.meta.url),
      "utf8",
    );
    const headerIndex = source.lastIndexOf("<AdminPageHeader");
    const suspenseIndex = source.indexOf(
      `<Suspense fallback={<${fallback} showHeader={false}`,
    );

    assert.ok(headerIndex >= 0, `${route}: 정적 페이지 헤더가 필요합니다`);
    assert.ok(
      suspenseIndex > headerIndex,
      `${route}: 데이터 Suspense보다 페이지 헤더가 먼저 선언되어야 합니다`,
    );
    assert.match(source, /showHeader=\{false\}/, route);
  }
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
