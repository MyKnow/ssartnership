import assert from "node:assert/strict";
import { test } from "node:test";

import {
  toAdminPlatformActivityMetrics,
} from "@/lib/platform-activity-metrics";
import {
  buildActivityHeatmap,
  getActivityIntensity,
} from "@/lib/platform-activity-heatmap";

test("관리자 플랫폼 활성 지표 RPC 값을 회원 활성과 비로그인 방문으로 분리한다", () => {
  const metrics = toAdminPlatformActivityMetrics({
    as_of_date: "2026-07-21",
    member_dau: "18",
    member_wau: 72,
    member_mau: "241",
    guest_session_dau: "36",
    guest_session_wau: "162",
    guest_session_mau: 488,
    history_start_date: "2026-06-18",
    daily_series: [
      {
        activity_date: "2026-07-20",
        member_active_count: "16",
        guest_session_count: 42,
      },
      {
        activity_date: "2026-07-21",
        member_active_count: 18,
        guest_session_count: "36",
      },
    ],
  });

  assert.deepEqual(metrics, {
    asOfDate: "2026-07-21",
    memberDau: 18,
    memberWau: 72,
    memberMau: 241,
    guestSessionDau: 36,
    guestSessionWau: 162,
    guestSessionMau: 488,
    historyStartDate: "2026-06-18",
    dailySeries: [
      {
        date: "2026-07-20",
        memberActiveCount: 16,
        guestSessionCount: 42,
      },
      {
        date: "2026-07-21",
        memberActiveCount: 18,
        guestSessionCount: 36,
      },
    ],
  });
});

test("누락되거나 손상된 플랫폼 활성 지표는 안전한 빈 값으로 정규화한다", () => {
  assert.deepEqual(toAdminPlatformActivityMetrics({ daily_series: "not-json" }), {
    asOfDate: null,
    memberDau: 0,
    memberWau: 0,
    memberMau: 0,
    guestSessionDau: 0,
    guestSessionWau: 0,
    guestSessionMau: 0,
    historyStartDate: null,
    dailySeries: [],
  });
});

test("활성 추이는 GitHub 잔디처럼 주 단위 열과 요일 단위 행으로 정렬한다", () => {
  const heatmap = buildActivityHeatmap(
    Array.from({ length: 30 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 6, index + 1));
      return {
        date: date.toISOString().slice(0, 10),
        memberActiveCount: index === 0 ? 0 : index + 1,
        guestSessionCount: index * 2,
      };
    }),
  );

  assert.equal(heatmap.length, 5);
  assert.deepEqual(heatmap[0].cells.map((cell) => cell.date), [
    null,
    null,
    null,
    "2026-07-01",
    "2026-07-02",
    "2026-07-03",
    "2026-07-04",
  ]);
  assert.equal(heatmap[0].monthLabel, "7월");
  assert.equal(heatmap.every((week) => week.cells.length === 7), true);
  assert.equal(getActivityIntensity(0, 10), 0);
  assert.equal(getActivityIntensity(1, 10), 1);
  assert.equal(getActivityIntensity(10, 10), 4);
});
