import assert from "node:assert/strict";
import test from "node:test";

type PartnerMetricTimeseriesModule =
  typeof import("../src/lib/partner-metric-timeseries.ts");

const partnerMetricTimeseriesModulePromise = import(
  new URL("../src/lib/partner-metric-timeseries.ts", import.meta.url).href,
) as Promise<PartnerMetricTimeseriesModule>;

test("hour averages use partial-day denominators and keep zero buckets", async () => {
  const { buildPartnerMetricTimeseriesSnapshot } =
    await partnerMetricTimeseriesModulePromise;

  const snapshot = buildPartnerMetricTimeseriesSnapshot(
    "2026-04-19T03:20:00.000Z",
    [
      {
        partner_id: "partner-a",
        metric_name: "partner_detail_view",
        metric_kind: "pv",
        granularity: "hour",
        bucket_timezone: "Asia/Seoul",
        bucket_local_start: "2026-04-19T12:00:00",
        bucket_local_date: null,
        bucket_local_dow: null,
        metric_count: 10,
      },
      {
        partner_id: "partner-a",
        metric_name: "partner_detail_view",
        metric_kind: "uv",
        granularity: "hour",
        bucket_timezone: "Asia/Seoul",
        bucket_local_start: "2026-04-19T12:00:00",
        bucket_local_date: null,
        bucket_local_dow: null,
        metric_count: 4,
      },
      {
        partner_id: "partner-a",
        metric_name: "partner_detail_view",
        metric_kind: "pv",
        granularity: "hour",
        bucket_timezone: "Asia/Seoul",
        bucket_local_start: "2026-04-19T15:00:00",
        bucket_local_date: null,
        bucket_local_dow: null,
        metric_count: 6,
      },
      {
        partner_id: "partner-a",
        metric_name: "partner_card_click",
        metric_kind: "pv",
        granularity: "hour",
        bucket_timezone: "Asia/Seoul",
        bucket_local_start: "2026-04-19T12:00:00",
        bucket_local_date: null,
        bucket_local_dow: null,
        metric_count: 8,
      },
      {
        partner_id: "partner-a",
        metric_name: "reservation_click",
        metric_kind: "pv",
        granularity: "hour",
        bucket_timezone: "Asia/Seoul",
        bucket_local_start: "2026-04-19T12:00:00",
        bucket_local_date: null,
        bucket_local_dow: null,
        metric_count: 2,
      },
      {
        partner_id: "partner-a",
        metric_name: "inquiry_click",
        metric_kind: "pv",
        granularity: "hour",
        bucket_timezone: "Asia/Seoul",
        bucket_local_start: "2026-04-19T15:00:00",
        bucket_local_date: null,
        bucket_local_dow: null,
        metric_count: 6,
      },
    ],
    new Date("2026-04-20T05:10:00.000Z"),
  );

  assert.equal(snapshot.hour.points.length, 24);
  assert.equal(snapshot.hour.points[0]?.denominator, 1);
  assert.equal(snapshot.hour.points[0]?.pv, 0);
  assert.equal(snapshot.hour.points[12]?.denominator, 2);
  assert.equal(snapshot.hour.points[12]?.pv, 5);
  assert.equal(snapshot.hour.points[12]?.uv, 2);
  assert.equal(snapshot.hour.points[12]?.cta, 5);
  assert.equal(snapshot.hour.points[15]?.denominator, 1);
  assert.equal(snapshot.hour.points[15]?.pv, 6);
  assert.equal(snapshot.hour.points[15]?.cta, 6);
  assert.equal(snapshot.hour.maxAverage, 6);
});

test("weekday averages keep all seven buckets and divide by full-day overlap", async () => {
  const { buildPartnerMetricTimeseriesSnapshot } =
    await partnerMetricTimeseriesModulePromise;

  const snapshot = buildPartnerMetricTimeseriesSnapshot(
    "2026-04-19T00:00:00.000Z",
    [
      {
        partner_id: "partner-a",
        metric_name: "partner_detail_view",
        metric_kind: "pv",
        granularity: "weekday",
        bucket_timezone: "Asia/Seoul",
        bucket_local_start: null,
        bucket_local_date: null,
        bucket_local_dow: 1,
        metric_count: 7,
      },
      {
        partner_id: "partner-a",
        metric_name: "partner_detail_view",
        metric_kind: "uv",
        granularity: "weekday",
        bucket_timezone: "Asia/Seoul",
        bucket_local_start: null,
        bucket_local_date: null,
        bucket_local_dow: 1,
        metric_count: 3,
      },
      {
        partner_id: "partner-a",
        metric_name: "partner_detail_view",
        metric_kind: "pv",
        granularity: "weekday",
        bucket_timezone: "Asia/Seoul",
        bucket_local_start: null,
        bucket_local_date: null,
        bucket_local_dow: 7,
        metric_count: 14,
      },
      {
        partner_id: "partner-a",
        metric_name: "partner_detail_view",
        metric_kind: "uv",
        granularity: "weekday",
        bucket_timezone: "Asia/Seoul",
        bucket_local_start: null,
        bucket_local_date: null,
        bucket_local_dow: 7,
        metric_count: 7,
      },
      {
        partner_id: "partner-a",
        metric_name: "partner_card_click",
        metric_kind: "pv",
        granularity: "weekday",
        bucket_timezone: "Asia/Seoul",
        bucket_local_start: null,
        bucket_local_date: null,
        bucket_local_dow: 1,
        metric_count: 4,
      },
      {
        partner_id: "partner-a",
        metric_name: "inquiry_click",
        metric_kind: "pv",
        granularity: "weekday",
        bucket_timezone: "Asia/Seoul",
        bucket_local_start: null,
        bucket_local_date: null,
        bucket_local_dow: 1,
        metric_count: 3,
      },
      {
        partner_id: "partner-a",
        metric_name: "partner_map_click",
        metric_kind: "pv",
        granularity: "weekday",
        bucket_timezone: "Asia/Seoul",
        bucket_local_start: null,
        bucket_local_date: null,
        bucket_local_dow: 7,
        metric_count: 10,
      },
      {
        partner_id: "partner-a",
        metric_name: "reservation_click",
        metric_kind: "pv",
        granularity: "weekday",
        bucket_timezone: "Asia/Seoul",
        bucket_local_start: null,
        bucket_local_date: null,
        bucket_local_dow: 7,
        metric_count: 6,
      },
    ],
    new Date("2026-04-26T00:00:00.000Z"),
  );

  assert.equal(snapshot.weekday.points.length, 7);
  assert.deepEqual(
    snapshot.weekday.points.map((point) => point.denominator),
    [1, 1, 1, 1, 1, 1, 2],
  );
  assert.equal(snapshot.weekday.points[0]?.pv, 7);
  assert.equal(snapshot.weekday.points[0]?.uv, 3);
  assert.equal(snapshot.weekday.points[0]?.cta, 7);
  assert.equal(snapshot.weekday.points[6]?.pv, 7);
  assert.equal(snapshot.weekday.points[6]?.uv, 3.5);
  assert.equal(snapshot.weekday.points[6]?.cta, 8);
  assert.equal(snapshot.weekday.maxAverage, 8);
});
