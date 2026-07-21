import assert from "node:assert/strict";
import test from "node:test";

import {
  isPartnerBenefitUseAvailable,
  isPartnerBenefitUsePin,
  normalizePartnerBenefitSelection,
} from "../src/lib/partner-benefit-usage.ts";
import { hashCouponVerificationPassword } from "../src/lib/coupon-verification-password.ts";
import {
  PartnerBenefitUsageError,
  recordPartnerBenefitUsage,
} from "../src/lib/partner-benefit-usage-service.ts";
import { MockPartnerBenefitUsageRepository } from "../src/lib/repositories/mock/partner-benefit-usage-repository.mock.ts";

test("benefit selection accepts only an exact registered benefit", () => {
  const benefits = ["헬스 1개월 33,000원", "필라테스 10회 199,000원"];

  assert.equal(
    normalizePartnerBenefitSelection(benefits, "필라테스 10회 199,000원"),
    "필라테스 10회 199,000원",
  );
  assert.equal(normalizePartnerBenefitSelection(benefits, "등록되지 않은 혜택"), null);
  assert.equal(normalizePartnerBenefitSelection(benefits, ""), null);
});

test("offline benefit use requires an active partner period", () => {
  assert.equal(
    isPartnerBenefitUseAvailable({
      location: "서울 강남구 테헤란로 212",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      now: new Date("2026-07-20T03:00:00.000Z"),
    }),
    true,
  );
  assert.equal(
    isPartnerBenefitUseAvailable({
      location: "온라인",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      now: new Date("2026-07-20T03:00:00.000Z"),
    }),
    false,
  );
  assert.equal(
    isPartnerBenefitUseAvailable({
      location: "서울 강남구 테헤란로 212",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-19",
      now: new Date("2026-07-20T03:00:00.000Z"),
    }),
    false,
  );
});

test("partner benefit PIN is exactly four digits", () => {
  assert.equal(isPartnerBenefitUsePin("0000"), true);
  assert.equal(isPartnerBenefitUsePin("1234"), true);
  assert.equal(isPartnerBenefitUsePin("123"), false);
  assert.equal(isPartnerBenefitUsePin("12a4"), false);
  assert.equal(isPartnerBenefitUsePin("12345"), false);
});

test("idempotent benefit-use retries do not create a second aggregate record", async () => {
  const pin = await hashCouponVerificationPassword("0427");
  const repository = new MockPartnerBenefitUsageRepository([
    {
      partnerId: "partner-1",
      location: "서울 강남구 테헤란로 212",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      benefits: ["헬스 1개월 33,000원"],
      pinHash: pin.hash,
      pinSalt: pin.salt,
    },
  ]);

  const input = {
    repository,
    partnerId: "partner-1",
    memberId: "member-1",
    benefit: "헬스 1개월 33,000원",
    useCount: 1,
    pin: "0427",
    idempotencyKey: "retry-key",
  };

  const first = await recordPartnerBenefitUsage(input);
  const retry = await recordPartnerBenefitUsage(input);

  assert.equal(first.isNew, true);
  assert.equal(retry.isNew, false);
  assert.equal(retry.usageId, first.usageId);
});

test("benefit-use cannot record usage when the partner PIN is not configured", async () => {
  const repository = new MockPartnerBenefitUsageRepository([
    {
      partnerId: "partner-without-pin",
      location: "서울 강남구 테헤란로 212",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      benefits: ["헬스 1개월 33,000원"],
      pinHash: null,
      pinSalt: null,
    },
  ]);

  await assert.rejects(
    () =>
      recordPartnerBenefitUsage({
        repository,
        partnerId: "partner-without-pin",
        memberId: "member-1",
        benefit: "헬스 1개월 33,000원",
        useCount: 1,
        pin: "0427",
        idempotencyKey: "no-pin-request",
      }),
    (error: unknown) =>
      error instanceof PartnerBenefitUsageError &&
      error.code === "pin_not_configured",
  );
});
