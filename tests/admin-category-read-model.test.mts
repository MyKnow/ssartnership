import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("카테고리 운영 화면은 조회를 read-model로 분리하고 N+1 count 조회를 만들지 않는다", async () => {
  const [page, readModel] = await Promise.all([
    read("src/app/admin/(protected)/categories/page.tsx"),
    read("src/lib/admin-category-read-model.server.ts"),
  ]);

  assert.match(page, /getAdminCategoryReadModel/);
  assert.doesNotMatch(page, /getSupabaseAdminClient/);
  assert.match(page, /카테고리 정보를 불러오지 못했습니다/);
  assert.match(readModel, /\.select\("category_id"\)/);
  assert.match(readModel, /\.in\("category_id", categoryIds\)/);
  assert.doesNotMatch(readModel, /throw new Error/);
  assert.doesNotMatch(readModel, /Error\.message/);
});
