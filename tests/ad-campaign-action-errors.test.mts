import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { adminAdCampaignErrorMessages } from "@/lib/admin-action-errors";

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
  assert.match(page, /pickAllowedEntry<string>\(adminAdCampaignErrorMessages, error\)/);
  for (const code of [
    "ad_campaign_create_failed",
    "ad_campaign_invalid_request",
    "ad_campaign_invalid_status",
    "ad_campaign_update_failed",
  ]) {
    assert.ok(Object.hasOwn(adminAdCampaignErrorMessages, code), code);
  }
});

test("광고 캠페인 상태 변경은 전이 테이블 결과를 안전한 오류 코드로 복귀시킨다", async () => {
  const [actions, page, manager] = await Promise.all([
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
    readFile(
      new URL("../src/components/admin/ad-packages/AdminAdPackageManager.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(actions, /update = await adPackageRepository\.updateCampaignStatus\(/);
  assert.match(actions, /"ad_campaign_invalid_status_transition"/);
  assert.match(actions, /"ad_campaign_state_changed"/);
  assert.match(page, /ad_campaign_invalid_status_transition/);
  assert.match(page, /ad_campaign_state_changed/);
  assert.match(manager, /const nextStatuses = listAdCampaignStatusTransitions\(status\);/);
  assert.match(manager, /nextStatuses\.map\(/);
  assert.doesNotMatch(manager, /\(\["active", "paused", "ended"\] as const\)\.map/);
});
