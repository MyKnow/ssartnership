import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("이벤트 상세는 운영 설정을 먼저 렌더링하고 추첨권 운영 패널을 지연한다", async () => {
  const [pageSource, viewSource] = await Promise.all([
    readFile(
      new URL("../src/app/admin/(protected)/event/[slug]/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/admin/AdminEventDetailView.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(pageSource, /rewardContentPromise/);
  assert.match(pageSource, /getSignupRewardContent/);
  assert.match(viewSource, /<Suspense/);
  assert.match(viewSource, /await rewardContentPromise/);
  assert.match(viewSource, /추첨권 현황을 불러오는 중입니다/);
});
