/**
 * 키보드 포커스 링 공용 계약.
 *
 * - 링 색은 `--focus-ring` 솔리드 토큰(`ring-ring`)만 쓴다. `ring-primary/NN`
 *   같은 반투명 링은 라이트 모드에서 3:1 경계 대비를 만족하지 못한다.
 * - `outline-hidden`은 강제 색상 모드(Windows 고대비)에서 투명 outline을
 *   남겨 시스템 포커스 표시가 사라지지 않게 한다.
 * - 오프셋 색은 컨트롤이 놓인 표면에 맞춰 함께 지정한다(기본 흰색 오프셋은
 *   다크 모드에서 밝은 띠로 보인다).
 */
export const FOCUS_RING_CLASS_NAME =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** 페이지 배경·카드 위 컨트롤의 포커스 링. */
export const FOCUS_RING_ON_BACKGROUND_CLASS_NAME =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Modal·시트처럼 overlay 표면 위 컨트롤의 포커스 링. */
export const FOCUS_RING_ON_OVERLAY_CLASS_NAME =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-overlay";
