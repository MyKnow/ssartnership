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
