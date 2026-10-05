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

describe("ad coupon deletion and campaign status writes", () => {
  const repositorySource = readFileSync(
    new URL("../src/lib/repositories/supabase/ad-package-repository.supabase.ts", import.meta.url),
    "utf8",
  );
  const issueRpc = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

  it("relies on the issue RPC locking and re-checking only active coupons", () => {
    const rpcBody = issueRpc.slice(
      issueRpc.indexOf("create or replace function public.issue_ad_coupon("),
      issueRpc.indexOf("create or replace function public.redeem_ad_coupon_issue("),
    );
    assert.match(rpcBody, /where coupons\.id = p_coupon_id\s+for update;/);
    assert.match(rpcBody, /if coupon_row\.status <> 'active'/);
  });

  it("bumps ad_coupons.updated_at on every update, which the delete compare-and-set relies on", () => {
    const triggerFunction = issueRpc.slice(
      issueRpc.indexOf("create or replace function set_ad_coupons_updated_at()"),
      issueRpc.indexOf("drop trigger if exists ad_coupons_set_updated_at on ad_coupons;"),
    );
    assert.match(triggerFunction, /new\.updated_at = now\(\);/);
    assert.match(
      issueRpc,
      /create trigger ad_coupons_set_updated_at\s+before update on ad_coupons\s+for each row\s+execute function set_ad_coupons_updated_at\(\);/,
    );
  });

  it("deletes only an unchanged non-active coupon without history", () => {
    const deleteSource = repositorySource.slice(
      repositorySource.indexOf("async deleteCoupon("),
      repositorySource.indexOf("async issueCoupon("),
    );
    const versionRead = deleteSource.indexOf('.select("status,updated_at")');
    const historyCount = deleteSource.indexOf('.from("ad_coupon_issues")');
    assert.ok(versionRead >= 0 && historyCount > versionRead);
    assert.match(deleteSource, /canDeleteAdCouponWithStatus\(status\)/);
    assert.match(
      deleteSource,
      /\.delete\(\)\s*\.eq\("id", couponId\)\s*\.neq\("status", "active"\)\s*\.eq\("updated_at", couponRow\.updated_at\)\s*\.select\("id"\)/,
    );
    assert.match(deleteSource, /reason: "state_changed"/);
  });

  it("re-checks the coupon status transition and updates with a compare-and-set", () => {
    const updateSource = repositorySource.slice(
      repositorySource.indexOf("async updateCoupon("),
      repositorySource.indexOf("async duplicateCoupon("),
    );
    assert.match(updateSource, /canTransitionAdCouponStatus\(currentStatus, nextStatus\)/);
    assert.match(updateSource, /throw new AdStatusTransitionError\("coupon", currentStatus, nextStatus\)/);
    assert.match(updateSource, /status: nextStatus,/);
    assert.match(
      updateSource,
      /\.eq\("partner_id", input\.partnerId\)\s*(\/\/[^\n]*\s*)?\.eq\("status", currentStatus\)\s*\.select\(AD_COUPON_SELECT\)\s*\.maybeSingle\(\)/,
    );
    assert.match(updateSource, /throw new Error\(AD_COUPON_STATE_CHANGED_ERROR\)/);
  });

  it("updates campaign status with a validated compare-and-set", () => {
    const updateSource = repositorySource.slice(
      repositorySource.indexOf("async updateCampaignStatus("),
      repositorySource.indexOf("async createCoupon("),
    );
    assert.match(updateSource, /canTransitionAdCampaignStatus\(from, input\.status\)/);
    assert.match(
      updateSource,
      /\.update\(\{ status: input\.status \}\)\s*\.eq\("id", input\.campaignId\)\s*\.eq\("status", from\)/,
    );
    assert.match(updateSource, /reason: "state_changed"/);
  });
});
