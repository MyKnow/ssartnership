import assert from "node:assert/strict";
import test from "node:test";

type PartnerDetailHelpersModule =
  typeof import("../src/components/partner/partner-service-detail-view/helpers.ts");

const partnerDetailHelpersPromise = import(
  new URL(
    "../src/components/partner/partner-service-detail-view/helpers.ts",
    import.meta.url,
  ).href,
) as Promise<PartnerDetailHelpersModule>;

test("partner detail helpers append alpha only for 6-digit hex colors", async () => {
  const { withAlpha } = await partnerDetailHelpersPromise;

  assert.equal(withAlpha("#2563eb", "1f"), "#2563eb1f");
  assert.equal(withAlpha("rgb(0,0,0)", "1f"), "rgb(0,0,0)");
});

test("partner detail visual state disables contact displays for inactive periods", async () => {
  const { getPartnerServiceVisualState } = await partnerDetailHelpersPromise;

  const state = getPartnerServiceVisualState({
    categoryColor: "#2563eb",
    thumbnail: "/thumb.png",
    mapUrl: "https://maps.example.com",
    partnerLocation: "역삼",
    partnerName: "테스트 제휴",
    reservationLink: "https://reserve.example.com",
    inquiryLink: "mailto:test@example.com",
    periodStart: "2025-01-01",
    periodEnd: "2025-01-31",
  } as never);

  assert.equal(state.isActive, false);
  assert.equal(state.reservationDisplay, null);
  assert.equal(state.inquiryDisplay, null);
  assert.equal(state.contactCount, 0);
});
