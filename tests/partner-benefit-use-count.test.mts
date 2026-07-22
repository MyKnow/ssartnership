import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_PARTNER_BENEFIT_USE_COUNT,
  normalizePartnerBenefitUseCount,
} from "../src/lib/partner-benefit-usage.ts";

test("혜택 이용 횟수는 1~2의 정수만 허용한다", () => {
  assert.equal(normalizePartnerBenefitUseCount(undefined), 1);
  assert.equal(normalizePartnerBenefitUseCount("1"), 1);
  assert.equal(normalizePartnerBenefitUseCount(2), MAX_PARTNER_BENEFIT_USE_COUNT);
  assert.equal(normalizePartnerBenefitUseCount("0"), null);
  assert.equal(normalizePartnerBenefitUseCount("3"), null);
  assert.equal(normalizePartnerBenefitUseCount("1.5"), null);
  assert.equal(normalizePartnerBenefitUseCount("one"), null);
});
