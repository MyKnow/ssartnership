---
title: 복구 가능한 오류 UX 계약
type: requirement
status: current
authority: normative
last_verified: 2026-10-05
---

# 복구 가능한 오류 UX 계약

사용자가 입력·권한·일시 장애에서 안전하게 다음 행동을 선택할 수 있도록 다음 계약을 유지한다.

- FE 검증은 불필요한 제출을 막고 첫 오류 필드에 focus를 이동한다.
- API route와 server action은 같은 규칙으로 신뢰 경계에서 다시 검증한다.
- 복구 가능한 실패는 사용자 입력과 현재 작업 문맥을 유지한다.
- validation, unauthorized, forbidden, not-found, conflict, rate-limit, retryable provider failure를 안전한 코드로 구분한다.
- raw error, stack trace, provider 원문, secret 또는 내부 식별자를 사용자 메시지에 노출하지 않는다.
- 클라이언트 `requestJson`은 안전한 서버 오류 문구를 유지하고 네트워크·응답 파싱 실패는 호출처의 안내 문구로 바꾼다. 요청 또는 응답 본문 수신 중 발생한 `AbortError`는 같은 오류 객체로 전달한다. 이메일 계정 복구 실패는 `FormMessage`의 error/alert로, 다음 단계 안내는 info로 구분한다.
- 긴 작업과 파괴적 작업의 실패는 사라지는 toast만 사용하지 않고 inline 상태와 재시도 또는 복구 행동을 남긴다.
- `500`은 입력 오류나 예상 가능한 외부 실패가 아니라 복구할 수 없는 내부 예외에 한정한다.

## 공용 검증·포맷 규칙의 위치

FE 제출 전 검증과 BE 신뢰 경계 검증은 아래 공용 모듈의 같은 함수·상수를 쓴다. 같은 규칙을 화면이나 route에 정규식·숫자 리터럴로 다시 만들지 않으며, 일부 규칙은 소스 래칫 테스트가 재유입을 막는다.

| 규칙 | 공용 위치 |
| --- | --- |
| 숫자 4자리 PIN, 숫자 6자리 인증 코드, 제어문자 | `src/lib/validation.ts`의 `isFourDigitPin`·`isSixDigitCode`·`hasControlCharacters`와 자릿수 상수 |
| 기수 | `src/lib/validation.ts`의 `parseMemberYearValue`·`validateMemberYear`. 앞뒤 공백 제거 후 전체가 십진 숫자인 0~99 정수만 허용하며 소수·지수·숫자 뒤 문자열을 부분 파싱하지 않는다. 소비자가 요구하는 1 이상 같은 추가 제약은 별도로 유지한다 |
| UUID | `src/lib/uuid.ts`의 `isUuid`(앞뒤 공백 허용)·`isUuidFormat`(정확 일치), 버전 1~8 |
| 입력 길이 상한 | 도메인 규칙 모듈의 상수(예: `SHOWCASE_PROJECT_LIMITS`, `PARTNER_BILLING_FIELD_LIMITS`, `REVIEW_TEXT_LIMITS`, `ADMIN_REVIEW_NOTE_MAX_LENGTH`, `NOTIFICATION_TEMPLATE_MAX_*`). 폼 `maxLength`는 상수를 참조한다 |
| 필드 오류와 첫 오류 필드 | `src/lib/field-errors.ts`의 `FieldErrors`·`hasFieldErrors`·`firstInvalidField` |
| FormData 문자열 읽기 | `src/lib/form-data.ts`의 `readString`(trim)·`readRawString`(원문). server action에 같은 모양의 로컬 helper를 다시 만들지 않는다 |
| 날짜·시각 표기 | `src/lib/datetime.ts`. 모든 표기는 `Asia/Seoul`로 고정하고, `Intl.DateTimeFormat`은 이 모듈 안에서만 만든다. 화면·도메인에서 날짜 객체의 `toLocaleString()`·`toLocaleDateString()`을 직접 쓰지 않으며, 기존 `toLocaleString("ko-KR")` 표기는 `formatKoreanLocaleDateTime`으로 유지한다. KST 날짜 문자열(`YYYY-MM-DD`)은 `formatKoreanIsoDate`, 연·월·일 계산은 `getKstDateParts`를 쓰고 타임스탬프 문자열을 잘라 날짜로 쓰지 않는다(UTC 날짜가 나와 KST 00:00~08:59가 하루 앞당겨진다) |
| 숫자·통화·퍼센트 표기 | `src/lib/number-format.ts`의 `formatCount`·`formatKoreanWon`·`formatPercent`. 로케일 인자 없는 `toLocaleString()`은 쓰지 않는다 |

## Server action 실패 피드백 쿼리 규약

- 관리자 server action은 실패를 `redirectAdminActionError(path, code)`로 돌려보내고, 경로에 `?error=<snake_case 코드>`를 붙인다. 경로에 이미 쿼리(예: `returnTo`)가 있으면 헬퍼가 `&error=`로 붙이므로 `?error=`를 직접 이어 붙이지 않는다. 별도 결과 객체(ActionResult)로 전면 전환하지 않는다.
- 코드는 문구와 함께 메시지 맵에 먼저 등록한다. 공용 맵은 `src/lib/admin-action-errors.ts`의 `adminActionErrorMessages`이고, 검토 큐·알림 템플릿·제휴처 쿠폰·광고 캠페인·이벤트·제휴처 폼처럼 화면이 소유한 맵도 `AdminRedirectErrorCode` 타입에 포함된다. 어느 맵에도 없는 코드는 타입 검사와 `tests/admin-action-error-codes.test.mts`에서 실패한다.
- 서비스가 throw한 오류는 `getSafeAdminActionErrorCode(error, fallback)`로 코드 모양만 통과시킨다. 이 동적 코드는 화면 맵에 없을 수 있으므로 화면은 일반 안내 문구로 대체한다.
- 화면은 `?error=` 값을 `pickAllowedEntry`·`getAdminActionErrorMessage`로 조회해 own property만 문구로 바꾼다. 쿼리 값을 그대로 렌더링하거나 `decodeURIComponent`로 다시 해석하지 않는다.
- 성공 피드백은 각 화면이 이미 쓰는 키(`?success=`, `?status=`)를 유지하고 새 쿼리 키를 만들지 않는다.
- 파트너 포털과 공개 화면의 server action도 같은 원칙(코드 또는 allowlist 문구만 전달, 읽는 쪽에서 다시 allowlist)을 따른다.

2026-04의 오류 복구 정비 근거는 [완료 계획](../plans/completed/2026-04-server-error-ux-recovery.md)에 보존한다.
