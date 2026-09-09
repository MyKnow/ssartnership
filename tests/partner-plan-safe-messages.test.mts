import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getSafePartnerPlanActionMessage } from "../src/lib/partner-plan-safe-messages.ts";

test("파트너 플랜 액션은 내부 오류 원문을 fallback으로 치환한다", () => {
  assert.equal(
    getSafePartnerPlanActionMessage(
      new Error("relation partner_plan_upgrade_requests does not exist"),
    ),
    "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  );
});

test("파트너 플랜 액션은 계약된 사용자 안내 문구만 유지한다", () => {
  assert.equal(
    getSafePartnerPlanActionMessage(
      new Error("플랜 또는 청구 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요."),
    ),
    "플랜 또는 청구 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
  );
  assert.equal(
    getSafePartnerPlanActionMessage(new Error("이미 처리된 업그레이드 요청입니다.")),
    "이미 처리된 업그레이드 요청입니다.",
  );
});

test("파트너 플랜 server action은 raw error.message를 redirect query로 전달하지 않는다", async () => {
  const source = await readFile(
    new URL("../src/app/partner/plans/actions.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /getSafePartnerPlanActionMessage/);
  assert.doesNotMatch(source, /error instanceof Error \? error\.message/);
});
