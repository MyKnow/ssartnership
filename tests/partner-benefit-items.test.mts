import assert from "node:assert/strict";
import test from "node:test";

const modulePromise = import(
  new URL("../src/lib/partner-benefit-items.ts", import.meta.url).href,
);

test("혜택 최대 적용 횟수는 미입력 시 1회로 유효화된다", async () => {
  const { getEffectivePartnerBenefitMaxApplyCount, normalizePartnerBenefitMaxApplyCount } =
    await modulePromise;

  assert.equal(normalizePartnerBenefitMaxApplyCount(""), null);
  assert.equal(normalizePartnerBenefitMaxApplyCount(null), null);
  assert.equal(getEffectivePartnerBenefitMaxApplyCount(null), 1);
});

test("혜택별 설정값은 항목별로 보존된다", async () => {
  const { normalizePartnerBenefitItems, getEffectivePartnerBenefitMaxApplyCount } =
    await modulePromise;

  const items = normalizePartnerBenefitItems([
    { id: "benefit-a", title: "헬스 1개월권", maxApplyCount: "3" },
    { title: "커피 할인", maxApplyCount: "" },
  ]);

  assert.deepEqual(items.map((item) => item.title), ["헬스 1개월권", "커피 할인"]);
  assert.equal(getEffectivePartnerBenefitMaxApplyCount(items[0]?.maxApplyCount), 3);
  assert.equal(getEffectivePartnerBenefitMaxApplyCount(items[1]?.maxApplyCount), 1);
});

test("빈 제목, 중복 혜택, 잘못된 상한은 거부된다", async () => {
  const { normalizePartnerBenefitItems } = await modulePromise;

  assert.throws(
    () => normalizePartnerBenefitItems([{ title: "", maxApplyCount: null }]),
    { message: "partner_benefit_invalid_title" },
  );
  assert.throws(
    () => normalizePartnerBenefitItems([{ title: "동일 혜택" }, { title: "동일 혜택" }]),
    { message: "partner_benefit_duplicate_title" },
  );
  assert.throws(
    () => normalizePartnerBenefitItems([{ title: "혜택", maxApplyCount: 0 }]),
    { message: "partner_benefit_invalid_max_apply_count" },
  );
});
