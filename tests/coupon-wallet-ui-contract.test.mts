import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("쿠폰함은 중복 요약 정보를 노출하지 않고 사용 CTA를 통일한다", async () => {
  const [wallet, detail] = await Promise.all([
    readFile(
      new URL("../src/components/coupons/CouponWalletView.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/(site)/partners/[id]/_page/PartnerDetailCoupons.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.doesNotMatch(wallet, /CouponWalletStats/);
  assert.doesNotMatch(wallet, /가장 빠른 만료/);
  assert.doesNotMatch(wallet, /내 \{remainingMemberUses/);
  assert.doesNotMatch(wallet, /제휴처 상세에서 쿠폰 사용 방법을 확인해 주세요\./);
  assert.doesNotMatch(wallet, /별도 사용 조건은 제휴처 상세를 확인해 주세요\./);
  assert.doesNotMatch(wallet, /제휴처 상세에서 쿠폰을 확인하고 사용할 수 있습니다\./);
  assert.match(wallet, />\s*사용하기\s*</);
  assert.match(detail, />\s*사용하기\s*</);
});

test("쿠폰 확인 화면은 쿠폰함과 분리된 화면으로 렌더링한다", async () => {
  const source = await readFile(
    new URL("../src/app/(site)/coupons/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /selectedItem\s*\?\s*\([\s\S]*CouponPartnerVerificationView[\s\S]*:\s*\(\s*<CouponWalletView/,
  );
});
