import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("제휴처 상세 광고 조회는 파트너 범위와 DB 집계 계약을 사용한다", async () => {
  const [
    repositoryContract,
    supabaseRepository,
    readModel,
    deferredSections,
    migration,
    schema,
  ] = await Promise.all([
    read("src/lib/repositories/ad-package-repository.ts"),
    read("src/lib/repositories/supabase/ad-package-repository.supabase.ts"),
    read("src/lib/admin-partner-detail.server.ts"),
    read("src/components/admin/AdminPartnerDetailDeferredSections.tsx"),
    read(
      "supabase/migrations/20260831144254_add_admin_partner_ad_campaign_metrics.sql",
    ),
    read("supabase/schema.sql"),
  ]);

  assert.match(
    repositoryContract,
    /listAdminCampaignsForPartner\(\s*partnerId: string,?/,
  );

  const scopedMethodStart = supabaseRepository.indexOf(
    "async listAdminCampaignsForPartner(",
  );
  const scopedMethodEnd = supabaseRepository.indexOf(
    "async listAdminCouponsForPartner(",
    scopedMethodStart,
  );
  assert.ok(scopedMethodStart >= 0 && scopedMethodEnd > scopedMethodStart);
  const scopedMethod = supabaseRepository.slice(
    scopedMethodStart,
    scopedMethodEnd,
  );

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
    /\.from\("ad_coupon_redemptions"\)[\s\S]*?\.eq\("partner_id", partnerId\)/,
  );
  assert.doesNotMatch(scopedMethod, /\.limit\(5000\)/);
  assert.match(
    scopedMethod,
    /\.rpc\("get_admin_partner_ad_campaign_metrics", \{[\s\S]*?input_partner_id: partnerId/,
  );
  assert.equal(
    scopedMethod.match(/get_admin_partner_ad_campaign_metrics/g)?.length,
    1,
  );
  assert.doesNotMatch(scopedMethod, /\.from\("event_logs"\)/);
  assert.doesNotMatch(supabaseRepository, /async function countAdMetricEvents/);

  assert.match(readModel, /listAdminCampaignsForPartner\(partnerId\)/);
  assert.doesNotMatch(readModel, /listAdminCampaigns\(\)/);
  assert.doesNotMatch(
    deferredSections,
    /detail\.adCampaigns\.filter\(/,
  );

  for (const sql of [migration, schema]) {
    assert.match(
      sql,
      /create or replace function public\.get_admin_partner_ad_campaign_metrics\(\s*input_partner_id uuid\s*\)/i,
    );
    assert.match(
      sql,
      /returns table \([\s\S]*?campaign_id uuid[\s\S]*?ad_push_sends bigint/i,
    );
    assert.match(
      sql,
      /from public\.ad_campaigns[\s\S]*?partner_id = input_partner_id/i,
    );
    assert.match(sql, /(?:from|join) public\.event_logs/i);
    assert.match(sql, /properties ->> 'campaignId'/i);
    assert.match(sql, /from public\.ad_coupon_redemptions/i);
    assert.match(sql, /security invoker/i);
    assert.match(sql, /set search_path = pg_catalog, public/i);
    assert.match(
      sql,
      /revoke all on function public\.get_admin_partner_ad_campaign_metrics\(uuid\) from public;/i,
    );
    assert.match(
      sql,
      /revoke all on function public\.get_admin_partner_ad_campaign_metrics\(uuid\) from anon;/i,
    );
    assert.match(
      sql,
      /revoke all on function public\.get_admin_partner_ad_campaign_metrics\(uuid\) from authenticated;/i,
    );
    assert.match(
      sql,
      /grant execute on function public\.get_admin_partner_ad_campaign_metrics\(uuid\) to service_role;/i,
    );
  }
});
