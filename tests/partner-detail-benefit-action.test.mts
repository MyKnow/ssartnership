import assert from "node:assert/strict";
import test from "node:test";

import { getPartnerDetailBenefitMode } from "../src/lib/partner-detail-benefit-action.ts";

test("external links expose the partner detail benefit action", () => {
  assert.equal(
    getPartnerDetailBenefitMode({
      isActive: true,
      actionType: "external_link",
      benefitAccessStatus: null,
      benefits: [],
    }),
    "external_link",
  );
});

test("certification actions expose the PIN flow when a benefit is available", () => {
  assert.equal(
    getPartnerDetailBenefitMode({
      isActive: true,
      actionType: "certification",
      benefitAccessStatus: "login_required",
      benefits: ["월 이용권 할인"],
    }),
    "certification",
  );
});

test("onsite, ineligible, inactive, and empty certification actions stay hidden", () => {
  const base = {
    isActive: true,
    benefitAccessStatus: null as "login_required" | "not_eligible" | null,
    benefits: ["월 이용권 할인"],
  };

  assert.equal(
    getPartnerDetailBenefitMode({ ...base, actionType: "onsite" }),
    null,
  );
  assert.equal(
    getPartnerDetailBenefitMode({
      ...base,
      actionType: "certification",
      benefitAccessStatus: "not_eligible",
    }),
    null,
  );
  assert.equal(
    getPartnerDetailBenefitMode({ ...base, actionType: "none", isActive: false }),
    null,
  );
  assert.equal(
    getPartnerDetailBenefitMode({
      ...base,
      actionType: "certification",
      benefits: [],
    }),
    null,
  );
});
