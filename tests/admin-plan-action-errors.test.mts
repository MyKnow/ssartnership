import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("플랜 입금 확인 실패는 내부 오류 메시지를 redirect에 전달하지 않는다", async () => {
  const source = await readFile(
    new URL(
      "../src/app/admin/(protected)/_actions/plan-actions.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /getSafeAdminActionErrorCode\(/);
  assert.doesNotMatch(
    source,
    /error instanceof Error \? error\.message : "partner_company_plan_invalid_request"/,
  );
});
