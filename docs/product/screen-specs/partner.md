# 파트너 포털 화면 계약

작성 기준일: 2026-07-10

파트너 모바일 1차 내비게이션은 `홈 · 제휴처 · 알림 · 더보기`다. 더보기에는 플랜, 계정, 지원, 로그아웃을 둔다. 데스크톱은 같은 목적지를 sidebar에 펼치며 회사명과 담당자 정보는 shell에서 한 번만 표시한다.

<!-- screen-contract: partner.login -->
## `/partner/login` — 파트너 로그인

- 목표·위계: 계정 로그인 → 재설정/초기 설정 문의 순이다.
- 액션·흐름: primary는 로그인, 보조는 비밀번호 재설정이다. 포털 보호 화면에서 진입하고 회사 선택·대시보드·필수 비밀번호 변경으로 이탈한다.
- 경계·상태: partner session과 공용 FE/BE 검증, rate limit을 사용한다. 기본, validation error, 인증 실패, 제출 중, 이미 로그인 상태를 제공한다.
- 반응형·분석: 단일 form column을 유지한다. `partner_login_attempt/result`만 기록하고 로그인 식별자·비밀번호는 로그에서 제외한다.
- 수용 기준: 회사 scope를 세션에서 다시 확인하고 실패 후 입력 보존, 첫 오류 focus, 중복 제출 차단이 동작한다.

<!-- screen-contract: partner.reset -->
## `/partner/reset` — 파트너 비밀번호 재설정

- 목표·위계: 계정 식별 → 재설정 요청 → 전달·복구 안내 순이다.
- 액션·흐름: primary는 재설정 요청, 보조는 로그인 복귀다. 로그인에서 진입하고 받은 setup/reset token 흐름으로 이탈한다.
- 경계·상태: partner account 존재 여부를 숨기고 token은 서버에서만 생성·검증한다. 기본, validation error, 요청 중, 성공, rate limit, 서버 오류를 제공한다.
- 반응형·분석: 모바일 한 열과 짧은 보안 안내를 쓴다. `partner_reset_request`의 성공 여부만 기록한다.
- 수용 기준: 계정 열거가 불가능하고 같은 사용자에게 과도한 요청을 제한하며 성공·실패 모두 안전한 문구를 사용한다.

<!-- screen-contract: partner.account -->
## `/partner/account` — 계정·담당자 정보

- 목표·위계: 담당자/로그인 정보 → 연결 파트너사 → 사업자 상태·증빙 정보 → 보안 작업 순이다.
- 액션·흐름: primary는 계정 정보 저장이며 보조는 비밀번호 변경과 대시보드 복귀다. 더보기에서 진입하고 `companyId` query로 복귀 맥락을 유지한다.
- 경계·상태: account scope 데이터만 API로 읽고 수정한다. 기본, 저장 중, validation error, 사업자 조회 실패, 성공, 세션 만료를 제공한다.
- 반응형·분석: 계정 정보와 비밀번호 작업을 별도 section/surface로 분리한다. `partner_account_view/update`를 비식별 결과로 기록한다.
- 수용 기준: company-scoped 구 URL은 이 화면으로 redirect되고 권한 밖 회사 ID는 무시·차단되며 FE/BE 검증이 일치한다.

<!-- screen-contract: partner.notifications -->
## `/partner/notifications` — 파트너 내 알림

- 목표·위계: 중요·미확인 알림 → 최신 알림 → 채널/종류 설정 순이다.
- 액션·흐름: primary는 알림 목적지 열기, 보조는 읽음 처리와 설정 저장이다. 하단 메뉴·push에서 진입하고 `companyId` 맥락을 목적지에 보존한다.
- 경계·상태: 로그인 계정이 접근 가능한 회사 audience만 API로 조회한다. 기본, 빈 상태, filter, 더보기, 읽음 처리 중, 일부 실패를 제공한다.
- 반응형·분석: 모바일 compact row, 넓은 화면 목록/설정 분할을 사용한다. `partner_notification_view/open/read`를 기록한다.
- 수용 기준: 회사별 구 URL은 전역 화면으로 redirect되고 알림 링크가 권한 밖 회사나 외부 URL을 열지 않는다.

<!-- screen-contract: partner.support -->
## `/partner/support` — 파트너 지원 요청

- 목표·위계: 문의 유형 → 자동 템플릿 → 복사/mailto → 관련 도움말 순이다.
- 액션·흐름: primary는 문의 템플릿 복사, 보조는 메일 열기와 대시보드 복귀다. 더보기와 오류 화면에서 진입하며 `companyId`를 템플릿·복귀 맥락으로 사용한다.
- 경계·상태: 접근 가능한 회사 요약만 템플릿에 넣는다. 기본, 회사 미선택, 긴 URL, 복사 성공/실패, mailto 미지원 상태를 제공한다.
- 반응형·분석: 모바일 버튼 세로 배치와 줄바꿈 가능한 템플릿을 사용한다. `partner_support_copy/mailto`를 기록한다.
- 수용 기준: cookie·token·내부 ID 등 민감 정보가 자동 포함되지 않고 회사별 구 URL은 전역 canonical로 이동한다.

<!-- screen-contract: partner.dashboard -->
## `/partner/companies/[companyId]` — 회사 대시보드

- 목표·위계: 처리 필요 항목 → 제휴처 목록 → 핵심 지표 → 보조 안내 순으로 평탄화한다.
- 액션·흐름: primary는 가장 우선인 승인/수정 과업, 보조는 제휴처 상세·추가다. `/partner` 선택 또는 shell에서 진입한다.
- 경계·상태: session company scope와 service가 반환한 domain model만 사용한다. 기본, 제휴처 없음, 승인 대기/반려, 지표 잠금, 부분 조회 실패, 권한 없음을 제공한다.
- 반응형·분석: 모바일은 처리 큐와 compact entity row, 데스크톱은 목록과 지표를 확장한다. `partner_dashboard_view`, 처리 CTA, service open을 기록한다.
- 수용 기준: 회사명·담당자를 page에서 중복 표시하지 않고 locked metric은 값이나 추론 가능한 placeholder를 노출하지 않는다.

<!-- screen-contract: partner.plans -->
## `/partner/companies/[companyId]/plans` — 플랜·과금 관리

- 목표·위계: 현재 플랜/만료 → 변경 가능 항목 → 결제 대기·증빙 → 이력 순이다.
- 액션·흐름: primary는 플랜 변경 요청이며 보조는 증빙 프로필 저장과 대시보드 복귀다. 더보기 또는 잠긴 지표 CTA에서 진입한다.
- 경계·상태: 해당 company scope의 plan/billing domain만 사용한다. 기본, 잠긴 지표, 결제 대기, 미납, 승인/반려, validation error, 제출 중을 제공한다.
- 반응형·분석: 모바일은 플랜 비교를 세로 배치하고 sticky CTA를 과도하게 중복하지 않는다. `partner_plan_view/upgrade_request`를 기록한다.
- 수용 기준: 금액·상태를 서버 값과 일치시키고 중복 요청을 막으며 `/partner/plans`는 선택 company의 canonical 경로로 이동한다.

<!-- screen-contract: partner.service-detail -->
## `/partner/companies/[companyId]/services/[partnerId]` — 제휴처 운영 상세

- 목표·위계: 공개/승인 상태와 처리 필요 → 제휴처 요약 → 변경 요청 → 성과·리뷰 → 이력 순이다.
- 액션·흐름: primary는 정보 변경 저장/승인 요청 중 현재 가능한 하나이며 보조는 리뷰·미디어·목록 복귀다. 대시보드 제휴처 row에서 진입한다.
- 경계·상태: company와 partner 양쪽 scope를 서버에서 확인한다. 기본, 승인 대기, 반려, 즉시 저장, 변경 요청 중, 지표 잠금, 이미지 오류, 권한 없음을 제공한다.
- 반응형·분석: 모바일은 요약과 변경 action을 먼저, 지표·이력은 disclosure로 배치한다. `partner_service_view`, `change_request_start/submit`을 기록한다.
- 수용 기준: 구 service/request URL은 이 canonical 화면으로 이동하고 수정 전후 diff, pending 중복 방지, 파일 검증이 동작한다.

<!-- screen-contract: partner.service-new -->
## `/partner/companies/[companyId]/services/new` — 새 제휴처 신청

- 목표·위계: 단계와 첫 입력 → 필수 제휴처/혜택/지점 정보 → 미디어 → 검토·제출 순이다.
- 액션·흐름: primary는 단계 진행 또는 최종 제출 하나이며 보조는 이전 단계와 회사 대시보드 복귀다.
- 경계·상태: company scope와 공용 FE/BE validation을 사용한다. 기본, validation error, 이미지 오류, 제출 중, 접수 성공, 중복 신청을 제공한다.
- 반응형·분석: 모바일 compact stepper와 단일 column, 넓은 화면 검토 summary를 사용한다. `partner_service_new_start/step/submit`을 기록한다.
- 수용 기준: 첫 오류 focus, 입력 보존, 허용 파일·링크 검증, 권한 밖 company 차단이 동작한다.

## conditional·compat 흐름

- `/partner`는 회사가 여러 개일 때만 선택 View를 렌더하고 하나면 dashboard로 이동한다.
- `/partner/setup/[token]`, `/partner/change-password`는 유효 token/session에서만 렌더한다.
- 회사별 account/notifications/support 구 URL은 `companyId` query를 보존해 전역 canonical로 이동한다.
- `/partner/plans`, `/partner/services/[partnerId]`, `/partner/services/[partnerId]/request`는 session scope로 canonical company route를 결정하며 모호하거나 권한이 없으면 `/partner`로 복구한다.
