import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("쿠폰 다운로드와 관리자 CRUD 버튼은 제출 중 상태를 표시한다", async () => {
  const [detail, form, manager] = await Promise.all([
    readFile(new URL("../src/app/(site)/partners/[id]/_page/PartnerDetailCoupons.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/ad-packages/AdminPartnerCouponForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/ad-packages/AdminPartnerCouponManager.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(detail, /loading=\{issuingId === coupon\.id\}/);
  assert.match(detail, /loadingText="담는 중"/);
  assert.match(detail, /setIssuingId\(null\)/);
  assert.match(form, /loadingText=\{mode === "edit" \? "저장 중" : "생성 중"\}/);
  assert.match(manager, /loadingText="복제 중"/);
  assert.match(manager, /loadingText="삭제 중"/);
  assert.match(manager, /md:grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(manager, /break-words text-lg font-semibold/);
  assert.match(manager, /flex min-w-0 flex-wrap items-center justify-end gap-2/);
  assert.doesNotMatch(manager, /제휴처를 바꾸지 않고 현재 상세 페이지의 쿠폰만 등록합니다/);
  assert.doesNotMatch(form, /from "@\/components\/ui\/Card"/);
});

test("쿠폰 생성 UI는 발급·사용 방식에 맞는 필드만 렌더링한다", async () => {
  const source = await readFile(
    new URL("../src/components/admin/ad-packages/AdminPartnerCouponForm.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /issuanceType === "partner_code_pool"/);
  assert.match(source, /redemptionType === "onsite"/);
  assert.match(source, /redemptionType === "external"/);
  assert.match(source, /name="externalUrl"/);
  assert.match(source, /name="codePool"/);
  assert.match(source, /title="기본 정보"/);
  assert.match(source, /title="발급·사용 방식"/);
  assert.match(source, /title="운영 기간"/);
  assert.match(source, /title="발급 한도 및 상태"/);
  assert.match(source, /title="사용 안내"/);
  assert.match(source, /parseCreateAdCouponForm/);
  assert.match(source, /onInvalidCapture={handleNativeInvalid}/);
  assert.match(source, /aria-describedby=\{formError \? formErrorId : undefined\}/);
  assert.match(source, />\s*Error\s*<\/span>/);
});

test("제휴처 상세 쿠폰 Chip에는 전체 사용량 문구를 다시 노출하지 않는다", async () => {
  const source = await readFile(
    new URL("../src/app/(site)/partners/[id]/_page/PartnerDetailCoupons.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /getUsageLabel/);
  assert.doesNotMatch(source, /회 사용/);
});

test("제휴처 수정 저장 CTA는 중복 래퍼 없이 고정 버튼을 렌더링한다", async () => {
  const source = await readFile(
    new URL("../src/components/partner-card-form/PartnerFormActions.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /<div className="pointer-events-auto flex/);
  assert.match(source, /pointer-events-auto min-h-12 w-full max-w-sm/);
  assert.match(source, /<FloatingAction/);
  assert.match(source, /bottom-safe-bottom-20/);
  assert.match(source, /md:right-\[5\.5rem\]/);
});
