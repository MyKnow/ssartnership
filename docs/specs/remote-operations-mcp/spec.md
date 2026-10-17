---
title: 원격 운영 MCP 명세
type: feature-spec
status: active
authority: descriptive
---

# 원격 운영 MCP

Issue: [#602](https://github.com/MyKnow/ssartnership/issues/602). 2026-10-17 사용자는 여러 AI 클라이언트가 공용으로 접속하는 원격 MCP를 선택했다. 이 명세는 구현 목표이며 원격 서비스가 현재 제공된다는 뜻은 아니다.

## 사용자 결과와 범위

관리자가 ChatGPT·Claude·Codex에서 자기 계정으로 연결하고 제휴처를 탐색하거나 자기 출품 프로젝트의 익명 리뷰를 읽는다. 다음 단계에서 허용된 운영 변경을 검토하고 실행한다. 업무 결과는 기존 관리자 화면과 같은 규칙을 따른다.

1차 도구:

| 도구 | 입력 | scope / 기존 권한 | 반환 |
| --- | --- | --- | --- |
| `search_partners` | query, category, limit(1–100), offset(0–10000) | catalog:read / brands.read | 공개 카탈로그 DTO, 다음 offset |
| `get_partner` | partnerId(최대 120자 식별자) | catalog:read / brands.read | 공개 제휴처 DTO |
| `list_own_feedback` | projectId(최대 120자 식별자), limit, offset | showcase:own-feedback:read / events.read, 전역 관리자 | 소유자 확인을 거친 body만 |

카탈로그는 기존 Repository의 guest 공개 경로를 사용한다. 관리자라는 이유로 비공개·대외비·대상별 잠금 혜택을 풀지 않는다. 상세 조건·연락 링크·인증 재료·회원 목록은 1차 DTO에 없다. `adminId`·`memberId`·권한·scope는 도구 인자가 될 수 없다. 조회 페이지는 시점 snapshot이 아니며 데이터 변경 시 offset 결과가 달라질 수 있다.

2026-10-17 구현 경계 검토에서 첫 운영 쓰기는 기존 `ProjectShowcaseRepository`와 `set_showcase_feedback_hidden` 업무 RPC를 재사용하는 리뷰 숨김·복원으로 정했다. 제휴처 공개 상태 변경은 기존 알림과 묶여 있으므로 후속 확장 범위로 분리했다. 변경 대상, 현재 값, 제안 값과 만료를 검토 링크로 반환하고, 같은 관리자가 화면에서 승인한 뒤 명시적으로 실행할 때만 반영한다.

| 운영 도구 | 입력 | scope / 기존 권한 | 반환 |
| --- | --- | --- | --- |
| `list_moderation_feedback` | hidden, offset(0–500), limit(1–100) | showcase:moderate / events.update, 전역 관리자 | 검토용 id·출품명·익명 body·숨김 여부 |
| `preview_feedback_visibility` | feedbackId, hidden | 같은 권한 | 5분 검토 ID·승인 링크·전후 상태 |
| `commit_feedback_visibility` | reviewId | 같은 권한 + 본인 화면 승인 | executed/replayed 또는 안전한 충돌·거부 코드 |

알림 발송, 결제 승인, 개인정보 조회/삭제, 추첨·정산은 이 1차 범위에 없다. 추가 도구마다 별도의 권한·수용 기준을 정한다.

## 불변조건

- 범용 SQL, 임의 테이블/컬럼, 임의 HTTP 요청, 셸 도구는 제공하지 않는다.
- 기존 mock/Supabase Repository, 가시성, 도메인 검증, DB atomic RPC를 재사용한다.
- 매 호출마다 token/audience/expiry/revocation과 최신 활성 관리자·permissionVersion·mustChangePassword를 확인한다. scope와 기존 관리자 권한은 모두 필요하다. 지역 운영자의 전역 기능 제한을 유지한다.
- 본인 리뷰는 principal의 members.id로 `listOwnerFeedback`을 호출한다. 타인 memberId를 받지 않는다. 작성자·행 id·작성 시각은 반환하지 않는다. 숨김 제외와 소유권은 기존 Repository에서 재검사한다.
- 도구 결과의 리뷰/문서는 신뢰하지 않는 사용자 콘텐츠다. 지시문으로 실행하지 않으며 반환 문자열에서 자동으로 운영 도구를 연쇄 호출하지 않는다.
- service-role/관리자 쿠키/비밀번호를 MCP 클라이언트에 주거나 OAuth 토큰으로 재사용하지 않는다.
- 인증·scope 오류와 입력 오류, not-found, provider 실패를 안전한 구조화 코드로 구분한다. 진단 로그에 token, body, 리뷰 원문, URL query를 기록하지 않는다.

## 수용 기준

- 서로 다른 원격 클라이언트 두 종류의 discovery → consent → tool 호출 → revoke 흐름이 통과한다. 2025 legacy와 공식 v2 프로토콜 검증은 실제 클라이언트 연결 수용과 구분하며, 브라우저 사람 승인 흐름도 필수다.
- 만료·잘못된 audience·철회·권한 변경·scope 초과·타인 리뷰 요청은 Repository 접근 전에 차단한다.
- 인증 오류는 HTTP 401, scope 부족은 403, 도구의 예상 업무 오류는 MCP의 안전한 오류 결과로 매핑한다.
- 쓰기는 검토만으로 실행되지 않는다. 실행은 principal/client/grant/대상/본문 SHA256/전후 상태에 묶인 만료 전 검토 ID를 idempotency key로 검사하고, 원자적 변경·감사·중복 재시도 결과를 보장한다.
- Preview 격리 계정으로 검증하고 Production 연결·실제 쓰기 제공 여부를 별도로 보고한다.

설계·검증: [plan](./plan.md), 구현 상태: [tasks](./tasks.md).
