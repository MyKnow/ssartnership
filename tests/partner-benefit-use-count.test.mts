import assert from "node:assert/strict";
import test from "node:test";

import {
  PARTNER_BENEFIT_USE_COUNT_STORAGE_MAX,
  normalizePartnerBenefitUseMaxCount,
  normalizePartnerBenefitUseCount,
} from "../src/lib/partner-benefit-usage.ts";

test("혜택 이용 최대 횟수는 비어 있으면 무제한이고 양의 정수만 허용한다", () => {
  assert.equal(normalizePartnerBenefitUseMaxCount(undefined), null);
  assert.equal(normalizePartnerBenefitUseMaxCount(""), null);
  assert.equal(normalizePartnerBenefitUseMaxCount("2"), 2);
  assert.equal(
    normalizePartnerBenefitUseMaxCount(PARTNER_BENEFIT_USE_COUNT_STORAGE_MAX),
    PARTNER_BENEFIT_USE_COUNT_STORAGE_MAX,
  );
  assert.equal(normalizePartnerBenefitUseMaxCount("0"), null);
  assert.equal(normalizePartnerBenefitUseMaxCount("1.5"), null);
  assert.equal(
    normalizePartnerBenefitUseMaxCount(PARTNER_BENEFIT_USE_COUNT_STORAGE_MAX + 1),
    null,
  );
});

test("혜택 이용 횟수는 설정된 최대 횟수 안에서만 허용한다", () => {
  assert.equal(normalizePartnerBenefitUseCount(undefined), 1);
  assert.equal(normalizePartnerBenefitUseCount("1"), 1);
  assert.equal(normalizePartnerBenefitUseCount(2, 2), 2);
  assert.equal(normalizePartnerBenefitUseCount(3, 2), null);
  assert.equal(normalizePartnerBenefitUseCount(3), 3);
  assert.equal(normalizePartnerBenefitUseCount("0"), null);
  assert.equal(normalizePartnerBenefitUseCount("1.5"), null);
  assert.equal(normalizePartnerBenefitUseCount("one"), null);
});
