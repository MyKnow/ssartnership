import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PARTNER_BILLING_POLICY,
  calculatePartnerPlanUpgradeCharge,
  getOverdueDowngradeCandidate,
  normalizePartnerBillingProfileInput,
  splitVatIncludedKrw,
} from "../src/lib/partner-billing.ts";

describe("partner billing policy", () => {
  it("splits VAT-included Korean won amounts into supply and VAT", () => {
    assert.deepEqual(splitVatIncludedKrw(150_000), {
      supplyAmountKrw: 136_364,
      vatAmountKrw: 13_636,
      totalAmountKrw: 150_000,
    });
    assert.deepEqual(splitVatIncludedKrw(50_000), {
      supplyAmountKrw: 45_455,
      vatAmountKrw: 4_545,
      totalAmountKrw: 50_000,
    });
    assert.throws(() => splitVatIncludedKrw(-1), /0원 이상의 정수/);
  });

  it("normalizes tax invoice billing profile input", () => {
    assert.deepEqual(
      normalizePartnerBillingProfileInput({
        businessRegistrationNumber: "220-81-62517",
        businessName: "싸피상점",
        representativeName: "김싸피",
        businessAddress: "서울 강남구 테헤란로 212",
        businessType: "서비스업",
        businessItem: "광고대행",
        taxInvoiceEmail: "tax@example.com",
      }),
      {
        businessRegistrationNumber: "2208162517",
        businessName: "싸피상점",
        representativeName: "김싸피",
        businessAddress: "서울 강남구 테헤란로 212",
        businessType: "서비스업",
        businessItem: "광고대행",
        taxInvoiceEmail: "tax@example.com",
      },
    );

    assert.throws(
      () =>
        normalizePartnerBillingProfileInput({
          businessRegistrationNumber: "123-45-67890",
          businessName: "싸피상점",
          representativeName: "김싸피",
          businessAddress: "서울 강남구",
          businessType: "서비스업",
          businessItem: "광고대행",
          taxInvoiceEmail: "tax@example.com",
        }),
      /사업자등록번호/,
    );
  });

  it("calculates remaining-period upgrade difference with VAT-included prices", () => {
    const charge = calculatePartnerPlanUpgradeCharge({
      currentPlanTier: "partner",
      requestedPlanTier: "boost",
      effectiveAt: "2026-07-16T00:00:00+09:00",
      currentPeriodStart: "2026-07-01T00:00:00+09:00",
      currentPeriodEnd: "2026-07-31T23:59:59+09:00",
    });

    assert.equal(charge.policy, "remaining_period_difference");
    assert.equal(charge.remainingDays, 16);
    assert.equal(charge.totalAmountKrw, 53_334);
    assert.equal(charge.supplyAmountKrw, 48_485);
    assert.equal(charge.vatAmountKrw, 4_849);
  });

  it("falls back to one full month for Basic upgrades without paid plan period", () => {
    const charge = calculatePartnerPlanUpgradeCharge({
      currentPlanTier: "basic",
      requestedPlanTier: "partner",
      effectiveAt: "2026-07-16T00:00:00+09:00",
      currentPeriodStart: null,
      currentPeriodEnd: null,
    });

    assert.equal(charge.policy, "first_month_full_amount");
    assert.equal(charge.remainingDays, 30);
    assert.equal(charge.totalAmountKrw, 50_000);
  });

  it("charges one full month for Basic upgrades even when Basic mirrors the partnership period", () => {
    const charge = calculatePartnerPlanUpgradeCharge({
      currentPlanTier: "basic",
      requestedPlanTier: "partner",
      effectiveAt: "2026-07-03T00:00:00+09:00",
      currentPeriodStart: "2026-07-01T00:00:00+09:00",
      currentPeriodEnd: "2026-11-01T00:00:00+09:00",
    });

    assert.equal(charge.policy, "first_month_full_amount");
    assert.equal(charge.remainingDays, 30);
    assert.equal(charge.totalAmountKrw, 50_000);
  });

  it("marks paid-plan invoices as downgrade candidates after the grace period", () => {
    assert.equal(PARTNER_BILLING_POLICY.unpaidDowngradeGraceDays, 7);

    assert.deepEqual(
      getOverdueDowngradeCandidate({
        invoiceId: "invoice-1",
        partnerId: "brand-1",
        requestedPlanTier: "boost",
        dueAt: "2026-07-01T00:00:00+09:00",
        status: "pending_payment",
        now: "2026-07-07T23:59:59+09:00",
      }),
      null,
    );

    assert.deepEqual(
      getOverdueDowngradeCandidate({
        invoiceId: "invoice-1",
        partnerId: "brand-1",
        requestedPlanTier: "boost",
        dueAt: "2026-07-01T00:00:00+09:00",
        status: "pending_payment",
        now: "2026-07-08T00:00:00+09:00",
      }),
      {
        invoiceId: "invoice-1",
        partnerId: "brand-1",
        downgradeTo: "basic",
        reason: "unpaid_after_grace_period",
      },
    );
  });
});
