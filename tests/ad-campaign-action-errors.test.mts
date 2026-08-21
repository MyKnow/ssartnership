import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("광고 캠페인 액션은 예상 가능한 오류를 안전한 화면 상태로 복귀시킨다", async () => {
  const [actions, page] = await Promise.all([
    readFile(
      new URL(
        "../src/app/admin/(protected)/_actions/ad-package-actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/app/admin/(protected)/advertisement/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(actions, /ad_campaign_create_failed/);
  assert.match(actions, /ad_campaign_invalid_request/);
  assert.match(actions, /ad_campaign_invalid_status/);
  assert.match(actions, /ad_campaign_update_failed/);
  assert.match(actions, /getSafeAdminActionErrorCode/);
  assert.doesNotMatch(actions, /throw new Error\("캠페인 상태를 확인해 주세요\."\)/);
  assert.match(page, /ad_campaign_create_failed/);
  assert.match(page, /ad_campaign_update_failed/);
});
