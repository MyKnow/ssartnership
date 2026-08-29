---
title: 복구 가능한 오류 UX 계약
type: requirement
status: current
authority: normative
last_verified: 2026-08-29
---

# 복구 가능한 오류 UX 계약

사용자가 입력·권한·일시 장애에서 안전하게 다음 행동을 선택할 수 있도록 다음 계약을 유지한다.

- FE 검증은 불필요한 제출을 막고 첫 오류 필드에 focus를 이동한다.
- API route와 server action은 같은 규칙으로 신뢰 경계에서 다시 검증한다.
- 복구 가능한 실패는 사용자 입력과 현재 작업 문맥을 유지한다.
- validation, unauthorized, forbidden, not-found, conflict, rate-limit, retryable provider failure를 안전한 코드로 구분한다.
- raw error, stack trace, provider 원문, secret 또는 내부 식별자를 사용자 메시지에 노출하지 않는다.
- 긴 작업과 파괴적 작업의 실패는 사라지는 toast만 사용하지 않고 inline 상태와 재시도 또는 복구 행동을 남긴다.
- `500`은 입력 오류나 예상 가능한 외부 실패가 아니라 복구할 수 없는 내부 예외에 한정한다.

2026-04의 오류 복구 정비 근거는 [완료 계획](../plans/completed/2026-04-server-error-ux-recovery.md)에 보존한다.
