/**
 * 숫자·통화·퍼센트 표기 공용 헬퍼. 로케일을 ko-KR로 고정해 서버 런타임 기본 로케일이나
 * 브라우저 언어 설정에 따라 구분 기호가 바뀌지 않게 한다(무인자 `toLocaleString()` 금지).
 */
export const KOREAN_NUMBER_LOCALE = "ko-KR";

/** 천 단위 구분 기호가 있는 숫자 표기("1,234"). 건수·횟수·인원 등에 쓴다. */
export function formatCount(value: number) {
  return value.toLocaleString(KOREAN_NUMBER_LOCALE);
}

/** 원화 금액 표기("12,000원"). */
export function formatKoreanWon(value: number) {
  return `${formatCount(value)}원`;
}

/**
 * 퍼센트 표기. `fractionDigits` 자리로 반올림해 고정 소수 자릿수로 보여 준다
 * (예: 12.34, 1 → "12.3%"). 값은 이미 0~100 범위의 퍼센트 수치여야 한다.
 */
export function formatPercent(value: number, fractionDigits = 0) {
  return `${value.toLocaleString(KOREAN_NUMBER_LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}
