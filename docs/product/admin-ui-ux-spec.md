# 관리자 기능·UI/UX 구현 명세

작성 기준일: 2026-07-23
상태: 구현 전 기준선
관련 Issue: #205

이 문서는 싸트너십 관리자 콘솔을 새로 만들거나 리팩터링하는 Agent의 제품·UX·기술 계약이다. 실제 권한은 `src/lib/admin-permissions.ts`, 실제 route는 `src/lib/mock/scenarios/route-inventory.ts`, 디자인 토큰과 공용 컴포넌트는 `docs/design-system/` 및 `src/components/ui/`가 최종 기준이다. 문서가 코드와 다르면 임의로 화면을 바꾸지 말고 차이를 Issue에 기록한 뒤 함께 수정한다.

## 1. 목표와 비범위

### 목표

- 관리자가 처리할 일을 먼저 보고, 안전한 다음 행동 하나를 빠르게 완료하게 한다.
- 권한·캠퍼스 범위·민감 정보 경계를 화면 구조에서도 명확히 드러낸다.
- 목록, 큐, 상세, 편집, 발송처럼 반복되는 운영 흐름을 같은 상태·URL·피드백 규칙으로 통일한다.
- 360px 모바일부터 1366px 데스크톱까지 한국어 운영 데이터를 잃지 않고 읽고 조작하게 한다.

### 비범위

- 이 문서는 회원·파트너 포털의 전면 재설계를 정의하지 않는다. 관리자와 만나는 승인·이동 계약만 다룬다.
- UI 개선을 위해 DB schema, API, RLS, repository 계약을 우회하거나 직접 쿼리하지 않는다.
- 장식적인 glass, 과도한 gradient, 중첩 카드, 페이지별 임의 토큰으로 문제를 해결하지 않는다.

## 2. 사용자와 권한 모델

### 역할

| 역할 | 운영 범위 | UI 원칙 |
| --- | --- | --- |
| Super Admin | 전체 resource, 권한, 민감한 승인·템플릿·발신자 설정 | 비가역 행동과 민감 데이터의 최종 승인자다. non-delegable 화면을 사용할 수 있다. |
| 운영 관리자 | 회원·제휴처·파트너사·알림·이벤트·기수 운영 | 일상 큐를 빠르게 처리하되 최고 권한 관리와 가입 승인 요청은 보지 못한다. |
| 지역 제휴 관리자 | 배정 캠퍼스의 제휴처·파트너사 | 전역 카테고리·전역 집계·다른 캠퍼스 데이터를 보거나 수정하지 못한다. |
| 콘텐츠 관리자 | 제휴처 노출, 광고, 이벤트, 리뷰 | 노출 품질과 공개 상태를 관리한다. |
| 고객지원 | 회원·리뷰·인증 검토와 읽기 전용 운영 정보 | 쓰기 권한이 있는 작업만 실행하며 비밀번호·토큰은 보지 못한다. |
| 조회 전용 | 허용 resource의 read | 액션 CTA, bulk mutation, export 권한이 없는 경우 그 기능을 렌더하지 않는다. |

### 강제 경계

- 페이지와 server action은 모두 resource/action 권한을 서버에서 검사한다. 숨긴 버튼만으로 권한을 구현하지 않는다.
- `member_signup_requests`, `notification_templates`, Mattermost sender credential은 일반 permission bit만으로 위임하지 않는다. Super Admin 조건을 서버에서 다시 검사한다.
- 지역 관리자는 navigation, query 결과, 카운트, 상세, mutation 모두 동일한 campus scope를 적용한다. 전역 항목은 빈 상태로 위장하지 말고 메뉴와 진입점에서 제거한다.
- 비밀번호 hash/salt, setup token, reset token, private storage path, signed URL, 원문 PII는 표·toast·URL query·analytics·audit payload에 넣지 않는다.

## 3. 정보 구조와 전역 shell

### 내비게이션 그룹

| 그룹 | canonical 화면 | 목적 |
| --- | --- | --- |
| 개요 | `/admin` | 대기 업무와 운영 요약에서 다음 작업으로 이동 |
| 사용자/권한 | 회원, 수료생 인증, 가입 승인, 프로필 사진, 리뷰, 로그 | 사람·신원·운영 기록을 안전하게 검토 |
| 제휴 운영 | 제휴처, 변경 요청, 카테고리, 등록 신청, 파트너사/계정 | 제휴 서비스의 생성·변경·승인·계정 운영 |
| 메시지/노출 | 내 알림, 발송 관리, 알림 템플릿, 홈 광고, 이벤트 | 내부·외부 메시지와 공개 노출 운영 |
| 설정 | 기수 관리, 관리자 관리 | 전역 운영 기준과 관리자 권한 관리 |

### Shell 계약

- 데스크톱은 `AdminShell`의 고정 좌측 navigation과 상단 utility bar를 사용한다. 중간 폭에서는 아이콘 rail, 넓은 화면에서는 그룹명·라벨·설명이 있는 확장 rail을 사용한다.
- 모바일은 고정 헤더, 홈 이동, 테마 전환, 권한 기반 drawer navigation을 사용한다. 현재 화면의 title과 back context는 drawer에서 확인할 수 있어야 한다.
- shell은 위치·권한 내비게이션·전역 utility만 담당한다. 각 page는 의미상 `h1` 하나, 사용자 과업을 수행하는 primary CTA 하나를 가진 `PageHeader`를 렌더한다. shell title을 페이지 `h1`으로 반복하지 않는다.
- breadcrumb는 `관리 홈 → 현재 영역`까지만 표시한다. 상세 편집 화면은 목록 query를 보존하는 `목록으로` 보조 이동을 제공한다.
- nav item은 read 권한이 있을 때만 보인다. active state는 primary surface와 명도·border·텍스트 대비로 구분하며 색만으로 상태를 전달하지 않는다.

### 관리자 화면의 미니 브리프

새 화면이나 큰 리디자인 전에는 아래를 Issue/PR에 적는다.

```text
사용자와 단일 행동:
현재 route·권한·공용 컴포넌트 제약:
첫 viewport에서 보여줄 처리 판단:
기능적 시그니처 하나:
generic UI 자기점검과 제거할 장식:
```

기능적 시그니처는 운영 판단을 돕는 한 가지여야 한다. 예를 들어 승인 큐의 최신 diff 요약, 로그 explorer의 preset-to-result 연계, 대기 항목의 명확한 우선순위다. 단순 gradient, 큰 숫자 카드, 랜덤한 illustration은 시그니처가 아니다.

## 4. 시각·컴포넌트 계약

### 토큰과 위계

- 전역 기반은 navy/slate surface와 Pretendard 기반 한국어 typography다. 색상은 `background`, `surface`, `surface-inset`, `surface-elevated`, `surface-overlay`, `primary`, `success`, `warning`, `danger` 의미 토큰을 사용한다.
- 구조는 `page → panel → elevated card → inset block → control` 순서다. 정보 행, filter group, 요약 박스에 독립 의미가 없으면 `Card`를 중첩하지 않고 `Surface level="inset"`을 사용한다.
- page title은 `ui-page-title`, section title은 `ui-section-title`, 운영 메타는 `ui-caption` 또는 `ui-kicker`를 사용한다. 한국어 본문에 `break-all`을 적용하지 않는다.
- elevation은 `flat`, `raised`, `floating`, `overlay`의 semantic token으로만 선택한다. 임의 `shadow-*`, raw hex, 페이지 전용 radius를 추가하지 않는다.

### 우선 사용할 공용 컴포넌트

| 목적 | 우선 컴포넌트 | 규칙 |
| --- | --- | --- |
| 페이지 진입 | `PageHeader`, `PageSection` | 단일 h1, 짧은 설명, primary CTA 하나 |
| 표면 | `Surface`, `Card`, `Container` | 같은 depth는 같은 surface/elevation 사용 |
| 목록 필터 | `FilterBar`, `AdvancedFilterDisclosure`, `Input`, `Select` | 기본 3~4개, 나머지는 disclosure, URL query가 기준 |
| 데이터 밀도 | `DataPanel`, `StatsRow`, `CompactEntityRow` 계열 | 핵심 식별자·상태·한두 메타·상세 이동만 우선 노출 |
| 입력 | `FormSection`, `FormMessage`, `InlineMessage`, `SubmitButton` | field error와 첫 오류 focus를 제공 |
| 피드백 | `Skeleton`, `EmptyState`, `InlineMessage`, `Toast`, `Modal` | toast는 일시 확인, recovery는 문맥 안에서 제공 |
| 반응형·모션 | `ResponsiveGrid`, `MotionReveal` | reduced motion을 존중하며 정보 재배치를 우선 |

## 5. 공통 상태 전이와 오류 복구

### URL과 routing

| 상황 | 기준 |
| --- | --- |
| 목록에서 상세·생성·작업 화면으로 의도적으로 이동 | `push` |
| 저장 완료 후 canonical 상세, legacy URL 정규화, 동일 목록의 filter/query 동기화 | `replace` 또는 server redirect |
| 로그인, permission, render-time prerequisite | 서버 `redirect` |
| 현재 route를 유지한 채 독립 행·drawer action 결과만 다시 읽기 | 한 번의 `refresh` |

- 검색·정렬·필터·page size·페이지는 canonical 목록 route의 URL query가 단일 기준이다. filter가 바뀌면 page를 1로 되돌리고 `replace`하며 scroll 위치를 불필요하게 초기화하지 않는다.
- `/admin/members`는 이 계약을 따른다. `/admin/partners`처럼 로컬 state에만 머무는 기존 목록은 리팩터링 우선 대상이며, 완료 기준은 URL 복원·뒤로가기·공유 가능 검색이다.
- 상세 진입은 목록 query를 검증된 `returnTo` 또는 명시적 back context로 보존한다. 외부 URL, 다른 권한 영역, 민감 query는 허용하지 않는다.
- mutation 성공 뒤에는 `redirect`, `replace`, `refresh` 중 하나만 실행한다. 성공 toast를 다른 화면으로 전달하려면 안전한 status code만 전달하고 raw error를 query에 넣지 않는다.

### 오류·pending·검증

| 상태 | UI 규칙 |
| --- | --- |
| loading | route skeleton 또는 동일한 hierarchy의 local skeleton. 기존 결과를 지울 필요가 없으면 유지한다. |
| empty | 현재 query와 권한을 설명하고, 가능한 경우 query 초기화 또는 생성/다음 작업을 제안한다. |
| validation | FE와 BE가 같은 schema/rule을 사용한다. field message, first invalid focus(첫 오류 필드 focus), 안전한 입력 보존을 제공한다. |
| domain failure | safe code를 공용 메시지로 매핑한다. 예: 이미 처리됨, scope 밖, 중복, 기간 종료, 참조 중 삭제 불가. |
| conflict | 최신 데이터/상태를 설명하고 새로고침 또는 재검토 행동을 준다. 요청을 자동 재실행하지 않는다. |
| partial failure | 성공·실패 단위를 분리해 보여주고 실패한 항목만 재시도할 수 있게 한다. |
| forbidden | 민감 원인을 노출하지 않고 권한 없음 안내와 안전한 복귀 링크를 준다. |

- `throw new Error`는 provider 누락, 불가능한 상태 같은 invariant 위반만을 위한 것이다. 예상 가능한 validation, authorization, not-found, domain failure는 typed result 또는 safe code로 복구한다.
- raw `Error.message`, Supabase/transport error, SQL·storage path는 브라우저에 표시하지 않는다. 상세 진단은 서버 log/audit context에 남긴다.
- pending은 action/item 범위로 제한한다. 한 행을 처리할 때 전체 목록을 spinner로 잠그지 않는다. 반복 제출은 버튼 disable과 idempotent 서버 전이로 함께 막는다.

### 위험 행동

- 승인·반려·공개 상태 변경·권한 변경·삭제·일괄 발송·export는 대상, 영향, 되돌릴 수 있는지, 필요한 사유를 실행 전 명확히 보여준다.
- destructive action은 danger variant, 확인 dialog, 제출 중 중복 방지, 성공/실패의 명확한 결과를 갖는다. 단순한 `window.confirm`으로 민감 행동을 대체하지 않는다.
- 권한 변경은 자기 권한 제거와 마지막 최고 권한 관리자 제거를 막는다. 가입 승인·인증 승인·사진 검토는 이미 처리된 요청을 다시 처리하지 않는다.

## 6. 화면별 기능 계약

### 운영 홈과 전역 설정

| route | 권한·범위 | 사용자 과업과 primary action | 필수 상태·수용 기준 |
| --- | --- | --- | --- |
| `/admin` | 최소 members read, 각 카드별 resource read, regional scope | 가장 긴급한 큐를 열고 운영 화면으로 이동 | pending queue → quick action → 운영 지표 순. 허용된 수치·링크만 첫 viewport에 노출. 기본/없음/부분 실패/loading/forbidden Story 필요. |
| `/admin/admins` | `admin_management`, 권한 수정은 privileged guard | 관리자 초대·상태·권한 template·campus scope 저장 | 자기 escalation·마지막 최고 권한 제거 금지. setup token은 한 번만 안전히 표시하며 목록·log에 남기지 않음. |
| `/admin/cycle` | cycles read/update | 현재 기수·전환 규칙·카드 theme 저장 | 저장 전 영향 범위와 preview를 표시. `/admin/cycle/mock`은 운영용 mock-only로 navigation에 노출하지 않음. |
| `/admin/denied` | 조건부 public | 권한 부족 후 안전한 출발점으로 이동 | 요청 route·민감 resource를 드러내지 않으며 로그인/관리 홈/사용자 홈 중 안전한 한 행동을 제공. |

### 회원·신원·감사

| route | 권한·범위 | 사용자 과업과 primary action | 필수 상태·수용 기준 |
| --- | --- | --- | --- |
| `/admin/members` | members read, campus scope | 핵심 4개 조건으로 회원을 찾고 상세로 이동 | 기본 filters는 검색·상태·캠퍼스·기수, 20개 page size. 고급 filter count·초기화 표시. URL과 결과·pagination이 일치. |
| `/admin/members/[memberId]` | members read/update, campus scope와 개별 민감 action의 서버 guard | 한 회원의 상태·동의·사진·운영 기록을 검토하고 허용된 변경 저장 | back context 보존. not-found/forbidden/conflict/security-log 없음. 비밀번호 material은 절대 렌더하지 않음. |
| `/admin/graduate-verifications` | graduate_verifications read/update | 수료생 신규·복구·보완·사진 교체를 검토·결정 | private viewer는 서버 권한/no-store. 승인·반려·보완·메일 실패·빈 큐. 새 가입과 기존 회원 복구를 시각적으로 분리. |
| `/admin/profile-photos` | profile_images read/update | 일반 회원의 사진 변경 요청과 기존 사진을 검토 | 인증 검토와 별도 queue. pending/rejected 회원의 인증 카드 노출 규칙을 설명하고 PII 없는 audit을 남김. |
| `/admin/member-signup-requests` | Super Admin + member_signup_requests read | Mattermost 파싱 실패 가입 신청을 상세 검토로 이동 | password material, hash, token을 목록에 노출하지 않음. 빈 큐/부분 실패/권한 없음. |
| `/admin/member-signup-requests/[requestId]` | Super Admin + update | 누락 이름·기수·캠퍼스를 보완해 승인 또는 반려 | pending lock, 이미 처리됨 conflict, 승인/반려 완료. 결정 뒤 password material은 제거되고 재사용 불가. |
| `/admin/reviews` | reviews read/update/delete, campus scope | 신고·검토 우선 리뷰의 공개 상태를 조정 | 검색·상태·rating·company/partner filter, 이미지 실패, hidden/deleted 이력. 이미지 URL과 회원 정보 최소 노출. |
| `/admin/logs` | logs read, export 별도 capability | preset과 query로 제품·감사·보안 로그를 탐색·내보내기 | 제한된 기본 기간, cursor pagination, 결과 유지, source partial failure, export pending. 조회·export를 audit하고 민감 payload redaction 유지. |

### 제휴 운영

| route | 권한·범위 | 사용자 과업과 primary action | 필수 상태·수용 기준 |
| --- | --- | --- | --- |
| `/admin/partners` | brands read/create, campus scope | 제휴처를 찾고 생성·상세 작업으로 이동 | 검색·카테고리·공개 상태·정렬을 URL query로 통일. 20개 단위 또는 명시된 pagination, empty/no result, public/confidential/private 상태가 구분됨. |
| `/admin/partners/new` | brands create, campus scope | 회사 연결부터 혜택·지점·미디어를 검증해 제휴처 생성 | 입력 보존, 첫 오류 focus, duplicate candidate, file/image error, submit pending. 성공하면 canonical detail로 단 한 번 이동. |
| `/admin/partners/[partnerId]` | brands update, campus scope | 공개 상태·핵심 정보·혜택·지점·미디어·리뷰·이력을 수정 | section stack과 sticky save 하나. 최신 원본 conflict, media error, field-level audit. 사용자 문구에서 파트너사/제휴처/지점/혜택을 구분. |
| `/admin/partner-requests` | brands update, campus scope | 변경 요청의 최신 원본과 diff를 보고 승인 또는 반려 | split queue/detail workspace. diff 없음, 증빙 오류, already handled, conflict. `/admin/partners?tab=requests`는 이 route로 canonical redirect. |
| `/admin/partner-registrations` | brands read/update, campus scope | 공개 등록 신청의 회사·제휴처·지점·서류를 승인/반려 | queue/detail 분리, 반려 사유 validation, file error, duplicate 처리 차단. |
| `/admin/categories` | global brands 관리 | 카테고리 생성·이름·순서를 관리하고 삭제 영향을 판단 | 지역 관리자에게 숨김. 현재는 삭제를 잠그고 연결 수·차단 이유를 보여줌. `/admin/partners?tab=categories`는 canonical redirect. |
| `/admin/companies` | companies read/update, campus scope | 파트너사·담당 계정·플랜·증빙을 관리 | 회사와 제휴처 용어 구분. 결제 대기/미납, setup token one-time display, 부분 실패, audit. |

### 메시지·노출·이벤트

| route | 권한·범위 | 사용자 과업과 primary action | 필수 상태·수용 기준 |
| --- | --- | --- | --- |
| `/admin/notifications` | notifications read/update, current admin only | 내 운영 알림을 열고 읽음·수신 설정을 관리 | 발송 composer를 섞지 않음. unread/empty/pagination/read pending/partial failure. 내부 허용 목적지만 열기. |
| `/admin/push` | notifications send, audience validation | 대상·채널·내용을 검토한 뒤 알림을 발송 | 알림센터/로그/발송은 명확한 view mode로만 분리. 대상 수·채널 설정·preview·확인 dialog·부분 실패·중복 submit 차단. |
| `/admin/notification-templates` | Super Admin + notification_templates | 자동 알림의 채널별 template과 허용 변수를 수정·복원 | 실제 password/token 값은 삽입하지 않음. unknown/missing variable, plain-text 안전성, save/restore audit. |
| `/admin/advertisement` | home_ads | 홈 광고·캠페인·carousel·쿠폰 연결을 생성·수정·종료 | 노출 기간/대상/이미지 validation, public preview, expired state. `/admin/promotions`는 이 route로 redirect. |
| `/admin/event` | events | 이벤트 상태·기간·참여/보상 요약을 보고 상세로 이동 | 진행/예정/종료 filter, empty/error, public 상태와 일치. |
| `/admin/event/[slug]` | events + 민감 참여 데이터 최소 권한 | 현재 필요한 보상·종료 처리를 하고 export | 참여 없음/다건/filter/pagination/reward pending/completed. 모바일은 카드 또는 명시적 내부 table scroll. 서버가 중복 보상을 차단. |

## 7. 반복 화면 패턴

### 목록·검색·pagination

1. `PageHeader` 다음에 `FilterBar`를 둔다. 검색, 상태, 캠퍼스, 기수처럼 가장 자주 쓰는 3~4개를 기본으로 두고 나머지는 `AdvancedFilterDisclosure`로 접는다.
2. 목록 행은 식별자, 상태 badge, 핵심 메타 1~2개, 상세 이동 하나를 우선 노출한다. 행 안에 저장·삭제·승인 등 모든 작업을 늘어놓지 않는다.
3. search draft는 입력 중 보존하고 Enter 또는 명시 버튼에서만 URL을 갱신한다. debounce가 필요하면 화면에 반영 시점과 pending을 예측 가능하게 유지한다.
4. 결과가 없으면 현재 filter 요약과 `필터 초기화` 또는 해당 role에서 가능한 생성 CTA를 제공한다. 권한 부족을 빈 결과처럼 보이지 않게 한다.
5. 넓은 table이 필요한 로그·이벤트·이력은 mobile card 전환을 우선 검토한다. table 유지가 필수면 page 전체가 아닌 data panel 내부에서만 수평 scroll되고 열 이름·행 식별자가 유지돼야 한다.

### 큐·승인·검토

1. queue는 `대기 건수 → 선택된 항목의 안전한 요약 → 판단 근거 → 하나의 승인/반려 action → 이력` 순서다.
2. 승인·반려는 서로 다른 primary action이며, 선택되지 않은 행동은 보조 또는 confirmation 단계에 둔다.
3. 비교가 필요한 제휴처 변경 요청은 현재 값과 요청 값을 동일한 field order, 변경 강조, 민감 값 마스킹으로 표시한다.
4. private file/photo는 링크 URL을 노출하지 않는 viewer action으로만 연다. loading/failure는 이미지 주소 대신 안전한 안내를 표시한다.
5. 결정 직전 최신 상태를 서버에서 재검증한다. 이미 처리됐거나 scope가 달라졌으면 기존 화면을 유지하고 재검토 행동을 제공한다.

### 편집·생성 workspace

1. `FormSection` 단위로 정보, 혜택, 대상/지점, 미디어, 검토를 나눈다. 페이지 어디서나 primary submit은 하나다.
2. 모바일은 section stack과 하단 sticky submit 하나를 쓴다. 데스크톱은 main form과 영향/미리보기/이력 보조 panel을 병렬로 둘 수 있다.
3. client validation은 빠른 피드백용이고 서버 validation이 신뢰 경계다. 두 결과의 code와 message mapping을 공유한다.
4. 파일 업로드는 선택, crop/validation, upload pending, complete, remove, retry 상태를 분리한다. `uploadId`만 submission에 보내고 local blob URL과 private path를 저장하지 않는다.

## 8. 접근성·반응형·한국어

- 기본 검증 viewport는 360px, 820px, 1366px다. filter, dense table, modal, sticky action, 긴 한국어 제목은 320px과 390px도 추가 확인한다.
- 자연어 한국어는 `word-break: keep-all`을 우선하고, 이메일·URL·UUID·계좌·긴 식별자만 bounded container의 `overflow-wrap: anywhere`를 사용한다. shrink 가능한 flex/grid child에는 `min-w-0`을 둔다.
- 모든 control은 label/accessible name, visible keyboard focus, 44px 이상 touch target, keyboard completion을 제공한다. dialog는 focus trap·Escape·복귀 focus를 지원한다.
- `loading`, `error`, `success`, filter result count, async pending은 screen reader가 이해할 수 있는 문구를 갖는다. 색만으로 승인·경고·삭제·선택을 구분하지 않는다.
- 모션은 섹션 reveal, tab layout transition, overlay 진입처럼 정보 구조를 보일 때만 사용한다. `prefers-reduced-motion`에서는 이동과 duration을 줄이거나 제거한다.

## 9. Storybook·QA·관측성

### Storybook 상태

- route 수준 변경은 `src/lib/mock/scenarios/registry.ts`, `route-inventory.ts`, `required-states.ts`, `storybook-coverage.ts`를 함께 점검한다.
- 기본적으로 `default`, `empty`, `many`, `longKorean`, `loading`, `error`, `unauthorized`를 고려한다. 권한 기반 화면은 `forbidden` 또는 regional scope state도 추가한다.
- Storybook story는 live Supabase, 실회원, 실제 문서/사진, token에 의존하지 않는다. deterministic synthetic fixture와 stable story id를 사용한다.

### 브라우저 QA

- 동적 화면은 hydration, network, font loading이 안정된 뒤 DOM과 screenshot을 검사한다.
- changed route에서 valid/invalid submission, query restoration, keyboard navigation, pending/rollback, safe error, permission redirect를 확인한다.
- QA screenshot은 `.tmp/ui-qa/`에 보관하고 버전 관리하지 않는다. reusable design candidate만 Storybook으로 승격한다.

### Audit·analytics

- 데이터 열람, export, 승인/반려, 공개 상태, 권한·계정·플랜·기수 변경, 발송, template 복원은 actor·대상·safe outcome·before/after 정책에 따라 audit한다.
- 사용자에게 보이는 분석 event는 화면 목적과 성공 행동만 기록한다. 이메일, 사진 URL, token, raw error를 event property에 넣지 않는다.

## 10. 외부 Agent 작업 계약

1. 시작 전 해당 route의 page, server action, repository/service, `screen-specs`, Storybook scenario, 공용 UI를 읽는다.
2. 새 비주얼은 토큰과 공용 primitive를 우선 사용하고, 공용화 가능한 반복이 둘 이상일 때만 `src/components/ui/` 확장을 제안한다.
3. raw Supabase query를 page/client component에 추가하지 않는다. UI는 service/repository domain model을 사용한다.
4. 입력·권한·scope·state transition은 server boundary에서 다시 검증한다. 예상 실패는 safe code로 복구하고 invariant만 throw한다.
5. canonical route, query 보존, server redirect, push/replace/refresh 선택을 변경하면 route inventory와 focused test를 같이 수정한다.
6. 구현 PR에는 변경 route, 권한, 상태, screenshot(360/820/1366), Storybook coverage, focused verification, 남은 risk를 적는다.

## 11. 공통 수용 기준

- 첫 viewport에서 현재 화면의 목표, 처리 우선순위, primary action을 알 수 있다.
- page당 의미상 h1과 primary CTA는 하나이며, shell navigation과 페이지 제목이 중복되지 않는다.
- read 권한이 없는 navigation, row action, count, 민감 metadata가 렌더되지 않는다. 서버도 같은 request를 거부한다.
- 목록 query는 새로고침, 공유, 뒤로가기를 거쳐도 유지되고 상세에서 안전하게 복귀한다.
- validation은 field-level message와 first-error focus, pending은 item/action-scoped feedback, domain failure는 recovery action을 제공한다.
- 360/820/1366px에서 document overflow가 없고, 긴 한국어·식별자·sticky action이 중요한 상태/버튼을 밀어내지 않는다.
- Storybook의 핵심 상태와 브라우저 QA가 실제 View·권한·데이터 경계를 검증하며 PII를 포함하지 않는다.
