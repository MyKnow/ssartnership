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

현재 admin_web_vital과 admin_route_timing 집계 화면은 최근 7일의 안전한 p75 요약을 표시하고, `mobile`·`tablet`·`desktop` viewport와 과업별 표본을 별도 집계한다. 표본이 충분히 쌓인 route·viewport·과업부터 목표를 판정하며, 실제 Preview 표본이 쌓이기 전에는 관측 중으로 표시한다.

## 해석 규칙

1. 화면이 빠르게 보이는 것과 서버 응답이 빠른 것은 분리해 판단한다.
2. 낙관적 UI는 실제 서버 성공을 의미하지 않으므로, 성공률과 체감 응답을 별도 측정한다.
3. `unknown` 표본을 `complete`에 합산하지 않는다.
4. route timing만으로 API p95를 주장하지 않는다. API·DB·RSC·브라우저 렌더링을 각각 계측해야 한다.
5. 성능 개선 전후에는 같은 관리자 과업, 권한, viewport, 데이터량을 비교한다.

## 2026-07-27 실행 측정

현재 작업 브랜치의 production build를 관리자 세션으로 측정했다. 24시간 범위의
로그 요약 RPC는 warm 기준 약 136ms, 페이지 RPC는 약 121ms였지만, 로그 화면의
보조 활성도 RPC는 약 8.3–8.6초 후 statement timeout으로 실패했다. 그 결과
`/admin/logs` 전체 응답 종료 시간은 약 8.4초까지 늘어났다.

Phase 1 보강으로 활성도 집계 SQL에서 일별 행과 rolling window를 분리하고, 보조
RPC가 500ms를 넘으면 안전한 빈 상태로 전환하도록 했다. SQL migration이 적용되지
않은 환경에서도 로그 본체를 오래 붙잡지 않으며, migration 적용 후에는 동일한
반환 계약으로 집계 비용 자체도 줄어든다. 코드 변경 후 같은 환경의 전체 응답은
약 0.56–0.78초까지 줄었고, 이 값에는 500ms fallback과 RSC payload 전송 시간이 포함된다.
로그 본체의 첫 렌더링·페이지 RPC와 보조 패널 완료 시간은 별도로 해석해야 한다.

같은 production build에서 `/admin/notification-templates`의 초기 응답은 상세 본문을
목록에 포함하던 약 1.26MB에서 요약 메타데이터만 전달하는 약 559KB로 줄었다.
상세 본문은 항목을 펼칠 때 권한 검사를 거쳐 별도 API로 조회하며, 측정 응답은 약
63–84ms·1KB였다. 이 분리는 목록 탐색과 본문 편집의 데이터 요구량을 분리하지만, 상세
조회 실패 시에는 안전한 재시도 안내를 보여주고 원시 서버 오류를 노출하지 않는다.

로컬 production 서버에서는 Vercel Analytics·Speed Insights 스크립트를 로드하지
않도록 조건부 처리했다. Vercel 실행 환경에서는 기존 계측을 유지하고, 로컬 QA에서는
선택적 외부 스크립트의 404가 관리자 화면 오류 신호를 오염시키지 않게 한다.

프로필 사진 검토 큐는 최대 50개의 미리보기 요소를 렌더링하지만, 첫 제출 사진만
즉시 로드하고 나머지는 브라우저 viewport 기준으로 지연 로드한다. 360px·820px·1366px
실제 View에서 이미지 요소는 각 50개였으나 초기 이미지 요청은 각각 5·12·18개로
제한됐고, 세 viewport 모두 가로 overflow와 콘솔 오류가 없었다.

운영 로그 목록도 원문 `properties`를 초기 목록 payload에서 제거하고, 상세 펼침
시 `/api/admin/logs/[group]/[id]`로 private 조회하도록 분리했다. production build에서
로그 초기 응답은 약 960KB에서 866KB로 줄었고, 세 viewport 모두 첫 렌더링 시 상세
조회는 0건, 첫 상세를 연 뒤 1건·200 응답이었다. 로그 전체 응답 시간은 현재 원격
집계 함수가 아직 적용되지 않아 약 0.6초이며, migration 적용 후 별도로 재측정한다.

리뷰 검수 큐도 판단에 필요한 요약만 초기 목록에 포함하고 본문·작성자 운영 정보·이미지는
`/api/admin/reviews/[reviewId]`에서 상세 disclosure를 펼칠 때 조회하도록 분리했다. production
build의 실제 관리자 QA에서 `/admin/reviews` 초기 응답은 약 578KB였고, 첫 상세를 열기 전
상세 요청은 0건, 연 뒤 1건·200 응답이었다. 리뷰가 포함된 제휴처 상세 View에서도 같은
동작을 확인했으며, 편집 폼을 별도 `/admin/partners/[partnerId]/edit` 화면으로 분리한 뒤
해당 데이터의 제휴처 상세 초기 응답은 약 556KB로 측정됐다. 분리 전 약 713KB 대비 약
22% 감소한 값이며, 리뷰 상세 요청은 0건에서 1건으로 증가했다. 제휴처 편집 화면은
필요한 폼 옵션과 이미지를 포함해 약 449KB였고, 상세 화면의 `returnTo`를 보존한 복귀 링크와
저장 버튼을 확인했다. 이 수치는 동일한 제휴처·권한·production build에서 측정한 RSC 응답
크기이며, 네트워크·서버·브라우저 렌더링 시간의 단일 p95를 의미하지 않는다. 360px·820px·1366px에서
가로 overflow와 page error 없이 확인했다.

추가로 2026-07-27에 로그 화면의 초기 URL 상태 전달을 정비했다. 이전에는 서버 페이지가
`pageSize`, 검색어, 그룹·상태·정렬 query를 무시하고 항상 기본 100건을 렌더링했지만,
이제 서버와 클라이언트가 동일한 초기 query를 사용한다. 기본 페이지 크기는 50건으로
낮췄고, 동일한 production build에서 `/admin/logs` RSC HTML 응답은 855,119바이트에서
643,761바이트로 약 24.7% 감소했다. `?pageSize=100`은 854,620바이트, `?pageSize=50`은
642,876바이트였으며, `?page=2&pageSize=50&group=security&status=blocked`는 430,990바이트로
필터·페이지 상태도 서버 첫 렌더링에 반영되는 것을 확인했다. 이는 네트워크 전송 크기 기준이며,
INP p75나 API p95를 대신하지 않는다.

로그의 첫 진입과 직접 페이지 번호 URL은 기존 계약을 유지하되, 첫 페이지 이후의 다음/이전
이동에는 `created_at`·`id` 복합 키 커서를 사용하도록 보완했다. 서버가 커서 RPC를 아직
제공하지 않는 rolling deploy 환경에서는 기존 page RPC로 안전하게 fallback하며, cursor 값은
회원·IP·원문 properties를 포함하지 않는 검증된 정렬 키만 URL에 담는다. 이 변경은 신규 로그가
중간에 추가될 때 페이지 중복·누락을 줄이는 정합성 개선이며, 실제 Preview query p95는 migration
적용 후 별도로 측정한다.

전역 관리자 탐색 링크와 운영 흐름 링크에는 무분별한 route prefetch를 끄고, 회원 목록 아바타와
프로필 사진 검토 큐 미리보기는 viewport 근처에서만 로드하도록 정비했다. production build의
브라우저 측정에서 `/admin/profile-photos` 초기 탐색은 약 3.4초·25개 요청에서 약 1.1–1.3초·
8개 이하 요청으로 줄었고, 현재 사진 API 요청은 해당 섹션을 스크롤한 뒤에만 발생했다. 이 값은
`networkidle` 기반 브라우저 측정이므로 서버 TTFB와 분리해 해석한다.

회원 목록 행의 상세 링크도 기본 route prefetch를 끄고, 사용자가 선택한 상세 화면만 요청하도록
맞췄다. 회원 목록은 한 페이지에 최대 20개 행을 렌더링하므로, 이 계약은 목록 진입 시 상세
RSC를 여러 개 백그라운드 요청하지 않게 하는 브라우저 비용 제어다.

푸시 관리 화면의 알림센터·로그·전송 탭은 URL query를 `replace`로 보존하되, 화면 상태를
RSC 응답 이후까지 기다리지 않고 즉시 전환하도록 분리했다. 뒤로가기나 직접 URL 진입처럼
외부 URL 상태가 바뀌는 경우에는 낮은 우선순위로 탭을 다시 동기화한다. 푸시 관리 셸에서
가로 overflow를 숨기던 상위 `overflow-x-hidden`도 제거하고, 긴 본문·URL의 줄바꿈 계약을
유지했다. 이 변경은 탭 체감 지연과 overflow masking을 줄이는 UI 계약이며, 실제 route
timing p75·API p95·INP 달성의 증거로 해석하지 않는다.

관리자 공통 셸에서만 사용되는 Toast·Modal·테마 선택의 장식 애니메이션은 CSS와
`motion-reduce`로 대체하고 `framer-motion` 의존성을 제거했다. 이 변경 전 `/admin/logs`에
공통으로 내려가던 약 120KB motion chunk가 사라졌으며, route 전용 chunk와 React/Next 공통
runtime은 별도 비용으로 유지된다. 애니메이션 제거는 기능 상태·포커스·닫기 동작을 바꾸지 않고
공통 JavaScript 실행 비용만 줄이기 위한 것이다.

개발 관리자 세션의 대표 라우트 sweep에서 migration이 아직 적용되지 않은 보조 집계가
`console.error`로 원격 함수명·schema cache 오류를 브라우저 콘솔에 전달하는 것을 확인했다.
보조 패널은 이미 안전한 빈 상태로 복구하고 있었으므로, 이제 서버 로그도 원시 오류 문구 대신
`migration_pending`, `timeout`, `query_failed`, `unexpected_failure` 중 하나의 제한된 reason code만
기록한다. 같은 sweep에서 `/admin`, `/admin/tasks`, `/admin/search`, 회원·제휴처·검토·로그·알림
대표 화면은 단일 `h1`, main landmark, document/body overflow 없음으로 확인했으며, drawer의
닫기 포커스·양방향 Tab 순환·Escape·opener 복귀·body overflow 복원도 실제 브라우저에서 확인했다.

모바일 관리자 메뉴는 실제 360px 브라우저에서 열기 시 닫기 버튼 포커스, Shift+Tab/Tab 양방향
순환, Escape 닫기, opener 포커스 복귀, body overflow 복원을 확인했다. 전체 관리자 27개 라우트의
1366px sweep에서도 최종 상태 `200`, 문서 `h1` 1개, 가로 overflow 없음, page error 없음으로
확인했다. 의도적인 redirect 페이지와 query가 필요한 template endpoint의 400 계약은 별도
정상 동작으로 분류했다.

Storybook interaction 검증은 144개 파일·432개 테스트가 통과했다. 푸시 대상 선택 fixture는
모달 내부 checkbox를 명시적으로 조회하도록 보정했고, 쿠폰 삭제 차단 fixture는 현재 안전한
오류 제목과 일치시켰다. 이 보정은 운영 화면의 오류 문구를 바꾸지 않고, 실제 렌더링 상태를
검증하는 테스트의 선택 범위만 바로잡는다.

제휴처 목록 read-model은 목록에서 쓰지 않는 편집·혜택·이미지 필드를 제거하고, 플랜 탭과
일반 목록에 필요한 projection을 분리했다. 같은 production build와 관리자 데이터에서
`/admin/partners` 초기 응답은 이전 약 513KB에서 약 476KB로 줄었고, 360px·820px·1366px
가로 overflow 없이 검색 URL 반영까지 확인했다. 이 값은 공통 셸과 RSC runtime을 포함하므로
다음 단계에서는 실제 서버 query timing과 목록 paint 시점을 함께 분리해 기록한다.

제휴처 목록 read-model에도 회원 목록과 동일한 3초 bounded timeout을 적용했다. 원격 조회가
멈추면 무한 skeleton 대신 `제휴처 목록을 불러오지 못했습니다`와 재시도 행동을 반환하며,
권한·URL 필터·목록 계약은 유지한다. 이 fallback은 성능 목표 달성의 증거가 아니라, 외부
데이터 지연이 전체 관리자 셸의 조작을 막지 않게 하는 안전 경계다.

변경 후 production build에서 현재 관리자 세션으로 `/admin`, `/admin/tasks`, `/admin/search?q=김민`,
`/admin/members?page=2`, `/admin/partner-requests`, `/admin/partners/new`, `/admin/logs`,
`/admin/reviews`를 순회했다. 현재 브라우저 폭 기준 8개 라우트 모두 단일 `h1`, main landmark,
document/body overflow 없음, application/runtime error 없음이었다. 제휴처 목록에서는 `르블라썸` 검색
query 반영과 상세 이동도 확인했다. 이 sweep은 production build의 단일 세션·단일 폭 증거이며,
INP p75·API p95·모든 권한 조합의 증거는 아니다.

관리자 작업함과 관리 홈의 우선 작업 링크에는 개인정보나 동적 식별자를 포함하지 않는 route key를
연결했다. 링크 진입은 `admin_task_start`, 성공 query는 `admin_task_complete`, 안전한 오류·복구
query는 `admin_task_recovery`로 best-effort 기록하며, 소요 시간은 세션 저장소의 일시값으로만
계산한다. 원시 오류 문구·회원 ID·제휴처 ID는 이벤트 속성으로 보내지 않고, 복구 사유도
`validation`, `permission`, `not_found`, `timeout`, `server`, `unknown` 중 하나로 제한한다.
이 계측은 화면 조작을 기다리지 않으며, 작업 성공률과 복구율을 route timing·Web Vitals와
분리해 해석하기 위한 기반이다.

과업 이벤트는 최근 7일의 시작·완료·복구 건수, 완료율·복구율, 처리 시간 p75로 집계하는
`get_admin_task_outcome_summary` 서버 RPC와 관리자 로그 보조 패널로 연결했다. 집계 결과는
고정 route key와 제한된 숫자 지표만 UI에 전달하며, 표본 30건 미만은 관측 중으로 표시한다.
RPC 또는 migration이 아직 적용되지 않은 환경에서는 안전한 빈 상태를 보여 주고 원본 로그
탐색은 계속 사용할 수 있다. Preview 자격 증명은 GitHub Actions Secrets에 구성되어 있지만
이 작업 세션의 로컬 환경으로 불러오지 않는다. 현재 migration은 이 작업 브랜치에만 있고
`origin/dev`에는 아직 없다. 일반적인 `preview-sync.yml`은 `dev` push를 검증한 뒤 해당 commit을
checkout하고 GitHub Secret으로 Preview migration을 자동 적용하며, 수동 `preview-migrations.yml`은
`main`에서 명시적 확인 문자열을 받아 `dev` 기준 migration을 적용한다. 따라서 현재처럼
migration이 아직 `dev`에 반영되지 않은 상태에서는 어느 workflow도 이 RPC를 Preview에 적용하지
않는다. 실제 RPC p95 측정은 아직 완료하지 않았다.

핵심 관리자 읽기 API에는 `Server-Timing` 헤더를 추가해 `auth`, `session`, `query`, `total`
구간을 브라우저·Playwright에서 분리해 확인할 수 있게 했다. 로그·리뷰·알림·발송 API뿐 아니라
회원 가져오기, 쿠폰 코드 업로드, 수료증·프로필 사진 private media, 설정 링크 재발급 등 관리자
API 전체에 `auth`, `session`, `query`, `lookup`, `storage`, `mutation`, `render`, `total` 중
필요한 고정 phase를 적용했다. 헤더에는 phase 이름과 반올림한 시간만 포함하며, 같은 phase를
반복 측정할 때는 마지막 값으로 덮어쓰지 않도록 고유 phase를 사용한다. 아바타·문서·프로필
사진은 DB 조회와 private Storage 다운로드를 분리해 어디에서 지연되는지 구분한다. 회원·제휴처
ID, URL, query, 내부 오류는 기록하지 않는다. 이 헤더는 관측 기반이며 API p95를 대신하지
않으므로, Preview 적용 후 동일한 권한·데이터량으로 p95를 산출해야 한다.

반복 조회가 많은 로그 목록·내 알림·발송 대상 검색 성공 응답에는 사용자 전용 ETag 재검증을
추가했다. 동일한 `If-None-Match`가 오면 본문 대신 304를 반환하고, 응답은
`Cache-Control: private, no-cache`와 `Vary: Cookie`로 공용 캐시에 들어가지 않게 한다. 이는
네트워크 payload 감소를 위한 조건부 최적화이며, 인증·권한 검사와 원본 query 조회를 대체하지
않는다. 실제 304 적중률과 API p95는 Preview에서 동일한 사용자 흐름으로 별도 측정해야 한다.

관리 홈의 직접 서버 경계 측정에서는 대시보드 집계 RPC가 warm 기준 약 90ms였지만,
기수 설정 조회는 약 760ms로 별도 지연을 보였다. 이전에는 두 조회를 함께 기다려 핵심
작업 큐의 첫 렌더링까지 기수 설정 지연이 전파될 수 있었다. 현재는 대시보드 집계를 먼저
렌더링하고 기수 메타데이터는 독립 Suspense 경계에서 스트리밍하며, 설정 조회 실패는
`확인 불가`라는 안전한 상태로 복구한다. 이 측정은 단일 warm 호출이며, p95·실제
브라우저 paint 시간의 증거로 사용하지 않는다.

추가로 기수 설정 read-model은 60초 서버 캐시와 `ssafy-cycle-settings` tag를 사용하도록
정비했다. 기수 변경 액션은 해당 tag를 즉시 무효화하므로, 평상시 반복 진입의 DB 왕복은
줄이면서 저장 직후에는 최신 설정을 다시 읽는다. 캐시 적용 후의 실제 Preview p95는 별도
표본으로 재측정해야 한다.

관리 홈과 회원 목록 read-model에는 각각 bounded timeout을 두었다. 외부 DB/RPC가 응답하지
않을 때 셸이 무한히 skeleton에 머물지 않고, 관리 홈은 안전한 집계 오류 상태로, 회원 목록은
재시도 가능한 목록 오류 상태로 전환한다. timeout은 성능 목표 달성의 증거가 아니며, Preview의
실제 API p95·오류율과 별도로 관측해야 한다.

이벤트 상세의 당첨자·회원별 추첨권 운영 표와 로그의 route timing·과업 성과 표는
데스크톱/태블릿에서는 비교용 표를 유지하고, 모바일에서는 같은 정보를 카드 목록으로
전환한다. 모바일에서 가로 스크롤만 강요하지 않으며, 알림·추첨 상태도 내부 enum 대신
한국어 운영 상태로 표시한다. 전역 `prefers-reduced-motion` 규칙은 자동 전환·스크롤·애니메이션
시간을 줄여 보조기기와 저감 모션 사용자에게 동일한 조작 경로를 제공한다.

활성도는 로그 탐색에 필수적이지 않은 보조 스트림이므로, migration이 적용되지 않았거나
집계가 느린 환경에서는 200ms 안에 안전한 빈 상태로 전환한다. 핵심 로그 목록은 이 보조
집계를 기다리지 않고 먼저 사용할 수 있으며, migration 적용 후에는 이 fallback 비율과
실제 활성도 RPC p95를 분리해 확인한다.

Web Vitals·route timing·과업 성과 요약도 같은 보조 경계로 취급한다. 각 집계 RPC는 500ms
안에 결과가 오지 않으면 표본 없음/집계 불가 상태로 전환하고, 늦게 도착한 결과나 예외는
화면으로 전달하지 않는다. 서버 로그에는 `migration_pending`, `timeout`, `query_failed`,
`unexpected_failure` 중 하나의 reason code만 남기므로, 보조 지표 장애가 로그 탐색·첫
조작·내부 오류 노출로 이어지지 않는다.

## 다음 기준선 작업

### 2026-07-27 회원 목록 재측정

- production build(`next start`)의 회원 목록 read-model을 동일한 권한·기본 필터로 3회 호출한 결과는 cold 916ms, warm 190ms·183ms였다. warm 측정은 p95가 아니며, 첫 호출의 원격 연결·캐시 상태를 별도로 해석해야 한다.
- in-app browser에서 `/admin/members?page=2`를 5회 새로 연 결과는 353~673ms였다. 이는 RSC 응답·hydration·브라우저 렌더링을 포함한 진입 시간으로, 핵심 read-model의 warm 시간과 동일한 지표가 아니다.
- 20개 회원 카드, 단일 `h1`, document/body overflow 없음은 확인했다. 이번 측정에서 회원 카드에 실제 아바타가 포함되지 않아 이미지 API의 304 재검증은 source contract와 production build까지만 검증했으며, 승인 사진이 있는 계정의 브라우저 재검증은 별도 표본으로 남긴다.
- Mattermost 사용자명·ID 검색은 흔한 문자를 1,000개 디렉터리 ID로 먼저 확장하던 경로를 회원-디렉터리 관계 조인으로 바꿨다. `q="a"`는 이전의 안전한 load error 대신 419건을 반환했고, warm 237~315ms였다. `q="김"`은 221~415ms였으므로, 검색 p95를 200ms 이하로 판정하려면 Preview 표본과 query phase 계측이 더 필요하다.
- 부분 검색의 query phase를 줄이기 위해 `20260727113746_optimize_admin_member_search.sql`에 회원 이름·직접 로그인 ID·Mattermost username/ID용 `pg_trgm` GIN 인덱스를 추가했다. 이 migration은 현재 작업 브랜치에만 있으므로, 실제 개선 폭은 Preview 반영 후 동일 검색어와 데이터량으로 before/after p95를 재측정해야 한다.
- 통합 검색의 결과 링크는 상세 화면을 사용자가 선택하기 전까지 prefetch하지 않도록 했다. production build에서 수정 전에는 검색 결과에 포함된 회원 상세 RSC 요청이 결과 항목 수만큼 발생했지만, 수정 후 같은 `q="김민"` 진입에서 상세 경로 prefetch 요청은 0건이었다. 검색 결과 read-model은 warm 55~111ms였고 화면 렌더링 완료는 361~677ms였으므로, prefetch 제거는 불필요한 백그라운드 요청을 줄인 것이며 전체 초기 진입 p95 200ms 달성의 증거는 아니다.
- 제휴처 추가 화면의 카테고리·파트너사 옵션 read-model은 production 직접 호출 5회에서 47~76ms였고, 실제 production build 화면 렌더링 완료는 358~675ms였다. 현재 관측으로는 옵션 쿼리보다 인증·공통 셸·브라우저 실행 구간을 별도 계측해야 다음 최적화 대상을 결정할 수 있다.
- production build의 대표 화면(`/admin`, `/admin/members?page=2`, `/admin/partner-requests`, `/admin/partners/new`)을 360px·820px·1366px에서 각각 확인한 12개 조합 모두 `h1` 1개, main 콘텐츠 존재, document/body 가로 overflow 없음으로 확인했다. 이는 레이아웃 containment와 렌더링 상태의 증거이며, 실제 터치 조작·전체 관리자 라우트의 모든 상태를 대신하지 않는다.
- 위험 폭인 320px·390px에서도 회원 목록과 제휴처 추가 화면은 같은 기준(`h1` 1개, document/body overflow 없음)을 통과했다.
- 회원 목록의 수동 추가 패널에만 필요한 기수 설정 조회는 핵심 목록 read-model에서 분리해 자체 Suspense 경계로 이동했다. 목록의 검색·필터·페이지 결과는 이 설정 조회를 기다리지 않고 먼저 렌더링하고, 패널은 로딩 skeleton 뒤에 현재 기수 설정을 반영한다. 설정 실패 시에도 기존 정규화 기본값을 사용하므로 수동 추가 기능의 계약과 안전한 복구 경로는 유지된다.
- 따라서 현재 결과는 “warm read-model은 200ms에 근접”한 증거이지, 관리자 전체의 INP p75·API p95·초기 화면 200ms 달성 증거가 아니다.

- 대표 과업을 `작업함 처리`, `회원 검색·상세`, `제휴처 검색·상세`, `심사 큐 결정`으로 고정한다.
- Preview에서 과업 집계 migration을 적용한 뒤 대표 과업별 완료율·복구율·처리 p75를 확인한다.
- 핵심 관리자 읽기 API의 `Server-Timing` phase를 수집해 API p95와 DB/query 구간을 분리한다.
- Preview에서 새 활성도 migration을 적용한 뒤 RPC p95와 `/admin/logs` 첫 렌더링·전체 스트림 종료 시간을 재측정한다.
- Preview 적용 후 dev의 수동 `Measure Admin Preview Performance` workflow를 확인 문자열과 함께 실행한다. 이 workflow는 `npm run measure:admin:preview`를 호출하며, 최근 7일의 RUM·route timing·과업 집계와 mobile/tablet/desktop dimension별 p75를 원본 이벤트 없이 읽고, `ADMIN_PREVIEW_URL`과 `ADMIN_PREVIEW_SESSION_COOKIE`가 있을 때만 지정된 관리자 GET API를 반복 호출해 Server-Timing phase p95를 계산한다. 세션 쿠키와 원시 응답 본문은 출력하지 않는다.
- 관리자 로그 화면에 route timing p75와 과업 outcome p75·표본 수를 서버 집계로 제공한다. 원본 경로와 이벤트 속성은 UI로 전달하지 않는다.
- 현재 원격 환경에서 `get_admin_route_timing_summary` RPC가 schema cache에 없고 활성도 RPC가
  timeout으로 fallback하므로, migration 적용 후 위 성능 수치를 다시 측정한다.
- 360px, 820px, 1366px에서 각 과업의 Storybook·실제 View·Playwright 결과를 연결한다.
