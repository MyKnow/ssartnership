import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260720125337_fix_issue_ad_coupon_column_ambiguity.sql",
    import.meta.url,
  ),
  "utf8",
);
const uuidGenerationMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260720210600_fix_issue_ad_coupon_uuid_generation.sql",
    import.meta.url,
  ),
  "utf8",
);
const limitMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260720012227_add_member_coupon_limits_and_onsite_password.sql",
    import.meta.url,
  ),
  "utf8",
);
const memberTotalLimitMigrationName = readdirSync(
  new URL("../supabase/migrations/", import.meta.url),
).find((name) => name.includes("enforce_coupon_member_total_limit"));
const memberTotalLimitMigration = memberTotalLimitMigrationName
  ? readFileSync(
      new URL(`../supabase/migrations/${memberTotalLimitMigrationName}`, import.meta.url),
      "utf8",
    )
  : "";

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

  it("keeps omitted global and member periodic limits unlimited", () => {
    assert.match(limitMigration, /coupon_row\.daily_issue_limit is not null/);
    assert.match(limitMigration, /coupon_row\.weekly_issue_limit is not null/);
    assert.match(limitMigration, /coupon_row\.monthly_issue_limit is not null/);
    assert.match(limitMigration, /coupon_row\.per_member_daily_issue_limit is not null/);
    assert.match(limitMigration, /coupon_row\.per_member_weekly_issue_limit is not null/);
    assert.match(limitMigration, /coupon_row\.per_member_monthly_issue_limit is not null/);
  });

  it("uses an available UUID generator when issuing generated coupon codes", () => {
    assert.match(uuidGenerationMigration, /gen_random_uuid\(\)/);
    assert.doesNotMatch(uuidGenerationMigration, /replace\(uuid_generate_v4\(\)/);
  });

  it("enforces the total member limit in both wallet RPC transitions", () => {
    assert.notEqual(memberTotalLimitMigrationName, undefined);
    assert.match(memberTotalLimitMigration, /create or replace function public\.issue_ad_coupon/);
    assert.match(memberTotalLimitMigration, /create or replace function public\.redeem_ad_coupon_issue/);
    assert.match(memberTotalLimitMigration, /from public\.ad_coupon_redemptions/);
    assert.match(memberTotalLimitMigration, /redemptions\.member_id = p_member_id/);
    assert.match(memberTotalLimitMigration, /redemptions\.status = 'redeemed'/);
    assert.match(memberTotalLimitMigration, /coupon_row\.per_member_limit/);
    assert.equal(
      (memberTotalLimitMigration.match(/member_redeemed_count >= coupon_row\.per_member_limit/g) ?? []).length,
      2,
    );
    assert.equal(
      (memberTotalLimitMigration.match(/total_redeemed_count >= coupon_row\.usage_limit/g) ?? []).length,
      2,
    );
    assert.equal(
      (memberTotalLimitMigration.match(/raise exception 'ad_coupon_usage_limit'/g) ?? []).length,
      2,
    );
  });
});
