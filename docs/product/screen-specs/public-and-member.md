# 공개·회원 화면 계약

작성 기준일: 2026-07-10

<!-- screen-contract: public.home -->
## `/` — 이벤트와 혜택 탐색 시작

- 목표·위계: 대표 이벤트 → 혜택 디렉터리의 검색 → 카테고리/고급 필터 → 결과 요약 → 제휴처 목록 순으로 읽힌다.
- 액션·흐름: primary는 대표 이벤트 참여이며 혜택 탐색은 별도 CTA를 반복하지 않고 검색 입력에서 바로 시작한다. 상세 복귀 시 `q`, `category`, `campus`, `audience`, `sort`, `view`를 보존한다.
- 경계·상태: 공개 repository와 회원의 campus/year만 사용한다. 기본, 빈 결과, 로딩, 오류, 긴 한국어, 프로모션 없음 상태를 제공한다.
- 반응형·분석: Compact `<600`은 단일 pane, Medium `600–839`는 상단 필터와 최대 2열 결과, Expanded `840–1199`는 필터 sidebar와 결과 pane, Large `1200–1599`는 sidebar와 최대 2열 비교, Extra Large `1600 이상`은 wide container 최대 폭을 유지한다. `page_view`, `home_banner_click`, `benefit_directory_start`, `directory_view_change`를 기록한다.
- 수용 기준: 검색이 카테고리보다 먼저 오고 설명 없는 compact category chip을 쓴다. 적용 필터와 결과 수를 닫힌 상태에서도 확인할 수 있어야 하며 URL이 필터의 단일 기준이다. 카드형은 혜택 최대 2개와 `+N`, 대상 요약, 위치, 상세, 즐겨찾기를 유지하고 카드 표면 클릭으로도 상세에 진입한다. 카테고리·즐겨찾기·내부 링크는 각 고유 동작을 유지한다. 리스트형은 모바일·태블릿에서 혜택/대상을 생략하고 Large 데스크톱부터 비교 정보로 노출한다. Compact 리스트는 썸네일·핵심 정보·상세 아이콘을 한 행에 유지하고 44px 조작 영역을 보존한 채 이미지·글자·간격을 축소한다.

<!-- screen-contract: public.campus-directory -->
## `/campuses/[campus]` — 캠퍼스별 혜택 탐색

- 목표·위계: 캠퍼스 이름과 결과 요약 → 검색/카테고리 → 제휴처 목록 순이다.
- 액션·흐름: primary는 제휴처 상세 열기, 보조는 다른 캠퍼스·필터 변경이다. 홈과 상세 양쪽에서 진입하고 필터가 적용된 목록으로 복귀한다.
- 경계·상태: 유효 campus slug와 공개 가능한 제휴처만 조회한다. 기본, 빈 캠퍼스, 잘못된 slug, 로딩, 오류, 긴 목록을 제공한다.
- 반응형·분석: 모바일은 한 열과 compact chip, 태블릿·데스크톱은 결과 grid를 사용한다. `campus_page_view`, `partner_card_click`을 campus와 함께 기록한다.
- 수용 기준: campus가 URL과 metadata에 일치하고 320px에서 chip·카드가 수평 overflow를 만들지 않는다.

<!-- screen-contract: public.event-detail -->
## `/events/[slug]` — 이벤트 상세·참여

- 목표·위계: 이벤트 상태/제목 → 핵심 보상과 기간 → 참여 조건 → 참여 CTA → 상세 안내 순이다.
- 액션·흐름: primary는 참여 또는 대상 과업 실행이며 보조는 혜택 탐색 복귀다. 당첨자만 winner form으로 분기한다.
- 경계·상태: 공개 이벤트와 로그인 회원의 참여·보상 상태를 조합한다. 진행 전, 진행 중, 종료, 참여 완료, 보상 대기, 오류를 제공한다.
- 반응형·분석: 모바일 CTA는 내용 뒤에 묻히지 않게 sticky 또는 근접 배치한다. `event_view`, `event_cta_click`, `event_participation_complete`를 기록한다.
- 수용 기준: 종료 이벤트에서 참여 CTA가 비활성 사유를 말하고, 동일 이벤트의 중복 참여 규칙이 UI와 서버에서 일치한다.

<!-- screen-contract: public.legal-document -->
## `/legal/[kind]` — 정책 문서 확인

- 목표·위계: 문서 종류·버전·시행일 → 본문 → 이전 버전 이동 순이다.
- 액션·흐름: primary는 문서 읽기이며 별도 전환 CTA를 만들지 않는다. 로그인·가입 동의 화면과 footer에서 진입하고 이전 화면으로 복귀한다.
- 경계·상태: 공개된 policy repository만 사용한다. 최신/지정 버전, 없는 종류, 없는 버전, 로딩·오류 상태를 제공한다.
- 반응형·분석: 본문은 좁은 읽기 폭과 안정된 heading anchor를 쓴다. `policy_view`에 kind/version을 기록한다.
- 수용 기준: URL version과 표시 버전이 같고 긴 링크·표가 320px viewport를 밀지 않는다.

<!-- screen-contract: public.partner-registration -->
## `/partner-registration` — 제휴 등록 신청

- 목표·위계: 현재 단계와 첫 입력 → 필수 항목 → 다음/제출 → XLSX·가이드 disclosure 순이다.
- 액션·흐름: primary는 단계 진행 또는 최종 제출 하나이며 보조는 이전 단계와 임시 입력 유지다. 공개 헤더·파트너 안내에서 진입하고 접수 완료 상태로 이탈한다.
- 경계·상태: FE와 server action이 같은 validation 규칙을 사용한다. web 입력/XLSX, validation error, 업로드 오류, 제출 중, 성공, 중복 제출을 제공한다.
- 반응형·분석: 모바일은 `1/5 제휴처` compact stepper, 데스크톱은 진행률과 입력을 나란히 두되 입력이 가이드보다 먼저 온다. `registration_start`, `registration_step_complete`, `registration_submit`을 기록한다.
- 수용 기준: 첫 오류에 focus되고 새로고침 전 단계 데이터가 보존되며, XLSX와 긴 설명은 기본 흐름을 가리지 않는다.

<!-- screen-contract: public.partner-detail -->
## `/partners/[id]` — 제휴 혜택 이용

- 목표·위계: 제휴처 이름과 핵심 혜택 → 이용 CTA·인증 상태 → 조건/대상 → 지점·리뷰 → 갤러리/태그 순이다.
- 액션·흐름: primary는 혜택 이용이며 보조는 즐겨찾기, 지도, 문의, 리뷰다. 목록의 전체 query를 return context로 받아 그대로 복귀한다.
- 경계·상태: visibility, 기간, benefit visibility, member eligibility를 서버에서 판정한다. 공개, 로그인 필요, 대상 아님, 만료, not-found, 이미지 오류, 리뷰 없음 상태를 제공한다.
- 반응형·분석: 모바일은 sticky action bar를 유지하면서 복사 가능한 연락처 정보도 본문에 표시하고, 넓은 화면은 혜택 이용 CTA를 핵심 혜택 카드 최하단의 full-width primary action으로 둔다. 연락처·위치·대상·조건은 `세부 정보` 그룹으로 묶는다. `partner_detail_view`, `benefit_cta_click`, 지도·문의·예약 클릭을 기록한다.
- 수용 기준: 잠긴 혜택은 민감 조건과 URL을 노출하지 않고, CTA는 한 화면에서 중복 primary로 보이지 않으며 복귀 필터가 보존된다. 공개 혜택은 번호가 있는 핵심 목록으로 먼저 읽히고 연락처·이용 기간·위치·대상은 한 단계 낮은 정보 그룹으로 둔다. 위치와 적용 대상은 화면 폭과 관계없이 각각 한 행과 독립된 surface로 분리하고 사이에 여백을 둔다. 운영진·교육생·수료생은 항상 함께 표시하되 적용 대상만 강조한다. 조건·소개·태그는 기본 닫힘 disclosure로 유지하고 닫힌 상태에서도 포함 항목을 한 줄로 요약한다. disclosure를 열면 등록된 태그를 생략 없이 모두 표시한다.

<!-- screen-contract: public.suggest -->
## `/suggest` — 제휴처 제안

- 목표·위계: 제안 목적 → 제휴처 이름/근거 → 연락·위치 보조 정보 → 제출 순이다.
- 액션·흐름: primary는 제안 제출, 보조는 홈 복귀다. 혜택 탐색의 빈 결과·footer에서 진입하고 성공 확인으로 이탈한다.
- 경계·상태: 공개 입력을 같은 FE/BE schema로 검증하고 rate limit한다. 기본, validation error, 제출 중, 성공, 서버 오류를 제공한다.
- 반응형·분석: 한 열 form과 짧은 도움말을 사용한다. `suggest_start`, `suggest_submit`만 비식별 필드로 기록한다.
- 수용 기준: 연락처 등 민감 입력은 로그에 남지 않고 첫 오류 focus와 재시도 시 입력 보존이 동작한다.

<!-- screen-contract: public.bug-report -->
## `/support/bug-report` — 문제 제보

- 목표·위계: 문제 유형 → 자동 생성 재현 템플릿 → 복사/mailto 안내 순이다.
- 액션·흐름: primary는 템플릿 복사, 보조는 메일 앱 열기와 홈 복귀다. footer·오류 화면에서 진입한다.
- 경계·상태: 브라우저 정보는 사용자가 확인할 수 있는 범위만 포함한다. 기본, 긴 URL, 복사 성공/실패, mailto 미지원 상태를 제공한다.
- 반응형·분석: 코드형 템플릿은 줄바꿈 가능하고 모바일 버튼은 세로 배치한다. `bug_report_template_copy`를 기록한다.
- 수용 기준: token·cookie·개인정보가 템플릿에 자동 포함되지 않고 320px에서 긴 URL이 overflow되지 않는다.

<!-- screen-contract: member.certification -->
## `/certification` — 내 인증

- 목표·위계: 인증 유효 상태 → 구성원 이름/기수/캠퍼스 → QR·만료 → 갱신 안내 순이다.
- 액션·흐름: primary는 QR 제시 또는 갱신이며 보조는 계정 메뉴 복귀다. 사용자 메뉴에서 진입하고 원래 `returnTo`로 복귀할 수 있다.
- 경계·상태: member session과 서버 발급 QR만 사용한다. 유효, 갱신 중, 만료, 비로그인, 정보 불일치, 발급 오류를 제공한다.
- 반응형·분석: QR은 모바일 현장 제시를 우선하고 계정 변경·탈퇴 작업과 별도 surface로 분리한다. `certification_view`, `certification_refresh`를 기록한다.
- 수용 기준: 화면 제목과 메뉴 용어가 모두 `내 인증`이고 QR token 원문을 analytics·오류 메시지에 남기지 않는다.

<!-- screen-contract: member.coupons -->
## `/coupons` — 내 쿠폰

- 목표·위계: 사용 가능 쿠폰 수 → 사용 가능 목록 → 사용/만료 조건 → 지난 쿠폰 순이다.
- 액션·흐름: primary는 쿠폰 조건 펼치기 또는 사용이며 보조는 연결 제휴처 상세 열기다. 사용자 메뉴와 상세에서 진입한다.
- 경계·상태: 로그인 회원에게 발급된 쿠폰만 repository로 조회한다. 사용 가능, 빈 상태, 만료, 사용 완료, 로딩, 오류, 비로그인을 제공한다.
- 반응형·분석: 모바일은 accordion 한 열, 넓은 화면도 이용 조건의 읽기 순서를 유지한다. `coupon_wallet_view`, `coupon_expand`, `coupon_use`를 기록한다.
- 수용 기준: 만료·사용 완료 쿠폰이 primary로 오인되지 않고 제휴처 이동 시 상세 접근 권한을 다시 검증한다.

<!-- screen-contract: member.notifications -->
## `/notifications` — 내 알림

- 목표·위계: 미확인 수 → 중요·최신 알림 → 읽은 알림 → 수신 설정 순이다.
- 액션·흐름: primary는 알림 목적지 열기, 보조는 읽음 처리와 수신 설정이다. 사용자 메뉴·push에서 진입한다.
- 경계·상태: 현재 member audience 알림만 API로 조회한다. 기본, 빈 상태, 더보기, 읽음 처리 중, 일부 실패, 비로그인을 제공한다.
- 반응형·분석: 모바일은 compact row, 데스크톱은 목록과 설정을 분리한다. `notification_inbox_view`, `notification_open`, `notification_mark_read`를 기록한다.
- 수용 기준: 알림 링크는 허용된 내부 목적지만 열고 읽음 실패 시 항목 상태를 복구하며 긴 한국어 제목이 액션을 밀지 않는다.
