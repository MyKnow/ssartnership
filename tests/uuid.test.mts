import test from "node:test";
import assert from "node:assert/strict";

import { isUuid, normalizeUuidList } from "@/lib/uuid";

test("isUuid accepts canonical UUID values", () => {
  assert.equal(isUuid("d46d0f71-fb92-4a73-b0b6-40c44e5e18d6"), true);
  assert.equal(isUuid(" D46D0F71-FB92-4A73-B0B6-40C44E5E18D6 "), true);
});

test("isUuid rejects public mock slugs before Supabase queries", () => {
  assert.equal(isUuid("health-001"), false);
  assert.equal(isUuid("mock-partner-service-cafe-ssafy-yeoksam"), false);
  assert.equal(isUuid(""), false);
});

test("normalizeUuidList trims, dedupes, and drops non-UUID values", () => {
  assert.deepEqual(
    normalizeUuidList([
      " health-001 ",
      "d46d0f71-fb92-4a73-b0b6-40c44e5e18d6",
      "D46D0F71-FB92-4A73-B0B6-40C44E5E18D6",
      "00000000-0000-4000-8000-000000000000",
    ]),
    [
      "d46d0f71-fb92-4a73-b0b6-40c44e5e18d6",
      "00000000-0000-4000-8000-000000000000",
    ],
  );
});
