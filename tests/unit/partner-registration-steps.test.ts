import { describe, expect, it } from "vitest";
import {
  getPartnerRegistrationStepErrors,
  getPartnerRegistrationStepIndex,
  getPartnerRegistrationStepSummary,
  PARTNER_REGISTRATION_STEPS,
  type PartnerRegistrationStepId,
} from "@/components/partner-registration/registration-steps";

describe("partner registration step contract", () => {
  it("keeps five task-focused steps and compact summaries", () => {
    expect(PARTNER_REGISTRATION_STEPS.map((step) => step.label)).toEqual([
      "제휴처",
      "지점",
      "혜택",
      "소개",
      "담당자",
    ]);
    expect(getPartnerRegistrationStepIndex("brand")).toBe(0);
    expect(getPartnerRegistrationStepSummary("contact")).toBe("5/5 담당자");
    expect(
      getPartnerRegistrationStepSummary("missing" as PartnerRegistrationStepId),
    ).toBe("");
  });

  it("returns only errors owned by the current step", () => {
    const errors = {
      brandName: "제휴처명을 입력해 주세요.",
      contactEmail: "이메일 형식을 확인해 주세요.",
    };

    expect(getPartnerRegistrationStepErrors("brand", errors)).toEqual({
      brandName: "제휴처명을 입력해 주세요.",
    });
    expect(getPartnerRegistrationStepErrors("contact", errors)).toEqual({
      contactEmail: "이메일 형식을 확인해 주세요.",
    });
    expect(
      getPartnerRegistrationStepErrors(
        "missing" as PartnerRegistrationStepId,
        errors,
      ),
    ).toEqual({});
  });
});
