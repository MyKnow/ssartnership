import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Database } from "../../src/lib/supabase/database.generated";

const { getSupabaseAdminClient } = vi.hoisted(() => ({ getSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdminClient }));

import { SupabaseAdPackageRepository } from "../../src/lib/repositories/supabase/ad-package-repository.supabase";
import { hashCouponVerificationPassword } from "../../src/lib/coupon-verification-password";

type Result = { data?: unknown; count?: number | null; error?: { message: string } | null };
function clientFor(results: Result[], rpcResults: Result[] = []) {
  const queries: Array<{ table: string; calls: Array<[string, ...unknown[]]> }> = [];
  const from = vi.fn((table: string) => {
    const result = results.shift();
    if (!result) throw new Error(`Unexpected query: ${table}`);
    const query = { table, calls: [] as Array<[string, ...unknown[]]> };
    queries.push(query);
    const builder = Object.fromEntries(
      ["select", "eq", "neq", "in", "is", "gte", "lte", "or", "order", "insert", "update", "delete", "upsert", "maybeSingle", "single"].map((method) => [
        method, (...args: unknown[]) => { query.calls.push([method, ...args]); return builder; },
      ]),
    ) as Record<string, unknown>;
    builder.then = (resolve: (value: Result) => unknown) => Promise.resolve({ data: null, error: null, ...result }).then(resolve);
    return builder;
  });
  const rpc = vi.fn(async () => {
    const result = rpcResults.shift();
    if (!result) throw new Error("Unexpected RPC");
    return { data: null, error: null, ...result };
  });
  getSupabaseAdminClient.mockReturnValue({ from, rpc });
  return { queries, rpc, results, rpcResults };
}

function coupon(overrides: Partial<Database["public"]["Tables"]["ad_coupons"]["Row"]> = {}) {
  return {
    id: "coupon-1", campaign_id: null, partner_id: "partner-1", title: "쿠폰", description: "",
    code: "", issuance_type: "service", redemption_type: "onsite", discount_label: "할인", terms: [],
    status: "active", starts_at: "2026-01-01T00:00:00Z", ends_at: "2027-01-01T00:00:00Z",
    download_starts_at: "2026-01-01T00:00:00Z", download_ends_at: "2027-01-01T00:00:00Z",
    usage_starts_at: "2026-01-01T00:00:00Z", usage_ends_at: "2027-01-01T00:00:00Z",
    usage_limit: null, daily_issue_limit: null, weekly_issue_limit: null, monthly_issue_limit: null,
    per_member_daily_issue_limit: null, per_member_weekly_issue_limit: null, per_member_monthly_issue_limit: null,
    per_member_limit: 1, onsite_password_hash: null, onsite_password_salt: null, external_url: "",
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", ...overrides,
  } satisfies Database["public"]["Tables"]["ad_coupons"]["Row"];
}

const repository = new SupabaseAdPackageRepository();
beforeEach(() => { vi.clearAllMocks(); });

describe("Supabase ad package facade characterization", () => {
  test.each([null, [], [{ name: "  제휴처 이름  " }], { name: "  제휴처 이름  " }])("maps nullable/object/array partner join %j and redemption count", async (partners) => {
    const fake = clientFor([{ data: { ...coupon(), partners } }, { count: 3 }]);
    const result = await repository.getAdminCouponById("coupon-1");
    expect(result).toMatchObject({ id: "coupon-1", partnerName: !partners || Array.isArray(partners) && partners.length === 0 ? "제휴처" : "제휴처 이름", usedCount: 3, perMemberLimit: 1 });
    expect(fake.queries[1]).toEqual({ table: "ad_coupon_redemptions", calls: [["select", "id", { count: "exact", head: true }], ["eq", "coupon_id", "coupon-1"], ["eq", "status", "redeemed"]] });
  });

  test("preserves legacy nullable windows and default values", async () => {
    clientFor([{ data: { ...coupon(), download_starts_at: null, download_ends_at: null, usage_starts_at: null, usage_ends_at: null, status: "unknown", issuance_type: "unknown", redemption_type: "unknown", per_member_limit: null, terms: [" 약관 ", null, ""], partners: null } }, { count: null }]);
    expect(await repository.getAdminCouponById("coupon-1")).toMatchObject({ downloadStartsAt: coupon().starts_at, usageEndsAt: coupon().ends_at, issuanceType: "service", redemptionType: "onsite", status: "draft", terms: ["약관"], perMemberLimit: 1, usedCount: 0 });
  });

  test.each([{ data: null }, { error: { message: "ad_coupons does not exist" } }, { error: { message: "ad_coupons schema cache missing" } }])("returns null without a count query for missing coupon/schema %j", async (result) => {
    const fake = clientFor([result]);
    expect(await repository.getAdminCouponById("missing")).toBeNull();
    expect(fake.queries).toHaveLength(1);
  });

  test("propagates query and redemption-count errors", async () => {
    clientFor([{ error: { message: "connection failure" } }]);
    await expect(repository.getAdminCouponById("coupon-1")).rejects.toThrow("connection failure");
    clientFor([{ data: coupon() }, { error: { message: "count failure" } }]);
    await expect(repository.getAdminCouponById("coupon-1")).rejects.toThrow("count failure");
  });

  test("campaign preparation exposes options before deferred rollups resolve", async () => {
    const campaign = { id: "campaign-1", partner_id: "partner-1", package_tier: "basic", title: "광고", description: null, sponsor_label: null, status: "active", starts_at: coupon().starts_at, ends_at: coupon().ends_at, channels: [], monthly_price_krw: null, notes: null, created_at: coupon().created_at, updated_at: coupon().updated_at, partners: { name: "제휴처" } };
    const fake = clientFor([{ data: [campaign] }, { data: [coupon({ campaign_id: campaign.id })] }], [{ data: [{ campaign_id: campaign.id, home_banner_clicks: "4.8", coupon_views: -2, coupon_copies: "invalid", coupon_intent_count: null, coupon_redemptions: "2", ad_push_sends: 0, coupon_redemption_counts: { "coupon-1": "2" } }] }]);
    const prepared = await repository.prepareAdminCampaigns();
    expect(prepared.options).toHaveLength(1);
    expect(await prepared.campaigns).toMatchObject([{ id: campaign.id, coupons: [{ usedCount: 2 }], metrics: { homeBannerClicks: 4, couponViews: 0, couponCopies: 0, couponRedemptions: 2 } }]);
    expect(fake.rpc).toHaveBeenCalledWith("get_admin_ad_campaign_rollups", { input_partner_id: null });
  });

  test("coupon deletion refuses stale row versions", async () => {
    const fake = clientFor([{ data: { status: "paused", updated_at: "version-1" } }, { count: 0 }, { count: 0 }, { data: [] }]);
    expect(await repository.deleteCoupon("coupon-1")).toEqual({ ok: false, reason: "state_changed" });
    expect(fake.queries[3].calls).toContainEqual(["eq", "updated_at", "version-1"]);
    expect(fake.queries[3].calls).toContainEqual(["neq", "status", "active"]);
  });

  test.each([["ad_coupon_member_limit", "member_limit"], ["ad_coupon_usage_limit", "usage_limit"], ["ad_coupon_code_unavailable", "code_unavailable"]])("classifies issue RPC %s", async (message, reason) => {
    const fake = clientFor([], [{ error: { message } }]);
    expect(await repository.issueCoupon({ couponId: "coupon-1", memberId: "member-1" })).toMatchObject({ ok: false, reason });
    expect(fake.rpc).toHaveBeenCalledWith("issue_ad_coupon", { p_coupon_id: "coupon-1", p_member_id: "member-1", p_session_id: null });
  });

  test("issue success retains code and issue snapshot", async () => {
    clientFor([{ data: coupon() }], [{ data: [{ issue_id: "issue-1", coupon_id: "coupon-1", assigned_code: "ASSIGNED", issued_at: "2026-06-01T00:00:00Z" }] }]);
    expect(await repository.issueCoupon({ couponId: "coupon-1", memberId: "member-1" })).toMatchObject({ ok: true, issue: { coupon: { id: "coupon-1" }, issueId: "issue-1", assignedCode: "ASSIGNED", issuedAt: "2026-06-01T00:00:00Z" } });
  });

  test("redemption verifies issue password snapshot before the locking RPC", async () => {
    const password = await hashCouponVerificationPassword("1234");
    const issue = { id: "issue-1", coupon_id: "coupon-1", member_id: "member-1", assigned_code: null, status: "issued", redemption_type_snapshot: "onsite", onsite_password_hash_snapshot: password.hash, onsite_password_salt_snapshot: password.salt, usage_starts_at: "2000-01-01T00:00:00Z", usage_ends_at: "2100-01-01T00:00:00Z" };
    const required = clientFor([{ data: issue }]);
    expect(await repository.redeemCouponIssue({ issueId: "issue-1", memberId: "member-1" })).toMatchObject({ ok: false, reason: "onsite_password_required" });
    expect(required.rpc).not.toHaveBeenCalled();
    const invalid = clientFor([{ data: issue }]);
    expect(await repository.redeemCouponIssue({ issueId: "issue-1", memberId: "member-1", onsitePassword: "4321" })).toMatchObject({ ok: false, reason: "onsite_password_invalid" });
    expect(invalid.rpc).not.toHaveBeenCalled();
    const success = clientFor([{ data: issue }], [{ data: { coupon_id: "coupon-1", issue_id: "issue-1", assigned_code: "CODE" } }]);
    expect(await repository.redeemCouponIssue({ issueId: "issue-1", memberId: "member-1", onsitePassword: "1234" })).toEqual({ ok: true, couponId: "coupon-1", issueId: "issue-1", assignedCode: "CODE" });
    expect(success.rpc).toHaveBeenCalledWith("redeem_ad_coupon_issue", expect.objectContaining({ p_verified_onsite_password_hash: password.hash }));
  });
  test.each([
    { limits: { usage_limit: 1 }, redemptions: [{ coupon_id: "coupon-1", member_id: "other" }], memberIssues: [], issues: [] },
    { limits: { per_member_limit: 1 }, redemptions: [{ coupon_id: "coupon-1", member_id: "member-1" }], memberIssues: [], issues: [] },
    { limits: { daily_issue_limit: 1 }, redemptions: [], memberIssues: [], issues: [{ coupon_id: "coupon-1", issued_at: "2026-06-01T00:00:00Z" }] },
    { limits: { per_member_daily_issue_limit: 1 }, redemptions: [], memberIssues: [{ coupon_id: "coupon-1", issued_at: "2026-06-01T00:00:00Z" }], issues: [] },
  ])("member availability preserves global/member redemption and issuance quotas $limits", async ({ limits, redemptions, memberIssues, issues }) => {
    clientFor([{ data: [coupon(limits)] }, { data: redemptions }, { data: memberIssues }, { data: issues }]);
    expect(await repository.listAvailableCouponsForMember({ memberId: "member-1", partnerIds: ["partner-1"], now: new Date("2026-06-01T01:00:00Z") })).toEqual([]);
  });

  test("wallet mapping preserves joined object/array and skips missing coupons", async () => {
    const issue = { id: "issue-1", coupon_id: "coupon-1", member_id: "member-1", assigned_code: "CODE", issued_at: "2026-06-01T00:00:00Z", used_at: null };
    const fake = clientFor([{ data: [{ ...issue, ad_coupons: coupon() }, { ...issue, id: "issue-2", ad_coupons: [coupon()] }, { ...issue, id: "issue-3", ad_coupons: null }] }]);
    const result = await repository.listIssuedCouponsForMember({ memberId: "member-1", partnerIds: ["partner-1", "partner-1"], now: new Date("2026-06-01T00:00:00Z") });
    expect(result.map((item) => item.issueId)).toEqual(["issue-1", "issue-2"]);
    expect(fake.queries).toHaveLength(1);
    expect(fake.queries[0].calls).toContainEqual(["in", "ad_coupons.partner_id", ["partner-1"]]);
  });

  test("code pool writes hash/deduplicate codes and stop at bounded batches", async () => {
    const fake = clientFor([{ data: Array.from({ length: 1000 }, (_, id) => ({ id })) }, { data: [] }]);
    const codes = Array.from({ length: 1001 }, (_, i) => `CODE-${i}`);
    expect(await repository.addCouponCodes({ couponId: "coupon-1", codes: [...codes, " CODE-0 ", ""] })).toEqual({ addedCount: 1000, skippedCount: 1 });
    const batches = fake.queries.map((query) => query.calls.find(([method]) => method === "upsert")!);
    expect((batches[0][1] as unknown[])).toHaveLength(1000);
    expect((batches[1][1] as unknown[])).toHaveLength(1);
    expect(batches[0][2]).toEqual({ onConflict: "coupon_id,code_hash", ignoreDuplicates: true });
    expect((batches[0][1] as Array<{ code_hash: string }>)[0].code_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test.each([["ad_coupon_member_limit", "member_limit"], ["ad_coupon_usage_limit", "usage_limit"], ["ad_coupon_onsite_password_invalid", "onsite_password_invalid"]])("classifies redeem RPC %s", async (message, reason) => {
    clientFor([{ data: { id: "issue-1", coupon_id: "coupon-1", member_id: "member-1", assigned_code: null, redemption_type_snapshot: "code", status: "issued", usage_starts_at: "2000-01-01T00:00:00Z", usage_ends_at: "2100-01-01T00:00:00Z" } }], [{ error: { message } }]);
    expect(await repository.redeemCouponIssue({ issueId: "issue-1", memberId: "member-1" })).toMatchObject({ ok: false, reason });
  });

});
