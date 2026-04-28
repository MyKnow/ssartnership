import test from "node:test";
import assert from "node:assert/strict";

import { toReviewVisibilityCounts } from "@/lib/partner-counts";

test("toReviewVisibilityCounts normalizes nullable rpc values", () => {
  const counts = toReviewVisibilityCounts({
    total_count: "5",
    visible_count: 3,
    hidden_count: null,
  });

  assert.deepEqual(counts, {
    totalCount: 5,
    visibleCount: 3,
    hiddenCount: 0,
  });
});

test("toReviewVisibilityCounts falls back to zeros when row is missing", () => {
  assert.deepEqual(toReviewVisibilityCounts(), {
    totalCount: 0,
    visibleCount: 0,
    hiddenCount: 0,
  });
});
