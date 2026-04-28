import test from "node:test";
import assert from "node:assert/strict";

import { toPartnerCountMap } from "@/lib/partner-counts";

test("toPartnerCountMap normalizes string counts and preserves missing ids as zero", () => {
  const counts = toPartnerCountMap(
    ["partner-a", "partner-b", "partner-c"],
    [
      { partner_id: "partner-a", count: "3" },
      { partner_id: "partner-b", count: 2 },
      { partner_id: "unknown", count: 99 },
    ],
  );

  assert.equal(counts.get("partner-a"), 3);
  assert.equal(counts.get("partner-b"), 2);
  assert.equal(counts.get("partner-c"), 0);
});

test("toPartnerCountMap deduplicates and trims requested ids", () => {
  const counts = toPartnerCountMap(
    [" partner-a ", "partner-a", "", "partner-b"],
    [{ partner_id: "partner-a", count: "5" }],
  );

  assert.deepEqual(Array.from(counts.entries()), [
    ["partner-a", 5],
    ["partner-b", 0],
  ]);
});
