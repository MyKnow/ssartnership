import assert from "node:assert/strict";
import test from "node:test";

type PartnerMetricRollupsModule =
  typeof import("../src/lib/partner-metric-rollups.ts");
type PartnerServiceMetricsModule =
  typeof import("../src/lib/partner-service-metrics.ts");

const partnerMetricRollupsModulePromise = import(
  new URL("../src/lib/partner-metric-rollups.ts", import.meta.url).href,
) as Promise<PartnerMetricRollupsModule>;
const partnerServiceMetricsModulePromise = import(
  new URL("../src/lib/partner-service-metrics.ts", import.meta.url).href,
) as Promise<PartnerServiceMetricsModule>;

test("rollup rows are accumulated into service metrics", async () => {
  const { applyPartnerMetricRollupRows } = await partnerMetricRollupsModulePromise;
  const { createEmptyPartnerServiceMetrics } = await partnerServiceMetricsModulePromise;

  const metricsByPartnerId = new Map([
    ["partner-a", createEmptyPartnerServiceMetrics()],
  ]);

  applyPartnerMetricRollupRows(metricsByPartnerId, [
    {
      partner_id: "partner-a",
      metric_name: "partner_detail_view",
      metric_kind: "pv",
      granularity: "total",
      bucket_timezone: "Asia/Seoul",
      bucket_local_start: null,
      bucket_local_date: null,
      bucket_local_dow: null,
      metric_count: 12,
    },
    {
      partner_id: "partner-a",
      metric_name: "partner_card_click",
      metric_kind: "pv",
      granularity: "total",
      bucket_timezone: "Asia/Seoul",
      bucket_local_start: null,
      bucket_local_date: null,
      bucket_local_dow: null,
      metric_count: 3,
    },
    {
      partner_id: "partner-a",
      metric_name: "reservation_click",
      metric_kind: "pv",
      granularity: "total",
      bucket_timezone: "Asia/Seoul",
      bucket_local_start: null,
      bucket_local_date: null,
      bucket_local_dow: null,
      metric_count: 2,
    },
    {
      partner_id: "partner-a",
      metric_name: "partner_detail_view",
      metric_kind: "uv",
      granularity: "total",
      bucket_timezone: "Asia/Seoul",
      bucket_local_start: null,
      bucket_local_date: null,
      bucket_local_dow: null,
      metric_count: 7,
    },
  ]);

  const metrics = metricsByPartnerId.get("partner-a");
  assert.ok(metrics);
  assert.equal(metrics.detailViews, 12);
  assert.equal(metrics.detailUv, 7);
  assert.equal(metrics.cardClicks, 3);
  assert.equal(metrics.reservationClicks, 2);
  assert.equal(metrics.totalClicks, 5);
});

test("raw partner events can be rebuilt into rollup rows", async () => {
  const { buildPartnerMetricRollupRowsFromEventLogs } = await partnerMetricRollupsModulePromise;

  const rows = buildPartnerMetricRollupRowsFromEventLogs(
    [
      {
        target_id: "partner-a",
        event_name: "partner_detail_view",
        actor_type: "guest",
        actor_id: null,
        session_id: "session-a",
        created_at: "2026-04-19T03:20:00.000Z",
      },
      {
        target_id: "partner-a",
        event_name: "partner_detail_view",
        actor_type: "guest",
        actor_id: null,
        session_id: "session-a",
        created_at: "2026-04-19T03:21:00.000Z",
      },
      {
        target_id: "partner-a",
        event_name: "partner_card_click",
        actor_type: "guest",
        actor_id: null,
        session_id: "session-a",
        created_at: "2026-04-19T03:22:00.000Z",
      },
    ],
    "partner-a",
  );

  const totalPv = rows.find(
    (row) =>
      row.metric_name === "partner_detail_view" &&
      row.metric_kind === "pv" &&
      row.granularity === "total",
  );
  const totalUv = rows.find(
    (row) =>
      row.metric_name === "partner_detail_view" &&
      row.metric_kind === "uv" &&
      row.granularity === "total",
  );
  const totalCardClick = rows.find(
    (row) =>
      row.metric_name === "partner_card_click" &&
      row.metric_kind === "pv" &&
      row.granularity === "total",
  );

  assert.equal(totalPv?.metric_count, 2);
  assert.equal(totalUv?.metric_count, 1);
  assert.equal(totalCardClick?.metric_count, 1);
});
