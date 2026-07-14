import assert from "node:assert/strict";
import test from "node:test";

import { applyAdminLogsPrivacy, maskUnifiedCsvRow } from "@/lib/log-insights/privacy";
import type { AdminLogsPageData, UnifiedCsvRow } from "@/lib/log-insights";

const rawRow: UnifiedCsvRow = {
  group: "security",
  action: "member_login",
  status: "success",
  actorType: "member",
  actorName: "김싸피",
  actorMmUsername: "ssafy15",
  actorId: "7dddb2c7-2c4b-4e31-a2f0-99ce4f5ee4ee",
  identifier: "ssafy15@example.com",
  ipAddress: "203.0.113.24",
  path: "/auth/login",
  referrer: "/?email=ssafy15@example.com",
  targetType: "member",
  targetId: "c7ffeb59-a0c0-4d03-a849-17f9c61af721",
  createdAt: "2026-07-15T03:00:00.000Z",
  properties: { email: "ssafy15@example.com", mmUsername: "ssafy15" },
};

test("PII 권한이 없으면 CSV 행의 식별자·IP·속성을 공통 마스킹한다", () => {
  const masked = maskUnifiedCsvRow(rawRow, false);

  assert.equal(masked.actorName, null);
  assert.equal(masked.actorMmUsername, null);
  assert.equal(masked.actorId, null);
  assert.equal(masked.identifier, null);
  assert.equal(masked.ipAddress, null);
  assert.equal(masked.referrer, null);
  assert.equal(masked.targetId, null);
  assert.equal(masked.properties, null);
  assert.equal(masked.path, null);
});

test("PII 권한이 있으면 원문 로그 행을 그대로 보존한다", () => {
  assert.deepEqual(maskUnifiedCsvRow(rawRow, true), rawRow);
});

test("PII 권한이 없는 페이지 응답은 목록과 상위 식별자 집계를 함께 제거한다", () => {
  const pageData = {
    access: { readGroups: ["security"], exportGroups: [], includePii: false },
    range: { preset: "24h", start: rawRow.createdAt, end: rawRow.createdAt, label: "24시간", bucketLabel: "2시간", durationMs: 1 },
    counts: { product: 0, audit: 0, security: 1 },
    truncated: { product: false, audit: false, security: false, any: false, limitPerGroup: null },
    partialFailure: { product: false, audit: false, security: false, any: false },
    chartBuckets: [],
    filters: { availableNames: [], actorOptions: ["member"] },
    summary: {
      topProductEvents: [],
      topAuditActions: [],
      topActors: [{ label: "ssafy15@example.com", value: "1건" }],
      topIps: [{ label: "203.0.113.24", value: "1건" }],
      topPaths: [{ label: "/api/admin/profile-photos/current/7dddb2c7-2c4b-4e31-a2f0-99ce4f5ee4ee", value: "1건" }],
      securityStatusCounts: { success: 1, failure: 0, blocked: 0 },
    },
    list: {
      productLogs: [],
      auditLogs: [],
      securityLogs: [{
        id: "security-1",
        event_name: "member_login",
        status: "success",
        actor_type: "member",
        actor_id: rawRow.actorId,
        actor_name: rawRow.actorName,
        actor_mm_username: rawRow.actorMmUsername,
        identifier: rawRow.identifier,
        path: rawRow.path,
        properties: rawRow.properties,
        ip_address: rawRow.ipAddress,
        created_at: rawRow.createdAt,
        partner_name: null,
      }],
      total: 1,
      page: 1,
      pageSize: 50,
    },
  } satisfies AdminLogsPageData;

  const masked = applyAdminLogsPrivacy(pageData);
  const securityLog = masked.list.securityLogs[0];
  assert.equal(securityLog?.actor_id, null);
  assert.equal(securityLog?.identifier, null);
  assert.equal(securityLog?.ip_address, null);
  assert.equal(securityLog?.path, null);
  assert.equal(securityLog?.properties, null);
  assert.deepEqual(masked.summary.topActors, []);
  assert.deepEqual(masked.summary.topIps, []);
  assert.deepEqual(masked.summary.topPaths, []);
});
