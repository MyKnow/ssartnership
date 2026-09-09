import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyPartnerPortalMetrics,
} from "../src/lib/partner-dashboard.ts";
import {
  createEmptyPartnerServiceMetrics,
} from "../src/lib/partner-service-metrics.ts";
import {
  loadPartnerMetricAggregateRows,
  type PartnerMetricAggregateLoaders,
} from "../src/lib/partner-metric-loader.ts";
import type {
  PartnerMetricEventLogRow,
  PartnerMetricRollupRow,
} from "../src/lib/partner-metric-rollups.ts";

const TOTAL_DETAIL_VIEW_ROW: PartnerMetricRollupRow = {
  partner_id: "partner-a",
  metric_name: "partner_detail_view",
  metric_kind: "pv",
  granularity: "total",
  bucket_timezone: "Asia/Seoul",
  bucket_local_start: null,
  bucket_local_date: null,
  bucket_local_dow: null,
  metric_count: 3,
};

const FALLBACK_EVENT_ROWS: PartnerMetricEventLogRow[] = [
  {
    target_id: "partner-b",
    event_name: "partner_card_click",
    actor_type: "guest",
    actor_id: null,
    session_id: "session-b",
    created_at: "2026-04-19T03:22:00.000Z",
  },
  {
    target_id: "partner-a",
    event_name: "partner_detail_view",
    actor_type: "guest",
    actor_id: null,
    session_id: "session-a",
    created_at: "2026-04-19T03:20:00.000Z",
  },
  {
    target_id: "not-requested",
    event_name: "partner_detail_view",
    actor_type: "guest",
    actor_id: null,
    session_id: "session-other",
    created_at: "2026-04-19T03:21:00.000Z",
  },
];

const LOAD_OPTIONS = {
  partnerIds: ["partner-a", "partner-b"],
  metricNames: ["partner_detail_view", "partner_card_click"] as const,
  metricKinds: ["pv", "uv"] as const,
  granularity: "total" as const,
};

test("service metric callers share the canonical zero-value factory", () => {
  assert.equal(
    createEmptyPartnerServiceMetrics,
    createEmptyPartnerPortalMetrics,
  );
  assert.deepEqual(createEmptyPartnerServiceMetrics(), {
    favoriteCount: 0,
    detailViews: 0,
    detailUv: 0,
    cardClicks: 0,
    mapClicks: 0,
    reservationClicks: 0,
    inquiryClicks: 0,
    benefitUsageCount: 0,
    reviewCount: 0,
    totalClicks: 0,
  });
  assert.notEqual(
    createEmptyPartnerServiceMetrics(),
    createEmptyPartnerServiceMetrics(),
  );
});

test("rollup rows are returned without querying fallback event logs", async () => {
  let fallbackCalls = 0;
  const loaders: PartnerMetricAggregateLoaders = {
    fetchRollupRows: async () => ({
      rows: [TOTAL_DETAIL_VIEW_ROW],
      errorMessage: null,
    }),
    fetchEventLogRows: async () => {
      fallbackCalls += 1;
      return { rows: [], errorMessage: null };
    },
  };

  const result = await loadPartnerMetricAggregateRows(
    null as never,
    LOAD_OPTIONS,
    loaders,
  );

  assert.equal(result.source, "rollup");
  assert.equal(result.failure, null);
  assert.deepEqual(result.rows, [TOTAL_DETAIL_VIEW_ROW]);
  assert.equal(fallbackCalls, 0);
});

test("empty rollups rebuild each requested partner in an isolated fallback bucket", async () => {
  const loaders: PartnerMetricAggregateLoaders = {
    fetchRollupRows: async () => ({ rows: [], errorMessage: null }),
    fetchEventLogRows: async () => ({
      rows: FALLBACK_EVENT_ROWS,
      errorMessage: null,
    }),
  };

  const result = await loadPartnerMetricAggregateRows(
    null as never,
    LOAD_OPTIONS,
    loaders,
  );

  assert.equal(result.source, "event-log");
  assert.equal(result.failure, null);
  assert.ok(result.rows.length > 0);
  assert.equal(
    result.rows.every((row) => row.granularity === "total"),
    true,
  );
  assert.equal(
    result.rows.every((row) =>
      new Set<string>(LOAD_OPTIONS.metricNames).has(row.metric_name),
    ),
    true,
  );
  assert.deepEqual(
    [...new Set(result.rows.map((row) => row.partner_id))].sort(),
    ["partner-a", "partner-b"],
  );
  assert.equal(
    result.rows.some((row) => row.partner_id === "not-requested"),
    false,
  );

  const partnerATotalPv = result.rows.find(
    (row) =>
      row.partner_id === "partner-a" &&
      row.metric_name === "partner_detail_view" &&
      row.metric_kind === "pv" &&
      row.granularity === "total",
  );
  const partnerBTotalPv = result.rows.find(
    (row) =>
      row.partner_id === "partner-b" &&
      row.metric_name === "partner_card_click" &&
      row.metric_kind === "pv" &&
      row.granularity === "total",
  );
  assert.equal(partnerATotalPv?.metric_count, 1);
  assert.equal(partnerBTotalPv?.metric_count, 1);
});

test("empty metric-kind requests do not query either metric source", async () => {
  let calls = 0;
  const result = await loadPartnerMetricAggregateRows(
    null as never,
    { ...LOAD_OPTIONS, metricKinds: [] },
    {
      fetchRollupRows: async () => {
        calls += 1;
        return { rows: [], errorMessage: null };
      },
      fetchEventLogRows: async () => {
        calls += 1;
        return { rows: [], errorMessage: null };
      },
    },
  );

  assert.equal(calls, 0);
  assert.deepEqual(result, {
    rows: [],
    source: "rollup",
    failure: null,
  });
});

test("rollup and fallback failures retain their distinct partial-failure stages", async () => {
  let fallbackCalls = 0;
  const rollupFailure = await loadPartnerMetricAggregateRows(
    null as never,
    LOAD_OPTIONS,
    {
      fetchRollupRows: async () => ({
        rows: [],
        errorMessage: "rollup unavailable",
      }),
      fetchEventLogRows: async () => {
        fallbackCalls += 1;
        return { rows: [], errorMessage: null };
      },
    },
  );

  assert.deepEqual(rollupFailure.failure, {
    stage: "rollup",
    errorMessage: "rollup unavailable",
  });
  assert.equal(fallbackCalls, 0);

  const fallbackFailure = await loadPartnerMetricAggregateRows(
    null as never,
    LOAD_OPTIONS,
    {
      fetchRollupRows: async () => ({ rows: [], errorMessage: null }),
      fetchEventLogRows: async () => ({
        rows: [],
        errorMessage: "event log unavailable",
      }),
    },
  );

  assert.deepEqual(fallbackFailure.failure, {
    stage: "fallback",
    errorMessage: "event log unavailable",
  });
  assert.deepEqual(fallbackFailure.rows, []);
});
