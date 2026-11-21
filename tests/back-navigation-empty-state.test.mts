import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { existsSync } from "node:fs";

const root = new URL("..", import.meta.url);

function read(path: string) {
  return readFile(new URL(path, root), "utf8");
}

function trackedSourceFiles() {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src/**/*.tsx", "src/**/*.ts"], {
    cwd: root,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((file) => file && !file.endsWith(".stories.tsx") && existsSync(new URL(`../${file}`, import.meta.url)));
}

test("뒤로 가기는 명시적 상위 목적지로 이동하고 router.back()·인라인 화살표 링크를 쓰지 않는다", async () => {
  const offenders: string[] = [];
  for (const file of trackedSourceFiles()) {
    const source = await read(file);
    if (/router\.back\(\)(?!`)/.test(source)) offenders.push(`${file}: router.back()`);
    if (/<Link\b[^>]*>\s*←/.test(source)) offenders.push(`${file}: ← 인라인 링크`);
  }
  assert.deepEqual(offenders, []);

  const [pageHeader, backLink] = await Promise.all([
    read("src/components/ui/PageHeader.tsx"),
    read("src/components/ui/BackLink.tsx"),
  ]);
  assert.match(pageHeader, /<BackLink href=\{backHref\}>\{backLabel\}<\/BackLink>/);
  assert.match(backLink, /min-h-11/);
  assert.match(backLink, /<ArrowLeftIcon className="h-4 w-4" aria-hidden="true" \/>/);
});

test("쇼케이스 폼 취소는 상위 화면 href로 이동한다", async () => {
  const [memberForm, adminForm] = await Promise.all([
    read("src/components/project-showcase/ShowcaseProjectForm.tsx"),
    read("src/components/admin/ShowcaseAdminProjectForm.tsx"),
  ]);

  assert.match(
    memberForm,
    /href=\{project \? `\/events\/project-showcase\/my\/projects\/\$\{encodeURIComponent\(project\.id\)\}` : "\/events\/project-showcase"\}/,
  );
  assert.match(adminForm, /<Button href=\{ADMIN_PATH\} variant="secondary" disabled=\{pending\}>돌아가기<\/Button>/);
});

test("빈 상태는 EmptyState 크기 변형을 쓰고 맥락 없는 '데이터가 없습니다'를 남기지 않는다", async () => {
  const offenders: string[] = [];
  for (const file of trackedSourceFiles()) {
    const source = await read(file);
    if (/>\s*데이터가 없습니다\.?\s*</.test(source)) offenders.push(file);
  }
  assert.deepEqual(offenders, []);

  const emptyState = await read("src/components/ui/EmptyState.tsx");
  assert.match(emptyState, /size = "md"/);
  assert.match(emptyState, /container: "px-6 py-10 text-center"/);
  assert.match(emptyState, /container: "px-4 py-5 text-left"/);

  for (const file of [
    "src/components/admin/logs/AdminLogsPanels.tsx",
    "src/components/admin/MattermostSenderManager.tsx",
    "src/components/admin/cohort-card-themes/AdminCohortCardThemeManager.tsx",
    "src/components/admin/member-detail/AdminMemberCommunicationPanel.tsx",
    "src/components/admin/AdminMemberManualAddPanel.tsx",
    "src/components/push/PushSettingsCard.tsx",
  ]) {
    const source = await read(file);
    assert.match(source, /<EmptyState[\s\S]*?size="sm"/, file);
    assert.doesNotMatch(
      source,
      /<div className="[^"]*border-dashed[^"]*">\s*(<p[^>]*>)?\s*[^<{]*(없습니다|입력해 주세요)/,
      `${file}: 점선 빈 상태 상자를 직접 그립니다.`,
    );
  }
});

test("쇼케이스·푸시 발송 로그 목록의 빈 상태는 ad hoc 점선 상자 대신 EmptyState를 쓴다", async () => {
  const files = [
    "src/app/admin/(protected)/events/project-showcase/page.tsx",
    "src/app/admin/(protected)/events/project-showcase/logs/page.tsx",
    "src/app/admin/(protected)/events/project-showcase/feedback/page.tsx",
    "src/app/(site)/events/project-showcase/page.tsx",
    "src/app/(site)/events/project-showcase/my/page.tsx",
    "src/components/admin/push-manager/PushLogsSection.tsx",
  ];

  for (const file of files) {
    const source = await read(file);
    assert.match(source, /import EmptyState from "@\/components\/ui\/EmptyState";/, file);
    assert.match(source, /<EmptyState\s/, file);
    assert.doesNotMatch(
      source,
      /<div className="[^"]*border-dashed[^"]*text-center[^"]*">/,
      `${file}: 점선 빈 상태 상자를 직접 그립니다.`,
    );
  }

  const myPage = await read("src/app/(site)/events/project-showcase/my/page.tsx");
  assert.equal([...myPage.matchAll(/<EmptyState\s/g)].length, 2);
});

const AD_HOC_EMPTY_STATES_PENDING_INTEGRATION: string[] = [];

test("목록 빈 상태를 점선 상자·muted Card로 직접 그리지 않는다(래칫)", async () => {
  const adHocEmptyStatePatterns = [
    /<(div|p|section|li)\b[^>]*className="[^"]*border-dashed[^"]*"[^>]*>\s*(<(p|span)[^>]*>)?\s*[^<{]*(없습니다|없어요)/,
    /<Card\b[^>]*tone="muted"[^>]*>\s*[^<{]*(없습니다|없어요)/,
  ];
  const offenders: string[] = [];
  for (const file of trackedSourceFiles()) {
    if (!file.endsWith(".tsx")) continue;
    const source = await read(file);
    if (adHocEmptyStatePatterns.some((pattern) => pattern.test(source))) {
      offenders.push(file);
    }
  }

  assert.deepEqual(
    offenders.sort(),
    AD_HOC_EMPTY_STATES_PENDING_INTEGRATION,
    "목록·패널 빈 상태는 EmptyState(카드 안은 size=\"sm\")를 쓰고, 허용 목록은 옮겨진 빈 상태를 고친 뒤 줄입니다.",
  );
});

test("이벤트 상태별 목록·광고 캠페인·제휴처 쿠폰 목록의 빈 상태는 EmptyState를 쓴다", async () => {
  const [eventList, adPackages, partnerCoupons] = await Promise.all([
    read("src/components/admin/AdminEventListView.tsx"),
    read("src/components/admin/ad-packages/AdminAdPackageManager.tsx"),
    read("src/components/admin/ad-packages/AdminPartnerCouponManager.tsx"),
  ]);

  assert.match(
    eventList,
    /<EmptyState\s+size="sm"\s+title=\{`\$\{section\.bucket\} 상태의 이벤트가 없습니다\.`\}/,
  );
  assert.match(adPackages, /<EmptyState\s+size="sm"\s+title="아직 등록된 광고 캠페인이 없습니다\."/);
  assert.match(
    partnerCoupons,
    /<EmptyState\s+size="sm"\s+title="아직 이 제휴처에 등록된 쿠폰이 없습니다\."/,
  );
});
