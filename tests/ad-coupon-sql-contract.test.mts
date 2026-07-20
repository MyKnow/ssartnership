import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260720125337_fix_issue_ad_coupon_column_ambiguity.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("issue_ad_coupon SQL contract", () => {
  it("qualifies issue and code columns that conflict with return variables", () => {
    assert.match(migration, /from public\.ad_coupon_issues as issues/);
    assert.match(migration, /issues\.coupon_id = coupon_row\.id/);
    assert.match(migration, /from public\.ad_coupon_codes as codes/);
    assert.match(migration, /codes\.coupon_id = coupon_row\.id/);
    assert.doesNotMatch(
      migration,
      /from public\.ad_coupon_issues\s+where coupon_id\s*=/,
    );
  });
});
