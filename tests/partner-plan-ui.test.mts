import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getPartnerPlanChannelLabel,
  getPartnerPlanProgressLabel,
  getPartnerPlanUpgradeOptions,
} from "../src/lib/partner-plan-ui.ts";

describe("partner plan UI helpers", () => {
  it("returns only higher upgrade options in plan order", () => {
    assert.deepEqual(
      getPartnerPlanUpgradeOptions("basic").map((definition) => definition.tier),
      ["partner", "boost"],
    );
    assert.deepEqual(
      getPartnerPlanUpgradeOptions("partner").map((definition) => definition.tier),
      ["boost"],
    );
    assert.deepEqual(getPartnerPlanUpgradeOptions("boost"), []);
  });

  it("describes plan progress and ad channel labels for partner-facing UI", () => {
    assert.equal(getPartnerPlanProgressLabel("basic"), "1/3 단계");
    assert.equal(getPartnerPlanProgressLabel("boost"), "3/3 단계");
    assert.equal(getPartnerPlanChannelLabel("home_banner"), "홈 배너");
    assert.equal(getPartnerPlanChannelLabel("ad_banner"), "일반 애드배너");
  });
});
