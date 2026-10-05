/**
 * 홈 프로모션 캐러셀 자동 전환 규칙(WCAG 2.2.2 일시정지·정지·숨기기).
 *
 * - 사용자가 버튼으로 고른 상태가 최우선이다. 고르지 않았으면
 *   `prefers-reduced-motion: reduce`일 때 정지 상태로 시작한다.
 * - 키보드 포커스가 캐러셀 안에 있는 동안은 일시정지한다. 단, 사용자가
 *   재생을 명시적으로 고른 뒤에는 포커스만으로 다시 멈추지 않는다.
 * - 탭이 숨겨지면 전환하지 않는다.
 */
export const PROMOTION_AUTOPLAY_INTERVAL_MS = 6500;

export type PromotionAutoplayInput = {
  slideCount: number;
  /** 사용자가 고른 일시정지 여부. `null`이면 아직 고르지 않았다. */
  userPaused: boolean | null;
  prefersReducedMotion: boolean;
  keyboardFocusWithin: boolean;
  documentHidden: boolean;
};

/** 일시정지 버튼의 눌림 상태(aria-pressed)로 보여 줄 값. */
export function isPromotionPaused(
  userPaused: boolean | null,
  prefersReducedMotion: boolean,
) {
  return userPaused ?? prefersReducedMotion;
}

export function shouldAutoplayPromotion({
  slideCount,
  userPaused,
  prefersReducedMotion,
  keyboardFocusWithin,
  documentHidden,
}: PromotionAutoplayInput) {
  if (slideCount < 2 || documentHidden) {
    return false;
  }
  if (isPromotionPaused(userPaused, prefersReducedMotion)) {
    return false;
  }
  return !(keyboardFocusWithin && userPaused === null);
}

export function getPromotionScrollBehavior(
  prefersReducedMotion: boolean,
): ScrollBehavior {
  return prefersReducedMotion ? "auto" : "smooth";
}
