import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  ADMIN_AUDIT_ACTIONS,
  AUTH_SECURITY_EVENT_NAMES,
  PRODUCT_EVENT_NAMES,
} from "../src/lib/event-catalog.ts";
import { buildPartnerMetricRollupRowsFromEventLogs } from "../src/lib/partner-metric-rollups.ts";
import { getLogLabel } from "../src/lib/log-insights/utils.ts";
import { parseProductEventRequest } from "../src/lib/product-event-contract.ts";

test("파트너 원본 이벤트 재집계는 운영자·파트너 트래픽을 PV·UV에서 제외한다", () => {
  const rows = buildPartnerMetricRollupRowsFromEventLogs(
    ["guest", "member", "admin", "partner"].map((actor_type) => ({
      target_id: "partner-a",
      event_name: "partner_detail_view" as const,
      actor_type,
      actor_id: actor_type === "guest" ? null : actor_type,
      session_id: actor_type,
      created_at: "2026-10-05T03:00:00.000Z",
    })),
    "partner-a",
  );
  assert.equal(rows.find((row) => row.granularity === "total" && row.metric_kind === "pv")?.metric_count, 2);
  assert.equal(rows.find((row) => row.granularity === "total" && row.metric_kind === "uv")?.metric_count, 2);
  assert.equal(buildPartnerMetricRollupRowsFromEventLogs([
    { target_id: "partner-a", event_name: "partner_card_click", actor_type: "admin", actor_id: "a", session_id: "a", created_at: "2026-10-05T03:00:00.000Z" },
  ], "partner-a").length, 0);
});

test("제품·관리자 감사·보안 이벤트 카탈로그의 모든 이름에는 한국어 라벨이 있다", () => {
  for (const [group, names] of [
    ["product", PRODUCT_EVENT_NAMES],
    ["audit", ADMIN_AUDIT_ACTIONS],
    ["security", AUTH_SECURITY_EVENT_NAMES],
  ] as const) {
    for (const name of names) {
      const label = getLogLabel(group, name);
      assert.notEqual(label, name, `${group}: ${name}`);
      assert.match(label, /[가-힣]/u);
    }
  }
});

test("클라이언트 분석 속성은 이메일·계정 식별자·자유 텍스트를 저장하지 않는다", () => {
  const parsed = parseProductEventRequest({
    eventId: randomUUID(), schemaVersion: 1, occurredAt: new Date().toISOString(),
    eventName: "search_execute", targetType: "partner_search", targetId: null,
    properties: { hasQuery: true, queryLength: 4, email: "privacy@example.test", mmUsername: "fixture", studentId: "fixture", query: "free text", resultCount: 3 },
  });
  assert.deepEqual(parsed.properties, { hasQuery: true, queryLength: 4, resultCount: 3 });
});
