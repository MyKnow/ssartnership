import assert from "node:assert/strict";
import test from "node:test";
import type { PartnerBenefit } from "../src/lib/partner-benefit-items.ts";

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

  assert.deepEqual(
    items.map((item: { title: string }) => item.title),
    ["헬스 1개월권", "커피 할인"],
  );
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

test("legacy benefit ids are built and parsed through one helper pair", async () => {
  const {
    buildLegacyPartnerBenefitItems,
    getLegacyPartnerBenefitId,
    isLegacyPartnerBenefitId,
    parseLegacyPartnerBenefitPosition,
    resolvePartnerBenefitById,
  } = await modulePromise;

  assert.equal(getLegacyPartnerBenefitId(0, "partner-1"), "legacy-benefit-partner-1-1");
  assert.equal(getLegacyPartnerBenefitId(2), "legacy-benefit-3");
  assert.equal(isLegacyPartnerBenefitId("legacy-benefit-3"), true);
  assert.equal(isLegacyPartnerBenefitId("8c5b0c4e-benefit"), false);

  const items = buildLegacyPartnerBenefitItems(["10% 할인", "음료 제공"], "partner-1");
  assert.deepEqual(
    items.map((item: PartnerBenefit) => [
      item.id,
      item.title,
      item.maxApplyCount,
      item.displayOrder,
    ]),
    [
      ["legacy-benefit-partner-1-1", "10% 할인", null, 0],
      ["legacy-benefit-partner-1-2", "음료 제공", null, 1],
    ],
  );
  assert.deepEqual(
    buildLegacyPartnerBenefitItems(["무료 음료"]).map((item: PartnerBenefit) => item.id),
    ["legacy-benefit-1"],
  );

  assert.equal(parseLegacyPartnerBenefitPosition(" legacy-benefit-partner-1-2 ", "partner-1"), 2);
  assert.equal(parseLegacyPartnerBenefitPosition("legacy-benefit-partner-1-0", "partner-1"), null);
  assert.equal(parseLegacyPartnerBenefitPosition("legacy-benefit-partner-2-1", "partner-1"), null);
  assert.equal(parseLegacyPartnerBenefitPosition("legacy-benefit-partner-1-x", "partner-1"), null);

  const canonical = [
    { id: "b-1", title: "10% 할인", maxApplyCount: 1, displayOrder: 0 },
    { id: "b-2", title: "음료 제공", maxApplyCount: null, displayOrder: 1 },
  ];
  assert.equal(
    resolvePartnerBenefitById(canonical, "legacy-benefit-partner-1-2", "partner-1")?.id,
    "b-2",
  );
});

test("the legacy-benefit id literal lives only in the partner benefit helper", async () => {
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join, relative } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const srcRoot = fileURLToPath(new URL("../src", import.meta.url));
  const offenders: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) {
        visit(path);
        continue;
      }
      if (!/\.(?:ts|tsx)$/.test(entry) || entry.includes(".stories.")) {
        continue;
      }
      if (readFileSync(path, "utf8").includes("legacy-benefit-")) {
        offenders.push(relative(srcRoot, path));
      }
    }
  };
  visit(srcRoot);

  assert.deepEqual(offenders, ["lib/partner-benefit-items.ts"]);
});
