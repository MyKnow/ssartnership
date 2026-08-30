import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderDefaultNotificationEmailContent } from "@/lib/notification-email-content";
import { getNotificationTemplateDefinition } from "@/lib/notification-templates/catalog";

const routeSourcePromise = readFile(
  new URL("../src/app/api/suggest/route.ts", import.meta.url),
  "utf8",
);

test("제휴 제안 메일은 검증되지 않은 담당자 주소를 수신자로 사용하지 않는다", async () => {
  const source = await routeSourcePromise;

  assert.match(
    source,
    /const recipient = process\.env\.SUGGEST_NOTIFY_EMAIL\?\.trim\(\) \|\| BUG_REPORT_EMAIL;/,
  );
  assert.match(
    source,
    /await sendTransactionalEmail\(\{[\s\S]*?to: recipient,\s*replyTo: payload\.contactEmail,/,
  );
  assert.doesNotMatch(source, /\b(?:to|bcc)\s*:\s*payload\.contactEmail\b/);
  assert.doesNotMatch(source, /\bbcc\s*:/);
});

test("제휴 제안 API는 동일 출처 JSON 요청만 허용한다", async () => {
  const source = await routeSourcePromise;

  assert.match(source, /isTrustedSameOriginRequest\(request,/);
  assert.match(source, /allowedContentTypes: \["application\/json"\]/);
  assert.match(source, /"suggest_request_not_allowed"/);
});

test("제휴 제안 메일 기본 문구는 내부 운영 검토용으로 표시된다", () => {
  const definition = getNotificationTemplateDefinition(
    "email.partner_suggestion_received",
  );
  assert.ok(definition);
  assert.match(definition.description, /내부 운영 수신처/);
  assert.match(definition.bodyTemplate, /운영 검토가 필요한/);
  assert.doesNotMatch(definition.bodyTemplate, /^안녕하세요/m);

  const rendered = renderDefaultNotificationEmailContent(definition.eventKey, {
    siteName: "싸트너십",
    contactName: "홍길동",
    contactRole: "담당자",
    companyName: "예시 파트너",
    businessArea: "서비스",
    partnershipConditions: "구성원 할인",
    contactEmail: "unverified@example.com",
    companyUrl: "https://partner.example.com",
  });

  assert.ok(rendered);
  assert.match(rendered.text, /운영 검토가 필요한 제휴 제안/);
  assert.match(rendered.text, /홍길동 담당자에게 회신하려면/);
  assert.doesNotMatch(rendered.text, /보내주신 제휴 제안을 접수했습니다/);
});
