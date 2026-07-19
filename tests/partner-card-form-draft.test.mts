import assert from "node:assert/strict";
import test from "node:test";

const modulePromise = import("../src/lib/partner-card-form/draft.ts");

test("제휴처 Draft는 반복 입력값과 모드를 정규화해 직렬화한다", async () => {
  const {
    createPartnerCardDraftSnapshot,
    readPartnerCardDraftSnapshot,
    serializePartnerCardDraftSnapshot,
  } = await modulePromise;

  const snapshot = createPartnerCardDraftSnapshot({
    branchEntryMode: "multi",
    benefitListingMode: "coupon_only",
    branchListText: " G01\t역삼본점\t서울 강남구 ",
    conditions: [" 평일만 ", "평일만", ""],
    benefits: [" 10% 할인 "],
    tags: ["카페", " 카페 "],
    appliesTo: ["operator", "graduate"],
    campusSlugs: ["gangnam", "gangnam"],
  });

  assert.deepEqual(snapshot, {
    version: 1,
    branchEntryMode: "multi",
    benefitListingMode: "coupon_only",
    branchListText: "G01\t역삼본점\t서울 강남구",
    conditions: ["평일만"],
    benefits: ["10% 할인"],
    tags: ["카페"],
    appliesTo: ["operator", "graduate"],
    campusSlugs: ["gangnam"],
  });

  assert.deepEqual(
    readPartnerCardDraftSnapshot(serializePartnerCardDraftSnapshot(snapshot)),
    snapshot,
  );
});

test("제휴처 Draft는 손상되거나 허용되지 않은 값을 복구하지 않는다", async () => {
  const { readPartnerCardDraftSnapshot } = await modulePromise;

  assert.equal(readPartnerCardDraftSnapshot("not-json"), null);
  assert.equal(readPartnerCardDraftSnapshot(JSON.stringify({ version: 2 })), null);
  assert.equal(
    readPartnerCardDraftSnapshot(JSON.stringify({
      version: 1,
      branchEntryMode: "invalid",
      benefitListingMode: "always_on",
      branchListText: "",
      conditions: [],
      benefits: [],
      tags: [],
      appliesTo: [],
      campusSlugs: [],
    })),
    null,
  );
});
