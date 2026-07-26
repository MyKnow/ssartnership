import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  ADMIN_NAV_GROUPS,
  filterAdminNavGroupsByPermissions,
} from "../src/components/admin/admin-navigation.ts";
import { ADMIN_PERMISSION_TEMPLATES } from "../src/lib/admin-permissions.ts";

test("관리 메뉴는 다섯 업무 그룹과 기존 권한 필터를 유지한다", () => {
  assert.deepEqual(
    ADMIN_NAV_GROUPS.map((group) => group.label),
    ["개요", "회원·검토", "제휴 운영", "메시지·노출", "운영 기록·설정"],
  );

  const operationsGroup = ADMIN_NAV_GROUPS.find(
    (group) => group.label === "운영 기록·설정",
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
  const source = await readFile(
    new URL("../src/app/admin/(protected)/members/page.tsx", import.meta.url),
    "utf8",
  );
  const memberListIndex = source.indexOf('title="회원 목록"');
  const operationsToolIndex = source.indexOf('title="운영 도구"');

  assert.ok(memberListIndex >= 0);
  assert.ok(operationsToolIndex > memberListIndex);
  assert.doesNotMatch(source, /membersError\.message/);
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
  assert.match(shellSource, /activeNavItem\?\.label \?\? title/);
  assert.match(mobileNavSource, />\s*관리자 메뉴\s*</);
  assert.match(quickNavigatorSource, />\s*바로 이동\s*</);
  assert.match(taskInboxSource, /eyebrow="업무"/);
  assert.match(dashboardSource, /eyebrow="운영"/);
  assert.doesNotMatch(mobileNavSource, /Admin Workspace/);
  assert.doesNotMatch(quickNavigatorSource, />Go to</);
  assert.doesNotMatch(taskInboxSource, /eyebrow="Task inbox"/);
  assert.doesNotMatch(dashboardSource, /eyebrow="Operations"/);
});

test("관리 홈의 환경 오류는 내부 설정 이름 대신 안전한 한국어 복구 안내를 표시한다", async () => {
  const source = await readFile(
    new URL("../src/app/admin/(protected)/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /eyebrow="운영"/);
  assert.match(source, /운영 정보를 준비하지 못했습니다\./);
  assert.doesNotMatch(source, /`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`/);
  assert.doesNotMatch(source, /eyebrow="Operations"/);
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
