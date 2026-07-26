# 관리자 콘솔 성능·탐색 기준선

이 문서는 관리자 콘솔의 UI/UX 개선을 측정하기 위한 운영 기준선이다. 현재 목표는 “빠르다”는 인상을 선언하는 것이 아니라, 실제 관리자 세션에서 탐색·렌더링·상호작용 지연을 분리해 확인할 수 있는 데이터를 축적하는 것이다.

## 측정 범위

- `admin_web_vital`: 관리자 route에서 수집한 CLS, FCP, INP, LCP, TTFB
- `admin_route_timing`: 관리자 화면이 열리기 시작한 시점부터 새 route가 렌더링된 시점까지의 클라이언트 탐색 시간
- `page_view`: 관리자 route 방문과 이전 화면의 안전한 경로 템플릿

`admin_route_timing`은 `targetId`에 `admin.partners.detail` 같은 고정 화면 키만 사용한다. 회원 ID, 제휴처 ID, query string, 원시 URL, 서버 오류 메시지는 성능 이벤트에 기록하지 않는다. 알 수 없는 관리자 경로는 `admin.unknown`으로 집계한다.

## 이벤트 계약

`admin_route_timing`의 허용 속성은 다음과 같다.

| 속성 | 값 | 의미 |
| --- | --- | --- |
| `durationMs` | 0–120,000 정수 | 측정된 탐색 시간. 측정할 수 없으면 0 |
| `outcome` | `complete` | `unknown` | `error` | 완료·측정 불가·오류 상태 |
| `trigger` | `initial-load` | `link` | `history` | `programmatic` | 탐색을 시작한 방식 |

`unknown`은 성공으로 간주하지 않는다. 내부 탐색 시작 시각을 확보하지 못했거나 초기 Navigation Timing 값이 없는 세션은 별도 상태로 남겨, 200ms 목표 달성률을 부풀리지 않는다.

## 현재 성능 목표

- INP p75: 200ms 이하
- LCP p75: 2,500ms 이하
- TTFB p75: 800ms 이하
- route timing: 대표 관리자 과업별 p75 200ms 이하를 목표로 하되, 표본 30건 미만은 확인 전 상태로 표시한다.

현재 `admin_web_vital` 집계 화면은 최근 7일의 안전한 p75 요약만 표시한다. route timing은 먼저 원시 이벤트 계약과 수집을 고정하고, 충분한 표본이 쌓인 뒤 route·viewport·과업별 집계를 추가한다.

## 해석 규칙

1. 화면이 빠르게 보이는 것과 서버 응답이 빠른 것은 분리해 판단한다.
2. 낙관적 UI는 실제 서버 성공을 의미하지 않으므로, 성공률과 체감 응답을 별도 측정한다.
3. `unknown` 표본을 `complete`에 합산하지 않는다.
4. route timing만으로 API p95를 주장하지 않는다. API·DB·RSC·브라우저 렌더링을 각각 계측해야 한다.
5. 성능 개선 전후에는 같은 관리자 과업, 권한, viewport, 데이터량을 비교한다.

## 다음 기준선 작업

- 대표 과업을 `작업함 처리`, `회원 검색·상세`, `제휴처 검색·상세`, `심사 큐 결정`으로 고정한다.
- 과업 시작·완료·복구 실패를 식별자 없는 안전한 이벤트로 추가한다.
- 관리자 로그 화면에 route timing p75와 표본 수를 서버 집계로 제공한다.
- 360px, 820px, 1366px에서 각 과업의 Storybook·실제 View·Playwright 결과를 연결한다.
