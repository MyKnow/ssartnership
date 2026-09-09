import assert from "node:assert/strict";
import test from "node:test";

import {
  getPartnerDetailBenefitMode,
  resolvePartnerDetailBenefitUseAction,
} from "../src/lib/partner-detail-benefit-action.ts";

const externalBenefitAction = {
  label: "혜택 이용",
  href: "tel:050713822343",
  type: "external_link" as const,
};

test("logged-out benefit actions lead to login without exposing the original action", () => {
  assert.deepEqual(
    resolvePartnerDetailBenefitUseAction({
      action: externalBenefitAction,
      authenticated: false,
      returnTo: "/partners/partner-1",
    }),
    {
      label: "로그인 후 혜택 이용하기",
      href: "/auth/login?returnTo=%2Fpartners%2Fpartner-1",
      type: "external_link",
      requiresLogin: true,
    },
  );
});

test("logged-in benefit actions keep their original destination", () => {
  assert.equal(
    resolvePartnerDetailBenefitUseAction({
      action: externalBenefitAction,
      authenticated: true,
      returnTo: "/partners/partner-1",
    }),
    externalBenefitAction,
  );
});

test("logged-out benefit actions sanitize unsafe return destinations", () => {
  assert.equal(
    resolvePartnerDetailBenefitUseAction({
      action: externalBenefitAction,
      authenticated: false,
      returnTo: "https://attacker.example/next",
    })?.href,
    "/auth/login?returnTo=%2F",
  );
});

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
