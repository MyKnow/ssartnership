/**
 * 모바일 키패드·엔터 키 라벨·자동완성을 맞추는 입력 속성 묶음.
 * FE 입력 형식 힌트일 뿐이며 값 검증은 각 폼의 공용 검증 모듈이 맡는다.
 */

/** 매장·지점·담당자처럼 입력하는 사람 본인이 아닐 수 있는 전화번호. 본인 번호 자동완성을 끈다. */
export const PHONE_INPUT_ATTRIBUTES = {
  type: "tel",
  inputMode: "tel",
  autoComplete: "off",
} as const;

/** 제출자 본인의 연락처(예: 제휴 신청 담당자). 브라우저 전화번호 자동완성을 허용한다. */
export const OWN_PHONE_INPUT_ATTRIBUTES = {
  type: "tel",
  inputMode: "tel",
  autoComplete: "tel",
} as const;

/** Enter로 검색을 실행하거나 결과를 좁히는 검색 입력. */
export const SEARCH_INPUT_ATTRIBUTES = {
  type: "search",
  enterKeyHint: "search",
} as const;
