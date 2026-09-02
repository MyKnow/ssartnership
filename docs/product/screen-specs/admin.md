---
title: 관리자 화면 계약
type: product-contract
status: current
authority: normative
---

# 관리자 화면 계약

작성 기준일: 2026-07-10

관리자 shell은 현재 위치와 역할 내비게이션만 담당한다. 페이지는 shell 제목을 반복하지 않고 하나의 `PageHeader`와 하나의 primary CTA를 가진다. `/admin/notifications`는 `내 알림`, `/admin/push`는 `발송 관리`로 구분한다.

<!-- screen-contract: admin.dashboard -->
## `/admin` — 운영 홈

- 목표·위계: 처리 필요 큐 → 빠른 작업 → 운영 요약 → 최근 변경 순이다.
- 액션·흐름: primary는 최우선 대기 과업 열기이며 보조는 회원·제휴처·이벤트 바로가기다. 로그인/내비게이션에서 진입한다.
- 경계·상태: 관리자 permission과 campus scope가 허용한 집계만 표시한다. 제휴 접수·변경·플랜, 수료생 인증, 가입 승인, 프로필 사진, 내 알림 중 권한 내 대기 업무만 다음 작업 후보로 표시한다. 기본, 처리 항목 없음, 부분 실패, 로딩, 권한 제한을 제공한다.
- 반응형·분석: 모바일은 우선 큐와 2열 이하 shortcut, 데스크톱은 dense grid를 쓴다. `admin_dashboard_view`, queue open을 기록한다.
- 수용 기준: shell/page 제목 중복이 없고 권한 없는 수치·링크를 렌더하지 않으며 핵심 작업이 첫 viewport에 있다.

<!-- screen-contract: admin.task-inbox -->
## `/admin/tasks` — 작업함

- 목표·위계: 가장 자주 처리하는 검토·승인·운영 작업 → 각 작업의 안전한 상세 화면 순이다.
- 액션·흐름: primary는 권한 내 작업을 여는 것이며, 각 큐에서 근거 확인·결정·복귀를 완료한다. 작업함은 도메인 상태를 직접 변경하지 않는다.
- 경계·상태: 권한 필터된 task navigation만 노출한다. 기본, 빈 작업함, 권한 없음, 긴 한국어, 모바일 overflow 상태를 제공한다.
- 반응형·분석: 모바일부터 한 열의 44px 이상 작업 target을 제공하고, 태블릿·데스크톱에서는 2열까지 확장한다. 관리 route의 Core Web Vitals는 PII·query 없이 기록한다.
- 수용 기준: 권한 밖 작업은 렌더되지 않고, 각 작업은 기존 canonical href와 서버 권한 검사를 유지한다.

<!-- screen-contract: admin.accounts -->
## `/admin/admins` — 관리자 계정·권한

- 목표·위계: 검색/상태 → 관리자 목록 → 권한·캠퍼스 scope → 초대/변경 이력 순이다.
- 액션·흐름: primary는 관리자 초대 또는 선택 계정 저장, 보조는 필터·비활성화다.
- 경계·상태: admins resource permission과 permissionVersion을 검증한다. 기본, 빈 상태, 초대 중, validation error, 충돌, 권한 없음 상태를 제공한다. 액션은 URL에 안전한 상태 코드만 남기고, DB·권한 내부 오류 원문은 화면에 표시하지 않는다.
- 반응형·분석: 모바일 compact row와 상세 disclosure, 데스크톱 table/detail을 쓴다. 계정 생성·권한 변경을 audit log로 남긴다.
- 수용 기준: 자기 권한 상승과 마지막 최고 관리자 제거를 방지하고 민감 setup token을 목록·로그에 노출하지 않는다.

<!-- screen-contract: admin.search -->
## `/admin/search` — 통합 대상 검색

- 목표·위계: 검색어 입력 → 권한·캠퍼스 범위 결과 → 해당 회원·제휴처 상세 이동 → 검색 결과 복귀 순이다.
- 액션·흐름: 관리자 빠른 탐색 또는 직접 URL에서 2자 이상 검색어를 제출한다. 결과는 이름·관리 ID를 가진 회원과 제휴처 이름으로 나누어 보여 주며, 상세 링크는 현재 검색 URL을 `returnTo`로 보존한다.
- 경계·상태: `members.read`와 `brands.read`를 각각 확인한다. 검색어는 공백 정규화 후 2~80자로 제한하고, 제휴처는 기존 관리 campus scope를 적용한다. 최소 projection·항목별 8개 제한을 사용하며 내부 오류 원문을 화면에 노출하지 않는다. 초기, 로딩, 짧은 검색어, 빈 결과, 일부 소스 오류, 권한 제한 상태를 제공한다.
- 반응형·분석: 결과 행과 제출 control은 44px 이상의 터치 목표를 유지한다. 긴 한글 이름·주소·캠퍼스 표기는 줄바꿈하고, 모바일부터 한 열 결과를 사용한다. 제품 성능 지표는 PII나 검색어 원문을 수집하지 않는다.
- 수용 기준: 권한 밖 대상은 검색하거나 노출하지 않고, 결과와 상세 모두 기존 서버 권한 검사를 유지한다. 검색 결과에서 상세를 열고 돌아오면 동일한 검색 조건으로 복귀한다.

<!-- screen-contract: admin.advertisement -->
## `/admin/advertisement` — 광고·프로모션 관리

- 목표·위계: 현재 노출/만료 임박 → 상품·캠페인 → 홈 슬라이드 → 쿠폰 연결 순이다.
- 액션·흐름: primary는 새 캠페인/노출 생성, 보조는 편집·종료·미리보기다. `/admin/promotions` 구 URL도 이 화면으로 온다.
- 경계·상태: ads permission과 repository domain model을 사용한다. 기본, 빈 상태, 만료, 이미지 오류, validation error, 저장 중을 제공한다.
- 반응형·분석: 모바일은 목록/편집 분리, 데스크톱은 dense workspace를 쓴다. 생성·변경·종료를 audit하고 public click/view는 product event로 기록한다.
- 수용 기준: 기간·대상·이미지 검증이 FE/BE에서 일치하고 종료된 노출은 public surface에서 제거된다.

<!-- screen-contract: admin.companies -->
## `/admin/companies` — 파트너사·계정·과금

- 목표·위계: 처리 필요 플랜/결제 → 파트너사 목록 → 계정 → 플랜·증빙 이력 순이다.
- 액션·흐름: primary는 파트너사 생성 또는 선택 항목 처리, 보조는 계정 setup·플랜 검토다.
- 경계·상태: companies/billing permission과 campus scope를 적용한다. 기본, 빈 상태, 결제 대기/미납, setup token, validation error, 부분 실패를 제공한다.
- 반응형·분석: 모바일은 entity row와 상세 panel, 데스크톱은 목록/작업 영역을 병렬 배치한다. 모든 계정·플랜 변경을 audit한다.
- 수용 기준: 회사와 제휴처 용어가 구분되고 token은 한 번만 안전하게 제시하며 권한 밖 campus 회사가 보이지 않는다.

<!-- screen-contract: admin.cycle -->
## `/admin/cycle` — 기수 운영

- 목표·위계: 현재 기수 → 전환 설정 → 카드 테마 → 영향 범위 순이다.
- 액션·흐름: primary는 기수 설정 저장, 보조는 합성 카드 미리보기다. `/admin/members/mock`은 preview anchor로 이동한다.
- 경계·상태: cycle permission과 허용된 year/campus 규칙을 사용한다. 기본, validation error, 저장 중, 성공, 충돌을 제공한다.
- 반응형·분석: 모바일은 설정과 미리보기를 순차 배치한다. 변경은 audit log에 before/after로 남긴다.
- 수용 기준: 활성 기수 전환의 회원·인증 영향이 저장 전 표시되고 mock-only route가 제품 메뉴에 노출되지 않는다.

<!-- screen-contract: admin.event-list -->
## `/admin/event` — 이벤트 목록

- 목표·위계: 상태 필터 → 진행/예정/종료 이벤트 → 참여·보상 요약 순이다.
- 액션·흐름: primary는 이벤트 생성/등록, 보조는 상세 열기와 상태 필터다.
- 경계·상태: events permission과 repository/service 결과를 사용한다. 기본, 빈 상태, filter, loading, error, 종료 상태를 제공한다.
- 반응형·분석: 모바일 compact row, 데스크톱 table/card 혼합을 쓴다. 생성·상태 변경을 audit한다.
- 수용 기준: 이벤트 상태·기간이 public 표시와 일치하고 목록에서 상세 작업을 중복 제공하지 않는다.

<!-- screen-contract: admin.event-detail -->
## `/admin/event/[slug]` — 이벤트 상세 운영

- 목표·위계: 이벤트 상태/처리 필요 → 참여·보상 집계 → 대상 목록 → 설정·이력 순이다.
- 액션·흐름: primary는 현재 필요한 보상/종료 처리, 보조는 export와 목록 복귀다.
- 경계·상태: events permission과 민감 참여 데이터의 최소 필드를 사용한다. 기본, 참여 없음, 다건, filter, pagination, 보상 대기/완료, 오류를 제공한다.
- 반응형·분석: 넓은 table은 모바일에서 행 카드 또는 명시적 내부 스크롤을 쓴다. 처리·export를 audit한다.
- 수용 기준: 개인정보는 필요한 권한에서만 보이고 중복 보상·재처리를 서버에서 막는다.

<!-- screen-contract: admin.logs -->
## `/admin/logs` — 운영 로그 탐색

- 목표·위계: preset/검색 → 필터 → 결과 → 상세/export 순이다.
- 액션·흐름: primary는 로그 조회, 보조는 필터 변경·내보내기다.
- 경계·상태: logs read/export 권한과 page cursor를 사용한다. 기본, 빈 결과, 다건, filter, pagination, 부분 소스 실패, export 중을 제공한다.
- 반응형·분석: 모바일은 filter disclosure와 compact log row, 데스크톱은 dense explorer를 쓴다. 조회 조건과 export 자체를 audit한다.
- 수용 기준: 기본 기간이 제한되고 민감 payload가 redaction되며 느린 pagination에서도 기존 결과와 focus를 보존한다.

<!-- screen-contract: admin.members -->
## `/admin/members` — 회원 탐색

- 목표·위계: 검색·상태·캠퍼스·기수 4개 기본 필터 → 20개 목록 → 고급 필터 → 상세 이동 순이다.
- 액션·흐름: primary는 회원 상세 열기, 보조는 검색·고급 필터·CSV 작업이다. 목록에서 편집 업무를 과도하게 중복하지 않는다.
- 경계·상태: members permission과 regional campus scope를 적용한다. 기본, 빈 결과, 다건, filter, pagination, loading, 부분 오류를 제공한다.
- 반응형·분석: 모바일 compact row와 filter disclosure, 데스크톱 dense list를 쓴다. 조회·export·변경을 audit한다.
- 수용 기준: 기본 page size가 20이고 11개 보조 조건은 고급 필터 안에 있으며 URL 필터와 결과가 일치한다.

<!-- screen-contract: admin.profile-photos -->
## `/admin/profile-photos` — 프로필 사진 검토

- 목표·위계: 사진 변경 대기 → 제출 사진·적합성 판단 → 승인/반려 → 기존 승인 사진 점검 순이다. 수료생 신청의 수료증·교육기간 검토와는 별도 화면에서 운영한다.
- 액션·흐름: 사진 변경 요청의 primary는 승인 또는 반려이며, 기존 사진은 반려 후 사진 재제출을 요구한다. 반려된 회원과 사진 검토 중인 회원은 `/certification/photo`로 이동해 인증 카드·QR을 사용할 수 없다.
- 경계·상태: `profile_images.read/update` 권한을 요구하며, 이미지와 원본 storage path는 관리자 인증 API로만 제공한다. 기본, 빈 큐, 사진 변경 대기, 반려, 승인, 권한 없음 상태를 제공한다.
- 반응형·분석: 모바일은 사진·이름·사유 입력·액션을 한 열로 배치하고, 데스크톱은 변경 요청과 기존 사진 점검을 다열로 표시한다. 사진 열람·승인·반려를 개인정보 원문 없이 audit한다.
- 수용 기준: 모든 회원이 사진 교체를 요청할 수 있고, pending/rejected 상태에서는 인증 카드와 유효 QR 이미지가 노출되지 않는다. 기존 MM 사진 반려도 동일한 재제출 흐름을 사용한다.

<!-- screen-contract: admin.member-signup-requests -->
## `/admin/member-signup-requests` — Mattermost 가입 승인 큐

- 목표·위계: 승인 대기 건수 → 신청한 Mattermost 식별자·표시명·기수 → 파싱 제외 사유 → 상세 검토 순이다.
- 액션·흐름: primary는 승인 대기 신청 상세 열기이며, 목록에서는 회원 비밀번호·해시·토큰을 표시하거나 수정하지 않는다.
- 경계·상태: `member_signup_requests.read` 권한과 Super Admin 이중 게이트를 적용한다. 기본, 빈 큐, 승인 대기, 권한 없음, 일부 조회 실패 상태를 제공한다.
- 반응형·분석: 모바일은 신청 카드와 상세 이동을 한 열로, 데스크톱은 식별자·신청 기수·사유를 dense list로 표시한다. 목록 조회와 상세 열기를 감사 로그에 남긴다.
- 수용 기준: 승인 요청의 안전한 메타데이터만 노출되고 저장된 비밀번호 material은 서버 내부에서도 목록·응답·로그로 반환되지 않는다. 잘못된 요청 ID는 예외 화면 대신 안전한 목록 오류 상태로 복구한다.

<!-- screen-contract: admin.member-signup-request-detail -->
## `/admin/member-signup-requests/[requestId]` — Mattermost 가입 승인 상세

- 목표·위계: Mattermost 식별자와 파싱 사유 → 운영자가 보완할 이름·기수·캠퍼스 → 승인/반려 액션 순이다.
- 액션·흐름: Super Admin이 이름·기수·캠퍼스를 입력한 뒤 승인하거나, 명확한 사유를 남겨 반려한다. 이미 처리된 요청은 재처리하지 않는다.
- 경계·상태: service-role 전용 승인/반려 RPC와 pending 상태 잠금을 사용한다. 기본, 처리 중, 승인 완료, 반려 완료, 충돌, 권한 없음 상태를 제공한다.
- 반응형·분석: 모바일은 입력과 액션을 세로로 배치하고, 데스크톱은 읽기 전용 Mattermost 정보와 보완 입력을 분리한다. 승인·반려 actor와 결과를 감사 로그에 남긴다.
- 수용 기준: 승인 시 새 회원 레코드와 필수 약관 동의가 원자적으로 생성되고, 반려·승인 후 비밀번호 hash/salt가 즉시 제거되며 요청은 재사용할 수 없다.

<!-- screen-contract: admin.member-detail -->
## `/admin/members/[memberId]` — 회원 상세

- 목표·위계: 신원/상태 → 인증·동의 → 운영 액션 → 보안·변경 이력 순이다.
- 액션·흐름: primary는 현재 허용된 상태 변경 저장이며 보조는 목록 복귀·로그 확인이다. 목록 query를 return context로 보존한다.
- 경계·상태: members/security permission과 campus scope를 모두 검증한다. 기본, not-found, 권한 없음, 저장 중, 충돌, 보안 로그 없음 상태를 제공한다.
- 반응형·분석: 모바일 section stack, 데스크톱 summary/detail을 쓴다. 모든 상태 변경을 actor와 before/after로 audit한다.
- 수용 기준: 비밀번호 material을 절대 표시하지 않고 위험 액션은 확인·재권한·명확한 결과를 제공한다.

<!-- screen-contract: admin.notifications -->
## `/admin/notifications` — 내 알림

- 목표·위계: 중요·미확인 → 최신 알림 → 읽은 알림 → 내 수신 설정 순이다.
- 액션·흐름: primary는 알림 목적지 열기, 보조는 읽음 처리·설정 저장이다. 관리자 shell에서 진입한다.
- 경계·상태: 현재 admin audience 알림만 조회한다. 기본, 빈 상태, 다건, filter, pagination, 읽음 처리 중, 일부 실패를 제공한다.
- 반응형·분석: 모바일 compact row, 데스크톱 목록/설정 분할을 쓴다. open/read/settings를 기록한다.
- 수용 기준: 제목이 `내 알림`이며 발송 composer를 포함하지 않고 내부 허용 목적지만 연다.

<!-- screen-contract: admin.notification-templates -->
## `/admin/notification-templates` — 알림 템플릿 관리

- 목표·위계: 채널·기능 그룹 → 기본/수정 상태 → 제목·내용 템플릿 → 허용 변수 → 저장/기본값 복원 순이다.
- 액션·흐름: Super Admin만 이메일·Mattermost·푸시·인앱 자동 알림의 템플릿을 수정하거나 기본값으로 복원할 수 있다. 변수는 `{변수이름}` 형태로 삽입한다.
- 경계·상태: `notification_templates` 권한과 Super Admin 이중 게이트를 적용한다. DB에는 수정본만 저장하고, 템플릿이 없거나 잘못되면 코드 기본값으로 안전하게 대체한다. validation·저장·복원·테스트 발송 실패는 안전한 상태 코드로 복구하며 raw 오류를 URL이나 UI에 전달하지 않는다.
- 반응형·분석: 모바일은 템플릿 카드를 한 열로 표시하고 변수 삽입 컨트롤을 줄바꿈한다. 데스크톱은 그룹과 제목·내용 입력을 넓게 보여준다. 템플릿 저장·복원을 감사 로그에 남기며 실제 본문·토큰은 기록하지 않는다.
- 수용 기준: 알 수 없는 변수와 필수 변수 누락을 서버에서 거부하고, 일반 텍스트만 허용해 HTML 주입을 막는다. 사용자 비밀번호·인증 코드·토큰 같은 실제 값은 저장하거나 미리 채우지 않는다.

<!-- screen-contract: admin.partner-registrations -->
## `/admin/partner-registrations` — 신규 제휴 접수

- 목표·위계: 검색·정렬·필터 → 신청 요약 → 한 건 아코디언 상세/수정 → 공개 상태와 처리 상태 저장 순이다.
- 액션·흐름: 관리자는 공개/대외비/비공개를 선택하고 처리 상태를 등록 완료로 저장한다. 단일 제휴처가 생성되면 `/admin/partners/{id}`로 이동하고, 여러 혜택 그룹으로 여러 제휴처가 생성되면 안전한 목록 결과로 돌아간다.
- 경계·상태: registrations permission과 campus scope를 적용한다. 검색어·상태·접수 경로·공개 상태·정렬은 URL과 서버 페이지 조회의 단일 기준이다. 대기, 빈 상태, 승인 중, 반려 사유 오류, 파일 오류, 변환 실패, 완료를 제공한다.
- 반응형·분석: 모바일은 한 건씩 펼치는 queue/detail 아코디언, 데스크톱은 요약과 상세가 이어지는 dense queue를 쓴다. 열람·공개 상태 변경·처리 상태 저장·상세 이동을 audit한다.
- 수용 기준: 승인 전 필수 회사·제휴처·지점 데이터를 검증하고 중복 처리와 권한 밖 신청 접근을 막는다. 공개 상태 선택값은 등록 요청에 보존하고 제휴처 변환에 전달한다.

<!-- screen-contract: admin.partners -->
## `/admin/partners` — 제휴처 목록

- 목표·위계: 검색/핵심 필터 → 서버가 필터한 제휴처 목록 → 상태 요약 → 생성/상세 이동 순이다.
- 액션·흐름: primary는 제휴처 추가, 각 행의 보조 액션은 상세 열기다. 변경 요청·카테고리 작업은 전용 화면으로 이동한다.
- 응답성 경계: 목록 첫 응답은 찾기·상태 확인·상세 이동에 필요한 데이터만 기다리며, 즐겨찾기·조회·CTA·리뷰 집계 같은 보조 운영 지표는 상세 화면에서 필요할 때 확인한다.
- 경계·상태: brands permission과 campus scope를 적용한다. `q`(제휴처명), `category`, `visibility`, `sort`, `page`, `pageSize`가 목록 URL의 단일 기준이며, page size는 12·24·48 중 하나다. filter가 바뀌면 page를 1로 되돌린다. 기본, 빈 결과, 다건, filter, pagination, loading, 오류를 제공한다.
- 반응형·분석: 모바일 compact entity row, 데스크톱 dense list를 쓴다. 조회·상세 이동·생성을 기록한다.
- 수용 기준: 서버가 현재 page만 조회하고, 범위를 벗어난 page는 현재 filter를 보존한 canonical URL로 정규화한다. 오류는 내부 DB 오류를 노출하지 않고 같은 filter에서 재시도할 수 있어야 한다. `tab=requests|categories|category` 구 query는 전용 canonical route로 이동하고 목록 화면에 해당 편집 UI를 중복 렌더하지 않는다. `tab=plans`는 플랜 기능 보존용 conditional legacy 상태로만 유지한다.

<!-- screen-contract: admin.partner-editor -->
## `/admin/partners/[partnerId]` — 제휴처 편집

- 목표·위계: 기본 정보 수정 → 공개/검토 상태·핵심 요약 → 운영 지표·혜택 이력·쿠폰 → 리뷰·감사 이력 순이다. 헤더의 `기본 정보 수정`은 같은 화면의 편집 영역으로 이동한다.
- 액션·흐름: primary는 저장, 보조는 기본 정보 수정으로 바로 이동, 미디어 편집·리뷰 조치·목록 복귀다.
- 경계·상태: brands permission과 campus scope, 공용 FE/BE validation을 적용한다. 기본, not-found, validation error, 이미지 오류, 저장 중, 충돌을 제공한다. 발급 또는 사용 이력이 있는 쿠폰은 삭제하지 않고 수정에서 상태 종료를 안내하며, 동시성으로 삭제가 거부돼도 안전한 안내로 같은 상세 화면에 복귀한다.
- 반응형·분석: 모바일 section stack과 sticky save 1개, 데스크톱 edit workspace를 쓴다. 변경을 field-level before/after로 audit한다.
- 수용 기준: `파트너사/제휴처/지점/혜택` 용어를 구분하고 민감 링크·visibility 규칙을 server boundary에서 재검증한다.

<!-- screen-contract: admin.partner-new -->
## `/admin/partners/new` — 제휴처 생성

- 목표·위계: 파트너사 연결 → 제휴처 기본 정보 → 혜택·대상·지점 → 미디어 → 검토·생성 순이다.
- 액션·흐름: primary는 생성, 보조는 템플릿 import와 목록 취소다.
- 경계·상태: brands create permission, campus scope, 공용 validation을 적용한다. 기본, validation error, 파일/이미지 오류, 제출 중, 생성 성공, 중복을 제공한다.
- 반응형·분석: 모바일 단계형 또는 section stack, 데스크톱 summary를 쓴다. 생성 결과와 source를 audit한다.
- 수용 기준: 첫 오류 focus, 입력 보존, 중복 후보 경고, 생성 후 canonical 상세 이동이 동작한다.

<!-- screen-contract: admin.push -->
## `/admin/push` — 발송 관리

- 목표·위계: 채널 상태 → 대상/내용 작성 → 미리보기·수신 인원 → 발송 → 결과 로그 순이다.
- 액션·흐름: primary는 검토 후 발송이며 보조는 로그·자동 규칙 확인이다. 관리자 내비게이션에서 진입한다.
- 경계·상태: notifications send permission, audience validation, 채널 구성 상태를 적용한다. 기본, 설정 누락, validation error, preview 실패, 발송 중, 부분 실패, 성공을 제공한다.
- 반응형·분석: 모바일 단계 stack, 데스크톱 composer/log workspace를 쓴다. preview·발송·삭제를 audit한다.
- 수용 기준: 제목이 `발송 관리`이고 실제 발송 전 대상 수를 확인하며 중복 submit과 권한 밖 audience를 차단한다.

<!-- screen-contract: admin.reviews -->
## `/admin/reviews` — 리뷰 관리

- 목표·위계: 검색/상태 필터 → 신고·검토 우선 목록 → 이미지/본문 → 조치 이력 순이다.
- 액션·흐름: primary는 선택 리뷰의 공개 상태 조정, 보조는 filter·이미지 보기다.
- 경계·상태: reviews permission과 campus scope를 적용한다. 기본, 빈 결과, 다건, filter, pagination, 이미지 오류, 조치 실패를 제공한다.
- 반응형·분석: 모바일 compact review card, 데스크톱 dense list/detail을 쓴다. 숨김·복구·삭제를 audit한다.
- 수용 기준: hidden/deleted 의미와 actor를 보존하고 이미지 URL·회원 정보 노출을 최소화한다.

<!-- screen-contract: admin.partner-requests -->
## `/admin/partner-requests` — 제휴처 변경 요청

- 목표·위계: 오래 대기한 승인 요청 → 제휴처/파트너사 요약 → field diff → 증빙 → 승인·반려 이력 순이다.
- 액션·흐름: primary는 승인 또는 반려 중 현재 선택한 하나이며 보조는 filter·제휴처 상세 열기다.
- 경계·상태: brands update permission과 campus scope를 적용한다. `page`, `pageSize`가 queue URL의 단일 기준이며 page size는 6·12·24 중 하나다. 대기 요청은 생성 시각 오름차순으로 서버에서 page 단위 조회한다. 지역 관리자에게 배정된 제휴처가 없으면 전역 queue로 넓히지 않고 빈 결과를 준다. 대기, 빈 상태, diff 없음, 파일 오류, 처리 중, 충돌, 완료를 제공한다.
- 반응형·분석: 모바일 queue/detail 전환, 데스크톱 split diff workspace를 쓴다. 열람·승인·반려를 audit한다.
- 수용 기준: 저장 직전 최신 원본과 diff를 재검증하고 중복 처리·권한 밖 요청을 차단한다. 항목 처리 뒤에는 현재 queue page를 `returnTo`로 보존하고, queue 조회 오류는 내부 오류를 노출하지 않은 채 재시도 행동을 제공한다. `/admin/partners?tab=requests`를 이곳으로 보낸다.

<!-- screen-contract: admin.categories -->
## `/admin/categories` — 제휴처 카테고리

- 목표·위계: 사용 중 카테고리 → 연결 제휴처 수 → 생성/이름 변경/순서 → 삭제 영향 순이다.
- 액션·흐름: primary는 카테고리 추가 또는 선택 항목 저장이다. 삭제는 FK `RESTRICT` 또는 원자적 참조 검사 migration 전까지 잠근다.
- 경계·상태: global category 관리 권한을 요구한다. 기본, 빈 상태, validation error, 중복, 사용 중 삭제 제한, 저장 중을 제공한다.
- 반응형·분석: 모바일 compact row와 edit drawer, 데스크톱 list/detail을 쓴다. 생성·변경·삭제를 audit한다.
- 수용 기준: 지역 관리자에게 전역 변경 UI를 숨기고 연결 제휴처 수를 표시한다. 현재 UI와 server action 모두 삭제를 거부하며, 후속 migration에서 FK 보호와 대체 카테고리 절차를 갖추기 전에는 빈 카테고리도 삭제하지 않는다. `/admin/partners?tab=categories`는 이곳으로 보낸다.
