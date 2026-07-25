import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("제휴처 생성은 범위가 적용된 form-options read-model과 안전한 재시도를 사용한다", async () => {
  const [page, readModel] = await Promise.all([
    read("src/app/admin/(protected)/partners/new/page.tsx"),
    read("src/lib/admin-partner-form-options.server.ts"),
  ]);

  assert.match(page, /getAdminPartnerFormOptionsReadModel/);
  assert.doesNotMatch(page, /getSupabaseAdminClient/);
  assert.match(page, /제휴처 생성에 필요한 옵션을 불러오지 못했습니다/);
  assert.match(readModel, /overlaps\("managed_campus_slugs"/);
  assert.match(readModel, /Promise\.all/);
  assert.doesNotMatch(readModel, /Error\.message/);
});
