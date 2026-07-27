import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const managerPaths = [
  new URL("../src/components/admin/AdminMemberManager.tsx", import.meta.url),
  new URL("../src/components/admin/AdminPartnerManager.tsx", import.meta.url),
];

const serverPaginationPaths = [
  "../src/components/admin/PartnerChangeRequestQueue.tsx",
  "../src/components/admin/AdminPartnerRegistrationsView.tsx",
  "../src/components/admin/AdminMemberSignupApprovalQueue.tsx",
  "../src/components/admin/AdminGraduateVerificationQueue.tsx",
  "../src/components/admin/AdminReviewManagerView.tsx",
  "../src/components/admin/partner-detail/AdminPartnerReviewManager.tsx",
].map((path) => new URL(path, import.meta.url));

const securityLogPath = new URL(
  "../src/components/admin/member-detail/AdminMemberSecurityLogExplorer.tsx",
  import.meta.url,
);

test("관리자 목록 페이지 이동은 transition 전에 요청 페이지를 표시한다", async () => {
  const sources = await Promise.all(
    managerPaths.map((path) => readFile(path, "utf8")),
  );

  for (const source of sources) {
    const updateQuerySource = source.slice(source.indexOf("const updateQuery"));
    const requestedPageIndex = updateQuerySource.indexOf(
      "setRequestedPage(pendingPage)",
    );
    const transitionIndex = updateQuerySource.indexOf("startTransition(() =>");

    assert.notEqual(requestedPageIndex, -1);
    assert.notEqual(transitionIndex, -1);
    assert.ok(
      requestedPageIndex < transitionIndex,
      "pending page feedback must commit before the route transition",
    );
  }
});

test("서버 페이지네이션은 공통 즉시 피드백 링크를 사용한다", async () => {
  const [paginationSource, ...sources] = await Promise.all([
    readFile(
      new URL("../src/components/admin/AdminPaginationLink.tsx", import.meta.url),
      "utf8",
    ),
    ...serverPaginationPaths.map((path) => readFile(path, "utf8")),
  ]);

  assert.match(paginationSource, /loadingText="불러오는 중"/);
  assert.match(paginationSource, /setIsPending\(true\)/);
  assert.match(paginationSource, /페이지를 불러오는 중입니다/);

  for (const source of sources) {
    assert.match(source, /AdminPaginationLink/);
  }
});

test("회원 보안 로그 페이지네이션은 URL 전환 전에 로딩 상태를 표시한다", async () => {
  const source = await readFile(securityLogPath, "utf8");

  assert.match(source, /useTransition/);
  assert.match(source, /setRequestedPagination\(/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /router\.replace\(/);
});
