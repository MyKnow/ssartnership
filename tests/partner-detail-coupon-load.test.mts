import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  emptyCouponListLoad,
  isMissingAdCouponSchemaError,
  loadCouponListSafely,
} from "../src/lib/partner-detail-coupon-load.ts";

function captureConsoleError(t: test.TestContext) {
  const lines: string[] = [];
  t.mock.method(console, "error", (line: unknown) => {
    lines.push(String(line));
  });
  return lines;
}

test("쿠폰 목록 조회 성공은 그대로 반환하고 로그를 남기지 않는다", async (t) => {
  const lines = captureConsoleError(t);
  assert.deepEqual(
    await loadCouponListSafely(async () => [{ id: "coupon-1" }], "[partner-detail] ad coupon fetch failed"),
    { items: [{ id: "coupon-1" }], unavailable: false },
  );
  assert.equal(lines.length, 0);
});

test("쿠폰 테이블 미배포는 장애가 아닌 조용한 빈 목록이다", async (t) => {
  const lines = captureConsoleError(t);
  for (const message of [
    'relation "public.ad_coupons" does not exist',
    "Could not find the table 'public.ad_coupons' in the schema cache",
  ]) {
    assert.equal(isMissingAdCouponSchemaError(new Error(message)), true);
    assert.deepEqual(
      await loadCouponListSafely(async () => {
        throw new Error(message);
      }, "[partner-detail] ad coupon fetch failed"),
      { items: [], unavailable: false },
    );
  }
  assert.equal(isMissingAdCouponSchemaError(new Error("ad_coupons permission denied")), false);
  assert.equal(lines.length, 0);
});

test("그 밖의 쿠폰 조회 실패는 한 번 정제 기록하고 unavailable로 알린다", async (t) => {
  const lines = captureConsoleError(t);
  const result = await loadCouponListSafely(async () => {
    throw Object.assign(new Error("connection terminated for member@example.test"), {
      code: "08006",
      details: "Key (member_id)=(private-member)",
    });
  }, "[partner-detail] issued coupon fetch failed");

  assert.deepEqual(result, { items: [], unavailable: true });
  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.event, "[partner-detail] issued coupon fetch failed");
  assert.equal(entry.error.code, "08006");
  assert.doesNotMatch(lines[0], /member@example|private-member/u);
});

test("emptyCouponListLoad는 호출마다 새 빈 목록을 만든다", () => {
  const first = emptyCouponListLoad<string>();
  first.items.push("mutated");
  assert.deepEqual(emptyCouponListLoad<string>(), { items: [], unavailable: false });
});

test("제휴처 상세는 쿠폰 조회 실패를 '쿠폰 없음'이 아닌 인라인 안내로 표시한다", async () => {
  const [component, page, data] = await Promise.all([
    readFile(new URL("../src/app/(site)/partners/[id]/_page/PartnerDetailCoupons.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(site)/partners/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(site)/partners/[id]/_page/page-data.ts", import.meta.url), "utf8"),
  ]);

  assert.match(component, /unavailable = false/);
  assert.match(component, /if \(!unavailable\) \{\s*return null;\s*\}/);
  assert.match(component, /쿠폰 정보를 잠시 불러오지 못했습니다\. 잠시 후 새로고침해 주세요\./);
  assert.match(component, /<InlineMessage[\s\S]*?tone="warning"/);
  assert.match(component, /\{unavailable \? <CouponsUnavailableNotice \/> : null\}/);
  assert.match(page, /unavailable=\{couponsUnavailable\}/);
  assert.match(data, /loadCouponListSafely\(/);
  assert.match(data, /couponsUnavailable = activeCoupons\.unavailable \|\| memberCoupons\.unavailable/);
  assert.doesNotMatch(data, /return \[\] as AdCoupon\[\]/);
});
