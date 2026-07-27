import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ADMIN_TASK_OUTCOME_MIN_SAMPLE_COUNT,
  toAdminTaskOutcomeSummary,
} from "../src/lib/admin-task-outcome.ts";

test("관리자 과업 집계는 안전한 route label과 표본 상태를 제공한다", () => {
  const summary = toAdminTaskOutcomeSummary([
    {
      taskKey: "admin.partner-requests",
      startCount: 30,
      completeCount: 32,
      recoveryCount: 4,
      completionRate: 106,
      recoveryRate: -2,
      p75DurationMs: 130000,
    },
    {
      taskKey: "admin.members",
      startCount: 12,
      completeCount: 10,
      recoveryCount: 1,
      completionRate: "83.3",
      recoveryRate: "8.3",
      p75DurationMs: "164.5",
    },
    {
      taskKey: "/admin/members/private-id",
      startCount: 50,
      completionRate: "not-a-number",
    },
  ]);

  assert.equal(ADMIN_TASK_OUTCOME_MIN_SAMPLE_COUNT, 30);
  assert.deepEqual(
    summary.map(({ taskKey, label, startCount, completionRate, recoveryRate, p75DurationMs, status }) => ({
      taskKey,
      label,
      startCount,
      completionRate,
      recoveryRate,
      p75DurationMs,
      status,
    })),
    [
      {
        taskKey: "admin.unknown",
        label: "기타 관리자 화면",
        startCount: 50,
        completionRate: null,
        recoveryRate: null,
        p75DurationMs: null,
        status: "observed",
      },
      {
        taskKey: "admin.partner-requests",
        label: "변경 요청",
        startCount: 30,
        completionRate: 100,
        recoveryRate: 0,
        p75DurationMs: 120000,
        status: "observed",
      },
      {
        taskKey: "admin.members",
        label: "회원 관리",
        startCount: 12,
        completionRate: 83.3,
        recoveryRate: 8.3,
        p75DurationMs: 164.5,
        status: "insufficient_sample",
      },
    ],
  );
});

test("과업 집계는 원본 이벤트와 식별자를 UI 경계로 넘기지 않는다", async () => {
  const [serverSource, migrationSource, pageSource, panelSource] =
    await Promise.all([
      readFile(
        new URL("../src/lib/admin-task-outcome-summary.server.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../supabase/migrations/20260727051209_add_admin_task_outcome_summary.sql",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../src/app/admin/(protected)/logs/page.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/components/admin/AdminTaskOutcomeSummaryPanel.tsx", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(serverSource, /get_admin_task_outcome_summary/);
  assert.match(serverSource, /toAdminTaskOutcomeSummary/);
  assert.match(serverSource, /logAdminDataUnavailable/);
  assert.match(serverSource, /withAdminReadModelTimeout/);
  assert.doesNotMatch(serverSource, /console\.error/);
  assert.match(migrationSource, /percentile_cont\(0\.75\)/);
  assert.match(migrationSource, /security invoker/i);
  assert.match(migrationSource, /grant execute .* to service_role/i);
  assert.match(pageSource, /getAdminTaskOutcomeSummary/);
  assert.match(pageSource, /taskOutcome=\{taskOutcomePromise\}/);
  assert.match(panelSource, /overflow-x-auto/);
  assert.match(panelSource, /role="region"/);
  assert.doesNotMatch(panelSource, /rawProperties|memberId|partnerId/);
});
