import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PROMOTION_AUTOPLAY_INTERVAL_MS,
  getPromotionScrollBehavior,
  isPromotionPaused,
  shouldAutoplayPromotion,
} from "../src/lib/promotions/autoplay.ts";

const base = {
  slideCount: 3,
  userPaused: null,
  prefersReducedMotion: false,
  keyboardFocusWithin: false,
  documentHidden: false,
} as const;

test("기본 상태에서는 6.5초 간격으로 자동 전환한다", () => {
  assert.equal(PROMOTION_AUTOPLAY_INTERVAL_MS, 6500);
  assert.equal(shouldAutoplayPromotion(base), true);
  assert.equal(getPromotionScrollBehavior(false), "smooth");
});

test("슬라이드가 1장 이하이거나 탭이 숨겨지면 전환하지 않는다", () => {
  assert.equal(shouldAutoplayPromotion({ ...base, slideCount: 1 }), false);
  assert.equal(shouldAutoplayPromotion({ ...base, documentHidden: true }), false);
  assert.equal(
    shouldAutoplayPromotion({ ...base, userPaused: false, documentHidden: true }),
    false,
  );
});

test("동작 줄이기 설정이면 정지 상태로 시작하고 즉시 스크롤한다", () => {
  assert.equal(isPromotionPaused(null, true), true);
  assert.equal(shouldAutoplayPromotion({ ...base, prefersReducedMotion: true }), false);
  assert.equal(getPromotionScrollBehavior(true), "auto");
});

test("사용자 선택은 동작 줄이기 기본값보다 우선한다", () => {
  assert.equal(isPromotionPaused(false, true), false);
  assert.equal(
    shouldAutoplayPromotion({ ...base, prefersReducedMotion: true, userPaused: false }),
    true,
  );
  assert.equal(isPromotionPaused(true, false), true);
  assert.equal(shouldAutoplayPromotion({ ...base, userPaused: true }), false);
});

test("키보드 포커스가 안에 있으면 멈추되 명시적 재생 선택은 존중한다", () => {
  assert.equal(shouldAutoplayPromotion({ ...base, keyboardFocusWithin: true }), false);
  assert.equal(
    shouldAutoplayPromotion({ ...base, keyboardFocusWithin: true, userPaused: false }),
    true,
  );
});

test("일시정지 버튼은 모든 폭에 노출되고 aria-pressed·44px 히트 영역을 가진다", () => {
  const source = readFileSync(
    new URL("../src/components/promotions/PromotionCarousel.tsx", import.meta.url),
    "utf8",
  );
  const pauseButton = source.match(/<button[\s\S]*?data-promotion-carousel-pause[\s\S]*?>/)?.[0] ?? "";
  assert.ok(pauseButton);
  assert.doesNotMatch(pauseButton, /["\s]hidden\s|md:inline-flex/);
  assert.match(pauseButton, /TOUCH_TARGET_HIT_AREA_CLASS_NAME/);
  assert.match(pauseButton, /aria-pressed=\{paused\}/);
  assert.match(pauseButton, /aria-label="광고 자동 재생 일시정지"/);
  assert.match(source, /usePrefersReducedMotion\(\)/);
  assert.match(source, /useDocumentHidden\(\)/);
  assert.match(source, /isKeyboardFocus\(event\.target\)/);
  assert.doesNotMatch(source, /useState\(\(\) => window\.matchMedia/);
});
