import assert from "node:assert/strict";
import test from "node:test";

import {
  isPartnerBenefitUseAvailable,
  isPartnerBenefitUsePin,
  normalizePartnerBenefitSelection,
} from "../src/lib/partner-benefit-usage.ts";
import { resolvePartnerBenefitById } from "../src/lib/partner-benefit-items.ts";
import {
  normalizeAdminUsageTimestamp,
  parseAdminPartnerBenefitUsageForm,
} from "../src/lib/partner-benefit-usage-admin.ts";
import { hashCouponVerificationPassword } from "../src/lib/coupon-verification-password.ts";
import {
  PartnerBenefitUsageError,
  recordPartnerBenefitUsage,
} from "../src/lib/partner-benefit-usage-service.ts";
import { MockPartnerBenefitUsageRepository } from "../src/lib/repositories/mock/partner-benefit-usage-repository.mock.ts";
import {
  MOCK_PARTNER_BENEFIT_USAGE_CONTEXTS,
} from "../src/lib/repositories/mock/partner-benefit-usage-repository.mock.ts";

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

test("legacy benefit IDs resolve to the current canonical benefit by display order", () => {
  const items = [
    { id: "canonical-2", title: "두 번째 혜택", maxApplyCount: null, displayOrder: 1 },
    { id: "canonical-1", title: "첫 번째 혜택", maxApplyCount: null, displayOrder: 0 },
  ];

  assert.equal(
    resolvePartnerBenefitById(items, "legacy-benefit-partner-1-2", "partner-1")?.id,
    "canonical-2",
  );
  assert.equal(
    resolvePartnerBenefitById(items, "legacy-benefit-partner-1-3", "partner-1"),
    null,
  );
  assert.equal(
    resolvePartnerBenefitById(items, "legacy-benefit-partner-2-2", "partner-1"),
    null,
  );
});

test("admin benefit usage form normalizes KST local timestamps and validates UUID fields", () => {
  const parsed = parseAdminPartnerBenefitUsageForm({
    partnerId: "00000000-0000-4000-8000-000000000001",
    memberId: "00000000-0000-4000-8000-000000000002",
    benefitId: "00000000-0000-4000-8000-000000000003",
    useCount: "2",
    verifiedAt: "2026-07-23T08:30",
  });

  assert.equal(parsed.useCount, 2);
  assert.equal(parsed.verifiedAt, "2026-07-22T23:30:00.000Z");
  assert.equal(
    normalizeAdminUsageTimestamp("2026-07-23T08:30:15"),
    "2026-07-22T23:30:15.000Z",
  );
});

test("idempotent benefit-use retries do not create a second aggregate record", async () => {
  const pin = await hashCouponVerificationPassword("0427");
  const repository = new MockPartnerBenefitUsageRepository([
    {
      partnerId: "partner-1",
      location: "서울 강남구 테헤란로 212",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      benefitItems: [{ id: "benefit-1", title: "헬스 1개월 33,000원", maxApplyCount: null }],
      pinHash: pin.hash,
      pinSalt: pin.salt,
    },
  ]);

  const input = {
    repository,
    partnerId: "partner-1",
    memberId: "member-1",
    benefitId: "benefit-1",
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
      benefitItems: [{ id: "benefit-1", title: "헬스 1개월 33,000원", maxApplyCount: null }],
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
        benefitId: "benefit-1",
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

test("카페 싸피 mock fixture accepts the fixed filming PIN 0000", async () => {
  const [context] = MOCK_PARTNER_BENEFIT_USAGE_CONTEXTS;
  assert.equal(context?.partnerId, "cafe-ssafy-001");

  const repository = new MockPartnerBenefitUsageRepository(
    MOCK_PARTNER_BENEFIT_USAGE_CONTEXTS,
  );
  const result = await recordPartnerBenefitUsage({
    repository,
    partnerId: "cafe-ssafy-001",
    memberId: "mock-member-jung-minho",
    benefitId: "cafe-benefit-americano",
    benefit: "아메리카노·콜드브루 1,000원 할인",
    useCount: 1,
    pin: "0000",
    idempotencyKey: "cafe-ssafy-demo-pin-0000",
  });

  assert.equal(result.isNew, true);
  assert.equal(result.useCount, 1);
});

test("configured benefit use maximum is enforced by the verification service", async () => {
  const pin = await hashCouponVerificationPassword("0427");
  const repository = new MockPartnerBenefitUsageRepository([
    {
      partnerId: "partner-with-limit",
      location: "서울 강남구 테헤란로 212",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      benefitItems: [{ id: "benefit-1", title: "헬스 1개월 33,000원", maxApplyCount: 2 }],
      pinHash: pin.hash,
      pinSalt: pin.salt,
    },
  ]);

  await assert.rejects(
    () =>
      recordPartnerBenefitUsage({
        repository,
        partnerId: "partner-with-limit",
        memberId: "member-1",
        benefitId: "benefit-1",
        benefit: "헬스 1개월 33,000원",
        useCount: 3,
        pin: "0427",
        idempotencyKey: "over-limit-request",
      }),
    (error: unknown) =>
      error instanceof PartnerBenefitUsageError &&
      error.code === "use_count_exceeded",
  );
});

test("legacy benefit IDs are converted before recording usage", async () => {
  const pin = await hashCouponVerificationPassword("0427");
  const repository = new MockPartnerBenefitUsageRepository([
    {
      partnerId: "partner-legacy-id",
      location: "서울 강남구 테헤란로 212",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      benefitItems: [
        { id: "canonical-1", title: "첫 번째 혜택", maxApplyCount: null },
        { id: "canonical-2", title: "두 번째 혜택", maxApplyCount: null },
      ],
      pinHash: pin.hash,
      pinSalt: pin.salt,
    },
  ]);

  const result = await recordPartnerBenefitUsage({
    repository,
    partnerId: "partner-legacy-id",
    memberId: "member-1",
    benefitId: "legacy-benefit-partner-legacy-id-2",
    benefit: "두 번째 혜택",
    useCount: 1,
    pin: "0427",
    idempotencyKey: "legacy-benefit-retry-key",
  });

  assert.equal(result.benefitId, "canonical-2");
  assert.equal(result.benefitSnapshot, "두 번째 혜택");
});

test("repository benefit and infrastructure errors keep distinct service codes", async () => {
  const pin = await hashCouponVerificationPassword("0427");
  const baseContext = {
    partnerId: "partner-error-map",
    location: "서울 강남구 테헤란로 212",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    benefitItems: [{ id: "benefit-1", title: "혜택", maxApplyCount: null }],
    pinHash: pin.hash,
    pinSalt: pin.salt,
  };

  for (const [repositoryMessage, expectedCode] of [
    ["partner_benefit_usage_benefit_not_found", "benefit_not_found"],
    ["partner_benefit_usage_member_not_found", "member_not_found"],
    ["database_connection_failed", "service_unavailable"],
  ] as const) {
    const repository = {
      getVerificationContext: async () => baseContext,
      recordUsage: async () => {
        throw new Error(repositoryMessage);
      },
      listUsageHistory: async () => ({ items: [], total: 0, page: 1, pageSize: 25 }),
    };

    await assert.rejects(
      () => recordPartnerBenefitUsage({
        repository,
        partnerId: baseContext.partnerId,
        memberId: "member-1",
        benefitId: "benefit-1",
        benefit: "혜택",
        useCount: 1,
        pin: "0427",
        idempotencyKey: `${repositoryMessage}-key`,
      }),
      (error: unknown) =>
        error instanceof PartnerBenefitUsageError && error.code === expectedCode,
    );
  }
});

test("mock admin usage repository supports create, update, list, and delete", async () => {
  const repository = new MockPartnerBenefitUsageRepository([
    {
      partnerId: "partner-admin-crud",
      location: "서울 강남구 테헤란로 212",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      benefitItems: [
        { id: "benefit-1", title: "첫 번째 혜택", maxApplyCount: null },
        { id: "benefit-2", title: "두 번째 혜택", maxApplyCount: null },
      ],
      pinHash: null,
      pinSalt: null,
    },
  ]);
  const baseInput = {
    partnerId: "partner-admin-crud",
    memberId: "member-1",
    benefitId: "benefit-1",
    useCount: 1,
    verifiedAt: "2026-07-23T00:00:00.000Z",
  };

  const created = await repository.createAdminUsage(baseInput);
  assert.equal(created.benefitSnapshot, "첫 번째 혜택");
  const updated = await repository.updateAdminUsage({
    ...baseInput,
    usageId: created.usageId,
    memberId: "member-2",
    benefitId: "benefit-2",
    verifiedAt: "2026-07-23T01:00:00.000Z",
  });
  assert.equal(updated.memberId, "member-2");
  assert.equal(updated.benefitId, "benefit-2");

  const listed = await repository.listUsageHistory({
    partnerId: "partner-admin-crud",
    page: 1,
    pageSize: 25,
  });
  assert.equal(listed.total, 1);
  assert.equal(listed.items[0]?.usageId, created.usageId);

  await repository.deleteAdminUsage({ partnerId: "partner-admin-crud", usageId: created.usageId });
  assert.equal((await repository.listUsageHistory({ partnerId: "partner-admin-crud", page: 1, pageSize: 25 })).total, 0);
});

test("missing benefit use maximum defaults to one per confirmation", async () => {
  const pin = await hashCouponVerificationPassword("0427");
  const repository = new MockPartnerBenefitUsageRepository([
    {
      partnerId: "partner-without-limit",
      location: "서울 강남구 테헤란로 212",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      benefitItems: [{ id: "benefit-1", title: "헬스 1개월 33,000원", maxApplyCount: null }],
      pinHash: pin.hash,
      pinSalt: pin.salt,
    },
  ]);

  await assert.rejects(
    () => recordPartnerBenefitUsage({
      repository,
      partnerId: "partner-without-limit",
      memberId: "member-1",
      benefitId: "benefit-1",
      benefit: "헬스 1개월 33,000원",
      useCount: 2,
      pin: "0427",
      idempotencyKey: "default-one-request",
    }),
    (error: unknown) =>
      error instanceof PartnerBenefitUsageError && error.code === "use_count_exceeded",
  );
});
