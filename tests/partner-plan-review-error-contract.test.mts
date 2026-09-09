import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("플랜 검토 서비스는 관리자 액션에 안정적인 오류 코드를 제공한다", async () => {
  const [service, action, messages] = await Promise.all([
    readFile(new URL("src/lib/partner-plan-service.ts", root), "utf8"),
    readFile(
      new URL(
        "src/app/admin/(protected)/_actions/plan-actions.ts",
        root,
      ),
      "utf8",
    ),
    readFile(new URL("src/lib/admin-action-errors.ts", root), "utf8"),
  ]);

  for (const code of [
    "partner_company_plan_processed",
    "partner_company_plan_payment_unconfirmed",
    "partner_company_plan_invoice_missing",
    "partner_company_plan_partner_missing",
    "partner_company_plan_rejection_paid",
  ]) {
    assert.match(service, new RegExp(code));
    assert.match(messages, new RegExp(code));
  }

  assert.match(action, /getSafeAdminActionErrorCode/);
  assert.doesNotMatch(action, /error\.message\.includes\("이미 처리된"\)/);
  assert.doesNotMatch(action, /error\.message\.includes\("입금 확인"\)/);
});
