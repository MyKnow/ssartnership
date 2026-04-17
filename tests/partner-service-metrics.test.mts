import assert from "node:assert/strict";
import test from "node:test";

type PartnerServiceMetricsModule =
  typeof import("../src/lib/partner-service-metrics.ts");
type MockPartnerPortalModule = typeof import("../src/lib/mock/partner-portal.ts");

process.env.NEXT_PUBLIC_DATA_SOURCE = process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock";
process.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE =
  process.env.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE ?? "mock";

const partnerServiceMetricsModulePromise = import(
  new URL("../src/lib/partner-service-metrics.ts", import.meta.url).href,
) as Promise<PartnerServiceMetricsModule>;
const mockPartnerPortalModulePromise = import(
  new URL("../src/lib/mock/partner-portal.ts", import.meta.url).href,
) as Promise<MockPartnerPortalModule>;

test("returns seeded metrics for a mock partner service", async () => {
  const { resetMockPartnerPortalStore } = await mockPartnerPortalModulePromise;
  const { getPartnerServiceMetrics } = await partnerServiceMetricsModulePromise;

  resetMockPartnerPortalStore();

  const snapshot = await getPartnerServiceMetrics("mock-partner-service-cafe-haeon-main");

  assert.equal(snapshot.warningMessage, null);
  assert.equal(snapshot.metrics.detailViews, 1240);
  assert.equal(snapshot.metrics.totalClicks, 525);
  assert.equal(snapshot.metrics.reservationClicks, 81);
  assert.equal(snapshot.metrics.inquiryClicks, 26);
});
