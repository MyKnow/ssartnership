import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("제휴처 수정 실패는 내부 오류를 노출하지 않고 상세 경로로 복구한다", async () => {
  const [actionSource, errorSource] = await Promise.all([
    readFile(
      new URL(
        "../src/app/admin/(protected)/_actions/partner-actions/update.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/admin-action-errors.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(actionSource, /redirectAdminActionError/);
  assert.match(actionSource, /partner_update_failed/);
  assert.match(actionSource, /stage: "mutation"/);
  assert.match(actionSource, /stage: "media"/);
  assert.doesNotMatch(actionSource, /rollbackPartnerUpdateMutation/);
  assert.match(errorSource, /partner_update_failed:/);
});
