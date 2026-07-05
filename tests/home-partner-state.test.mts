import assert from "node:assert/strict";
import test from "node:test";

const homePartnerStateModulePromise = import(
  new URL("../src/lib/home-partner-state.ts", import.meta.url).href,
);

test("normalizeHomePartnerStateIds deduplicates and caps visible partner ids", async () => {
  const { HOME_PARTNER_STATE_BATCH_LIMIT, normalizeHomePartnerStateIds } =
    await homePartnerStateModulePromise;
  const values = [
    " partner-1 ",
    "partner-1",
    "",
    "x".repeat(121),
    ...Array.from({ length: HOME_PARTNER_STATE_BATCH_LIMIT + 5 }, (_, index) =>
      `partner-${index + 2}`,
    ),
  ];

  const ids = normalizeHomePartnerStateIds(values);

  assert.equal(ids.length, HOME_PARTNER_STATE_BATCH_LIMIT);
  assert.equal(ids[0], "partner-1");
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.includes("x".repeat(121)), false);
});
