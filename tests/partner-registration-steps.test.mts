import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getPartnerRegistrationStepErrors,
  getPartnerRegistrationStepSummary,
  PARTNER_REGISTRATION_STEPS,
} from "../src/components/partner-registration/registration-steps.ts";

describe("partner registration step contract", () => {
  it("keeps the five-step task order and compact mobile summary", () => {
    assert.deepEqual(
      PARTNER_REGISTRATION_STEPS.map((step) => step.label),
      ["제휴처", "지점", "혜택", "소개", "담당자"],
    );
    assert.equal(getPartnerRegistrationStepSummary("brand"), "1/5 제휴처");
    assert.equal(getPartnerRegistrationStepSummary("contact"), "5/5 담당자");
  });

  it("maps field errors to the step that owns the field", () => {
    const errors = {
      brandName: "제휴처명을 입력해 주세요.",
      contactEmail: "이메일 형식을 확인해 주세요.",
    } as const;

    assert.deepEqual(getPartnerRegistrationStepErrors("brand", errors), {
      brandName: "제휴처명을 입력해 주세요.",
    });
    assert.deepEqual(getPartnerRegistrationStepErrors("contact", errors), {
      contactEmail: "이메일 형식을 확인해 주세요.",
    });
    assert.deepEqual(getPartnerRegistrationStepErrors("benefit", errors), {});
  });
});
