/**
 * 시각 크기가 44px보다 작은 조작 요소의 터치 히트 영역 계약.
 *
 * 투명 `before:` 의사요소를 요소 중앙에 최소 44×44로 펼친다. 의사요소는
 * 버튼의 일부로 hit-test되므로 시각 밀도를 유지하면서 오탭을 줄인다.
 * 인접한 소형 버튼은 히트 영역이 겹치지 않도록 12px(`gap-3`) 이상 띄운다.
 * 요소에 이미 `before:` 장식이 있거나 `overflow-hidden`이면 쓰지 않는다.
 */
export const TOUCH_TARGET_HIT_AREA_CLASS_NAME =
  "relative before:absolute before:left-1/2 before:top-1/2 before:h-full before:min-h-11 before:w-full before:min-w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']";

/** 인접 소형 버튼의 히트 영역이 겹치지 않는 최소 간격(12px). */
export const TOUCH_TARGET_GROUP_GAP_CLASS_NAME = "gap-3";
