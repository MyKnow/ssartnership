import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getBenefitUseAction,
  normalizeBenefitUseInquiry,
} from "../src/lib/partner-links.ts";
import { resolvePartnerBenefitActionType } from "../src/lib/partner-benefit-action.ts";

describe("partner benefit action", () => {
  it("treats legacy reservation links as external benefit-use links", () => {
    const normalized = normalizeBenefitUseInquiry({
      reservationLink: "https://booking.example.com/demo",
      inquiryLink: "",
    });

    assert.equal(normalized.benefitActionType, "external_link");
    assert.equal(normalized.benefitActionLink, "https://booking.example.com/demo");
    assert.equal(normalized.reservationLink, "https://booking.example.com/demo");
  });

  it("builds certification action without an external link", () => {
    const action = getBenefitUseAction({
      actionType: "certification",
      actionLink: "",
      legacyReservationLink: "https://booking.example.com/demo",
    });

    assert.deepEqual(action, {
      label: "인증하고 혜택 이용",
      href: "/certification",
      type: "certification",
    });
  });

  it("does not expose CTA for onsite or none actions", () => {
    assert.equal(
      getBenefitUseAction({ actionType: "onsite", actionLink: "" }),
      null,
    );
    assert.equal(
      getBenefitUseAction({ actionType: "none", actionLink: "" }),
      null,
    );
  });

  it("falls back to external_link only for legacy values without explicit type", () => {
    assert.equal(
      resolvePartnerBenefitActionType({
        reservationLink: "https://booking.example.com/demo",
      }),
      "external_link",
    );
    assert.equal(
      resolvePartnerBenefitActionType({
        benefitActionType: "none",
        reservationLink: "https://booking.example.com/demo",
      }),
      "none",
    );
  });
});
