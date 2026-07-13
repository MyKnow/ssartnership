import assert from "node:assert/strict";
import test from "node:test";

type ContentBudgetModule = typeof import("../src/lib/content-budget.ts");

const modulePromise = import(
  new URL("../src/lib/content-budget.ts", import.meta.url).href
) as Promise<ContentBudgetModule>;

test("applyContentBudget returns visible content and a +N count without mutating input", async () => {
  const { applyContentBudget } = await modulePromise;
  const source = ["첫 번째", "두 번째", "세 번째", "네 번째"];

  const result = applyContentBudget(source, 2);

  assert.deepEqual(result, {
    visible: ["첫 번째", "두 번째"],
    hiddenCount: 2,
  });
  assert.deepEqual(source, ["첫 번째", "두 번째", "세 번째", "네 번째"]);
  assert.notEqual(result.visible, source);
});

test("applyContentBudget normalizes invalid limits to an empty visible list", async () => {
  const { applyContentBudget } = await modulePromise;

  assert.deepEqual(applyContentBudget(["하나"], -4), {
    visible: [],
    hiddenCount: 1,
  });
  assert.deepEqual(applyContentBudget(["하나"], Number.NaN), {
    visible: [],
    hiddenCount: 1,
  });
});
