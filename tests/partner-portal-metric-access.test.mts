import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getPartnerPortalMetricAccessItems } from "../src/lib/partner-portal-metric-access.ts";

describe("partner portal metric access", () => {
  it("describes allowed and locked metrics for each plan tier", () => {
    const basicItems = getPartnerPortalMetricAccessItems("basic");
    const boostItems = getPartnerPortalMetricAccessItems("boost");

    assert.equal(
      basicItems.find((item) => item.key === "detailViews")?.locked,
      false,
    );
    assert.equal(
      basicItems.find((item) => item.key === "reservationClicks")?.locked,
      true,
    );
    assert.equal(
      boostItems.find((item) => item.key === "reservationClicks")?.locked,
      false,
    );
  });
});
