import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { beforeEach } from "node:test";

process.env.NEXT_PUBLIC_DATA_SOURCE = process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock";
process.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE =
  process.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE ?? "mock";

type MockChangeRequestModule = typeof import("../src/lib/mock/partner-change-requests");

const mockChangeRequests = import(
  new URL("../src/lib/mock/partner-change-requests.ts", import.meta.url).href,
) as Promise<MockChangeRequestModule>;

beforeEach(async () => {
  const { resetMockPartnerChangeRequestStore } = await mockChangeRequests;
  resetMockPartnerChangeRequestStore();
});

test("검토 큐 mock 페이지는 오래된 요청부터 필요한 행만 반환한다", async () => {
  const { listMockPartnerChangeRequestPage, listMockPartnerChangeRequests } = await mockChangeRequests;
  const all = await listMockPartnerChangeRequests();
  const page = await listMockPartnerChangeRequestPage({ page: 1, pageSize: 1 });

  assert.equal(page.totalCount, all.length);
  assert.equal(page.requests.length, Math.min(1, all.length));
  assert.equal(page.requests[0]?.id, all[0]?.id);
  assert.ok(
    all.every((request, index) =>
      index === 0 || all[index - 1].createdAt <= request.createdAt,
    ),
  );
});

test("비어 있는 지역 권한 범위는 전역 변경 요청을 노출하지 않는다", async () => {
  const { listMockPartnerChangeRequestPage } = await mockChangeRequests;
  const page = await listMockPartnerChangeRequestPage({
    partnerIds: [],
    page: 1,
    pageSize: 12,
  });

  assert.deepEqual(page.requests, []);
  assert.equal(page.totalCount, 0);
});

test("변경 요청 큐 read-model은 regional scope를 페이지네이션 전에 적용한다", async () => {
  const { getAdminPartnerChangeRequestQueueReadModel } = await import(
    new URL(
      "../src/lib/admin-partner-change-request-queue.server.ts",
      import.meta.url,
    ).href,
  );

  const emptyScope = await getAdminPartnerChangeRequestQueueReadModel({
    managedCampusSlugs: [],
    page: 1,
    pageSize: 12,
  });
  const globalScope = await getAdminPartnerChangeRequestQueueReadModel({
    managedCampusSlugs: null,
    page: 1,
    pageSize: 12,
  });

  assert.equal(emptyScope.queueLoadError, false);
  assert.deepEqual(emptyScope.requestPage.requests, []);
  assert.equal(emptyScope.requestPage.totalCount, 0);
  assert.equal(globalScope.queueLoadError, false);
  assert.ok(globalScope.requestPage.totalCount > 0);
});

test("관리자 제휴처 변경 요청 라우트는 지역 권한 조회를 서버 read-model에 위임한다", async () => {
  const [pageSource, readModelSource] = await Promise.all([
    readFile(
      new URL(
        "../src/app/admin/(protected)/partner-requests/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/admin-partner-change-request-queue.server.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(pageSource, /getAdminPartnerChangeRequestQueueReadModel/);
  assert.doesNotMatch(pageSource, /getSupabaseAdminClient/);
  assert.doesNotMatch(pageSource, /listPartnerChangeRequestPage/);
  assert.match(readModelSource, /getSupabaseAdminClient/);
  assert.match(readModelSource, /isPartnerPortalMock/);
  assert.match(readModelSource, /currentCampusSlugs/);
  assert.match(readModelSource, /listPartnerChangeRequestPage/);
  assert.doesNotMatch(readModelSource, /Error\.message/);
});
