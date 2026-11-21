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
  assert.doesNotMatch(wallet, /전체 잔여 수량/);
  assert.doesNotMatch(wallet, /formatGlobalRemaining/);
  assert.doesNotMatch(wallet, /제휴처 상세에서 쿠폰 사용 방법을 확인해 주세요\./);
  assert.doesNotMatch(wallet, /별도 사용 조건은 제휴처 상세를 확인해 주세요\./);
  assert.doesNotMatch(wallet, /제휴처 상세에서 쿠폰을 확인하고 사용할 수 있습니다\./);
  assert.doesNotMatch(wallet, /<Button href=\{detailHref\} variant="primary"/);
  assert.match(wallet, /<Link[\s\S]*href=\{detailHref\}/);
  assert.match(wallet, /\$\{coupon\.partnerName\} 제휴처 상세 보기/);
  assert.match(wallet, />\s*사용하기\s*</);
  assert.match(wallet, /hover:bg-surface-elevated hover-shadow-raised/);
  assert.doesNotMatch(wallet, /hover:ring-/);
  assert.match(wallet, /h-24 cursor-pointer/);
  assert.match(wallet, /min-h-24/);
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

test("제휴처 상세의 즉시 사용 확인은 되돌릴 수 없음을 확인한 뒤에만 redeem을 호출한다", async () => {
  const detail = await readFile(
    new URL("../src/app/(site)/partners/[id]/_page/PartnerDetailCoupons.tsx", import.meta.url),
    "utf8",
  );

  assert.match(detail, /import Modal from "@\/components\/ui\/Modal"/);
  assert.match(detail, /onClick=\{\(\) => \{\s*setConfirmingCoupon\(coupon\);\s*\}\}/);
  assert.match(detail, /사용 확인은 되돌릴 수 없습니다/);
  assert.match(
    detail,
    /if \(confirmingCoupon\) \{\s*void redeemCoupon\(confirmingCoupon\);\s*\}/,
  );
  assert.equal(detail.match(/void redeemCoupon\(/g)?.length, 1);
  assert.match(detail, /setRedeemedCouponIds\(\(current\) => new Set\(current\)\.add\(coupon\.id\)\)/);
  assert.match(detail, />\s*사용 완료\s*</);
  assert.match(detail, /getCouponVerificationHref\(issued\.issueId, returnTo\)/);
});

test("현장 쿠폰 확인 성공 후에는 쿠폰함·제휴처 복귀 CTA를 보여 주고 returnTo는 정규화한다", async () => {
  const [view, page] = await Promise.all([
    readFile(
      new URL("../src/components/coupons/CouponPartnerVerificationView.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/app/(site)/coupons/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(view, /setIsRedeemed\(true\)/);
  assert.match(view, /isRedeemed \? \(/);
  assert.match(view, /href="\/coupons"[\s\S]*?쿠폰함으로/);
  assert.match(view, /href=\{partnerReturnHref\}[\s\S]*?제휴처로 돌아가기/);
  assert.match(
    page,
    /sanitizeReturnTo\(\s*rawReturnTo,\s*`\/partners\/\$\{encodeURIComponent\(selectedItem\.coupon\.partnerId\)\}`,?\s*\)/,
  );
  assert.match(page, /partnerReturnHref=\{partnerReturnHref \?\? "\/"\}/);
});
