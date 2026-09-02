import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("발급 쿠폰 지갑 조회는 active unused issue와 coupon을 한 번에 조인한다", async () => {
  const source = await readFile(
    new URL("src/lib/repositories/supabase/ad-package-repository.supabase.ts", root),
    "utf8",
  );
  const start = source.indexOf("async listIssuedCouponsForMember(");
  const end = source.indexOf("async addCouponCodes(", start);
  assert.ok(start >= 0 && end > start);
  const method = source.slice(start, end);

  assert.match(
    source,
    /const ISSUED_COUPON_SELECT =[\s\S]*ad_coupons!inner\(\$\{AD_COUPON_SELECT\}\)/,
  );
  assert.equal(method.match(/\.from\("ad_coupon_issues"\)/g)?.length, 1);
  assert.doesNotMatch(method, /\.from\("ad_coupons"\)/);
  assert.match(method, /\.eq\("member_id", input\.memberId\)/);
  assert.match(method, /\.eq\("status", "issued"\)/);
  assert.match(method, /\.is\("used_at", null\)/);
  assert.match(method, /const now = input\.now \?\? new Date\(\)/);
  assert.match(method, /\.gte\("usage_ends_at", nowIso\)/);
  assert.match(
    method,
    /usage_ends_at\.gte\.\$\{nowIso\},and\(usage_ends_at\.is\.null,ends_at\.gte\.\$\{nowIso\}\)/,
  );
  assert.match(method, /\{ referencedTable: "ad_coupons" \}/);
  assert.match(method, /\.in\("ad_coupons\.partner_id", partnerIds\)/);
  assert.match(method, /issue\.ad_coupons/);
  assert.match(source, /const usageEndsAt = row\.usage_ends_at \?\? row\.ends_at/);
});
