/**
 * 쇼케이스 대표 이미지의 `next/image` sizes. 원본은 1600×900 WebP(showcase-project 정책)이고
 * 옵티마이저가 이 폭에 맞는 변형만 만들도록 레이아웃 폭과 맞춘다.
 */

/** 갤러리 그리드(1열 → sm 2열 → lg 3열, max-w-7xl) 기준 카드 이미지 폭. */
export const SHOWCASE_PROJECT_CARD_IMAGE_SIZES =
  "(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 400px";

/** 상세(max-w-5xl)·내 프로젝트(max-w-4xl) 본문 폭 기준 대표 이미지 폭. */
export const SHOWCASE_PROJECT_HERO_IMAGE_SIZES = "(max-width: 1023px) 100vw, 976px";
