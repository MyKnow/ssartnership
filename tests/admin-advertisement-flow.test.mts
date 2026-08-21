import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("광고 관리 첫 화면은 캐러셀을 먼저 보여주고 캠페인 운영 데이터를 지연한다", async () => {
  const [page, view, repository] = await Promise.all([
    read("src/app/admin/(protected)/advertisement/page.tsx"),
    read("src/components/admin/AdminAdvertisementView.tsx"),
    read("src/lib/repositories/ad-package-repository.ts"),
  ]);

  assert.match(page, /listAdminCampaignOptions/);
  assert.match(page, /campaignsPromise/);
  assert.match(view, /<Suspense/);
  assert.match(view, /await campaignsPromise/);
  assert.match(view, /AdminAdPackageManager/);
  assert.match(repository, /listAdminCampaignOptions/);
});
