import assert from "node:assert/strict";
import test from "node:test";

import { serializeAdminLogsCsvRow } from "@/lib/log-insights/csv";
import type { UnifiedCsvRow } from "@/lib/log-insights";

function rowWithAction(action: string): UnifiedCsvRow {
  return {
    group: "audit",
    action,
    status: null,
    actorType: "admin",
    actorName: null,
    actorMmUsername: null,
    actorId: null,
    identifier: null,
    ipAddress: null,
    path: null,
    referrer: null,
    targetType: null,
    targetId: null,
    createdAt: "2026-07-15T03:00:00.000Z",
    properties: null,
  };
}

test("CSV는 수식으로 해석될 수 있는 문자열을 텍스트로 고정한다", () => {
  for (const value of ["=1+1", "+SUM(A1:A2)", "-1+2", "@cmd", " \t=IMPORTXML(\"x\")"]) {
    const csv = serializeAdminLogsCsvRow(rowWithAction(value));
    assert.match(csv, /'\s*(?:=|\+|-|@)/);
  }
});

test("CSV는 개행과 따옴표를 안전하게 이스케이프한다", () => {
  const csv = serializeAdminLogsCsvRow(rowWithAction('"hello"\r\nworld'));
  assert.match(csv, /""hello"" world"/);
  assert.doesNotMatch(csv, /\r|\n/);
});
