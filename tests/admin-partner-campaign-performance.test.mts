import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

function methodSource(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.ok(startIndex >= 0 && endIndex > startIndex);
  return source.slice(startIndex, endIndex);
}

test("전체와 제휴처 광고 조회는 bounded DB rollup을 공유한다", async () => {
  const [repositoryContract, supabaseRepository, readModel, deferredSections] =
    await Promise.all([
      read("src/lib/repositories/ad-package-repository.ts"),
      read("src/lib/repositories/supabase/ad-package-repository.supabase.ts"),
      read("src/lib/admin-partner-detail.server.ts"),
      read("src/components/admin/AdminPartnerDetailDeferredSections.tsx"),
    ]);

  assert.match(repositoryContract, /listAdminCampaigns\(\): Promise<AdCampaignWithStats\[\]>/);
  assert.doesNotMatch(repositoryContract, /listAdminCampaigns\(options/);
  assert.match(
    repositoryContract,
    /prepareAdminCampaigns\(\): Promise<PreparedAdminCampaigns>/,
  );
  assert.match(
    repositoryContract,
    /listAdminCampaignsForPartner\(partnerId: string\): Promise<AdCampaignWithStats\[\]>/,
  );

  const globalMethod = methodSource(
    supabaseRepository,
    "async prepareAdminCampaigns()",
    "async listAdminCampaigns()",
  );
  const globalFacade = methodSource(
    supabaseRepository,
    "async listAdminCampaigns()",
    "async listAdminCampaignsForPartner(",
  );
  const scopedMethod = methodSource(
    supabaseRepository,
    "async listAdminCampaignsForPartner(",
    "async listAdminCouponsForPartner(",
  );

  assert.match(
    globalMethod,
    /\.rpc\("get_admin_ad_campaign_rollups", \{[\s\S]*?input_partner_id: null/,
  );
  assert.match(globalMethod, /options: campaignRows\.map\(mapCampaignRow\)\.map\(toAdCampaignOption\)/);
  assert.match(globalFacade, /this\.prepareAdminCampaigns\(\)/);
  assert.match(globalFacade, /return prepared\.campaigns/);
  assert.match(
    scopedMethod,
    /\.from\("ad_campaigns"\)[\s\S]*?\.eq\("partner_id", partnerId\)/,
  );
  assert.match(
    scopedMethod,
    /\.from\("ad_coupons"\)[\s\S]*?\.eq\("partner_id", partnerId\)/,
  );
  assert.match(
    scopedMethod,
    /\.rpc\("get_admin_ad_campaign_rollups", \{[\s\S]*?input_partner_id: partnerId/,
  );

  for (const source of [globalMethod, scopedMethod]) {
    assert.doesNotMatch(source, /\.from\("event_logs"\)/);
    assert.doesNotMatch(source, /\.from\("ad_coupon_redemptions"\)/);
    assert.doesNotMatch(source, /\.limit\(5000\)/);
    assert.equal(source.match(/get_admin_ad_campaign_rollups/g)?.length, 1);
  }

  assert.match(supabaseRepository, /coupon_redemption_counts: unknown/);
  assert.match(supabaseRepository, /mapCouponRedemptionCounts/);
  assert.match(readModel, /listAdminCampaignsForPartner\(partnerId\)/);
  assert.doesNotMatch(readModel, /listAdminCampaigns\(\)/);
  assert.doesNotMatch(deferredSections, /detail\.adCampaigns\.filter\(/);
});

test("광고 rollup SQL은 전체와 제휴처 범위, 쿠폰별 사용 횟수, 전용 ACL을 고정한다", async () => {
  const [migration, schema] = await Promise.all([
    read(
      "supabase/migrations/20260831145630_aggregate_admin_ad_campaign_rollups.sql",
    ),
    read("supabase/schema.sql"),
  ]);

  assert.match(
    migration,
    /drop function if exists public\.get_admin_partner_ad_campaign_metrics\(uuid\);/i,
  );
  assert.doesNotMatch(schema, /public\.get_admin_partner_ad_campaign_metrics/i);

  for (const sql of [migration, schema]) {
    assert.match(
      sql,
      /create or replace function public\.get_admin_ad_campaign_rollups\(\s*input_partner_id uuid default null\s*\)/i,
    );
    assert.match(
      sql,
      /returns table \([\s\S]*?campaign_id uuid[\s\S]*?coupon_redemption_counts jsonb/i,
    );
    assert.match(
      sql,
      /where input_partner_id is null\s+or campaign\.partner_id = input_partner_id/i,
    );
    assert.match(sql, /(?:from|join) public\.event_logs/i);
    assert.match(sql, /properties ->> 'campaignId'/i);
    assert.match(sql, /from public\.ad_coupon_redemptions/i);
    assert.match(
      sql,
      /group by redemption\.campaign_id, redemption\.coupon_id/i,
    );
    assert.match(sql, /jsonb_object_agg\(/i);
    assert.match(sql, /security invoker/i);
    assert.match(sql, /set search_path = pg_catalog, public/i);
    assert.match(
      sql,
      /create index if not exists ad_coupon_redemptions_campaign_coupon_redeemed_idx[\s\S]*where status = 'redeemed'/i,
    );
    for (const role of ["public", "anon", "authenticated"]) {
      assert.match(
        sql,
        new RegExp(
          `revoke all on function public\\.get_admin_ad_campaign_rollups\\(uuid\\) from ${role};`,
          "i",
        ),
      );
    }
    assert.match(
      sql,
      /grant execute on function public\.get_admin_ad_campaign_rollups\(uuid\) to service_role;/i,
    );
  }
});
