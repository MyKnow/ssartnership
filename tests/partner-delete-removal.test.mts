import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("제휴처 상세에서 삭제 전용 UI와 Server Action이 제거되어 있다", async () => {
  const [form, actions, page, partnerActions] = await Promise.all([
    readFile(new URL("../src/components/partner-card-form/PartnerCardForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/(protected)/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/(protected)/partners/[partnerId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/(protected)/_actions/partner-actions.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(form, /deleteAction|partnerFormIntent|deleteRedirectTo/);
  assert.doesNotMatch(actions, /deletePartnerAction|deletePartner\(/);
  assert.doesNotMatch(page, /deletePartner|deleteRedirectTo|partner_delete/);
  assert.doesNotMatch(partnerActions, /deletePartnerAction/);
  assert.equal(
    existsSync(new URL("../src/app/admin/(protected)/_actions/partner-actions/delete.ts", import.meta.url)),
    false,
  );
});

test("제휴처 삭제 감사 이벤트는 신규 앱 계약과 알림 조회에서 제외되어 있다", async () => {
  const [catalog, operation, notifications, logUtils, eventLoggingDoc] = await Promise.all([
    readFile(new URL("../src/lib/event-catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/partner-notifications-operation.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/partner-notifications.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/logs/utils.ts", import.meta.url), "utf8"),
    readFile(new URL("../docs/architecture/event-logging.md", import.meta.url), "utf8"),
  ]);

  for (const source of [catalog, operation, notifications, logUtils, eventLoggingDoc]) {
    assert.doesNotMatch(source, /partner_delete/);
  }
});
