import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("푸시 운영 첫 화면은 대상자 전체 목록 대신 서버 read-model의 집계만 사용한다", async () => {
  const [page, readModel, manager] = await Promise.all([
    read("src/app/admin/(protected)/push/page.tsx"),
    read("src/lib/admin-push-read-model.server.ts"),
    read("src/components/admin/AdminPushManager.tsx"),
  ]);

  assert.match(page, /getAdminPushReadModel/);
  assert.match(page, /includeAudience: initialTab === "send"/);
  assert.doesNotMatch(page, /getSupabaseAdminClient/);
  assert.doesNotMatch(page, /getMmUserDirectoryEntriesByAccountIds/);
  assert.match(readModel, /select\("generation,campus", \{ count: "exact" \}\)/);
  assert.match(readModel, /select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(readModel, /partnerCount/);
  assert.match(readModel, /includeAudience = true/);
  assert.match(readModel, /getAdminNotificationOverview/);
  assert.match(manager, /recipientOptions/);
  assert.match(manager, /onRecipientOptionsLoaded/);
});

test("개인 수신자 검색은 권한 검증된 제한 API와 안전한 입력 정규화를 사용한다", async () => {
  const [route, searchService, composer] = await Promise.all([
    read("src/app/api/admin/push/recipients/route.ts"),
    read("src/lib/admin-push-recipient-search.server.ts"),
    read("src/components/admin/push-manager/PushComposerSection.tsx"),
  ]);
  const { normalizeAdminPushRecipientSearch } = await import(
    new URL("../src/lib/admin-push-recipient-search.server.ts", import.meta.url).href,
  );

  assert.equal(normalizeAdminPushRecipientSearch("  김  싸피  "), "김 싸피");
  assert.equal(normalizeAdminPushRecipientSearch("x".repeat(100)), "x".repeat(80));
  assert.match(route, /ensureAdminApiPermission\(request, "notifications", "read"\)/);
  assert.match(route, /listAdminPushRecipientOptions/);
  assert.match(searchService, /MAX_RECIPIENT_LIMIT = 50/);
  assert.match(searchService, /ilike/);
  assert.doesNotMatch(searchService, /Error\.message/);
  assert.match(composer, /\/api\/admin\/push\/recipients/);
  assert.match(composer, /검색 결과는 최대/);
});

test("mock 개인 대상 검색은 실패 대신 재사용 가능한 안전한 결과를 반환한다", async () => {
  const previousDataSource = process.env.NEXT_PUBLIC_DATA_SOURCE;
  process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";

  try {
    const { listAdminPushRecipientOptions } = await import(
      new URL("../src/lib/admin-push-recipient-search.server.ts", import.meta.url).href,
    );
    const result = await listAdminPushRecipientOptions({ query: "정민" });

    assert.equal(result.failed, false);
    assert.equal(result.recipients.length, 1);
    assert.equal(result.recipients[0]?.mm_username, "jung.minho15");
  } finally {
    if (previousDataSource === undefined) {
      delete process.env.NEXT_PUBLIC_DATA_SOURCE;
    } else {
      process.env.NEXT_PUBLIC_DATA_SOURCE = previousDataSource;
    }
  }
});
