---
title: 데이터 수명주기
type: security-policy
status: current
authority: normative
---

# 데이터 수명주기

## 데이터 경계

| 데이터 | 수집·접근·저장 | 삭제·복제·복구 확인 지점 |
| --- | --- | --- |
| 회원·인증 | 최소 입력, 서버 전용 비밀번호 해시·토큰 처리; 원문 로그 금지 | [익명화 계약](../../tests/member-anonymization-schema-contract.test.mts), [익명화 FK 범위](../../tests/member-anonymization-fk-coverage.test.mts), [계정 삭제](../../tests/member-account-deletion-flow.test.mts) |
| 사진·증명서·리뷰 미디어 | 소유권·타입·크기 확인 후 Storage 저장, 필요한 범위만 조회 | [파일 계약](../../tests/graduate-verification-files.test.mts), [미디어 정리](../../tests/partner-media-attachment-cleanup.test.mts) |
| 감사·제품·보안 로그 | 민감 값 제거, 역할별 조회 | [로그 정본](../architecture/event-logging.md), [보존 정책 테스트](../../tests/log-retention-policy.test.mts), [보존 확장 테스트](../../tests/log-retention-expansion.test.mts) |
| Preview 복제 | `scripts/self-host-environments/sanitize.mjs`가 비밀번호·토큰·PIN 계열 컬럼을 sentinel로 바꾸고, 검토되지 않은 비밀 후보 컬럼이 있으면 실패한다. 이메일은 마스킹하고 nullable IP·user-agent는 비운다 | [환경 복제 계약](../../tests/self-host-environments.test.mts) |
| 백업·외부 사본 | 암호화·별도 권한·복원 검증 | [백업 runbook](../operations/runbooks/self-host-operations.md), [외부 사본](../operations/runbooks/self-host-observability.md) |

## 보존·파기 결정표

2026-10-05 기본값이다. 운영 책임자가 확정하거나 바꾸기 전까지 이 표와 migration이 같은 값을 쓴다. 값을 바꾸려면 새 forward migration과 이 표를 같은 변경에서 고친다. "기본값"은 운영자 확정 전이라는 뜻이고, "확정"은 이전에 승인된 값이다.

| 데이터 | 보존 기간 | 파기 실행 | 상태 |
| --- | --- | --- | --- |
| 원본 운영 로그(`event_logs`, `admin_audit_logs`, `auth_security_logs`, `push_message_logs`, `push_delivery_logs`) | 생성 후 1년 | `purge_expired_operational_logs()`, 매일 cron | 확정 |
| 제휴 혜택 이용 기록(`partner_benefit_usages`) | 생성 후 1년 | 같은 purge | 확정 |
| rate-limit 시도 기록 7종(`member_auth_attempts`, `partner_auth_attempts`, `admin_login_attempts`, `partner_registration_attempts`, `suggestion_attempts`, `mattermost_sender_test_attempts`, `password_reset_attempts`) | 시도 창 시작 후 30일. 차단 중인 행은 남긴다 | 같은 purge | 기본값 |
| 알림 발송 결과(`notification_deliveries`, `admin_notification_deliveries`, `partner_notification_deliveries`) | 확정된 결과(`sent`·`failed`·`skipped`) 생성 후 180일. 진행 중 캠페인은 제외 | 같은 purge | 기본값 |
| 회원 알림함(`member_notifications`)과 캠페인 본문 | 회원 유지 기간. 발송 결과 정리와 무관하게 남긴다 | 회원 익명화 때 삭제 | 기본값 |
| 이미지 업로드 세션(`image_upload_sessions`) | `expired` 행은 만료 후 30일. `attached` 행은 연결된 이미지를 쓰는 동안 유지 | 같은 purge | 기본값 |
| 식별자 원장(`platform_active_identities`, `partner_metric_unique_visitors`) | 400일. 관리자 활동 지표가 읽는 최대 84일 창보다 길다 | 같은 purge | 기본값 |
| 집계(`partner_metric_rollups` 등) | 장기. 직접 식별자·IP·세션이 없는 통계만 남긴다 | 없음 | 확정 |
| 탈퇴 회원 | 탈퇴 즉시 세션·푸시 구독 정리, 30일 뒤 익명화 | `anonymize_deleted_member()`, 매일 cron | 확정 |
| 수료생 교육이수증 파일 | 검토 완료 후 30일 | `cleanup-graduate-verification-files` cron | 확정 |
| 수료생 업로드 중 사용하지 않은 파일 | 24시간 | 같은 cron | 확정 |
| 쇼케이스 회원 연결·학번 | 정산 기록 후 30일. 피드백 본문과 마스킹 당첨 명단은 증빙으로 남긴다 | `purge_showcase_personal_data()`, 매일 cron, 실행마다 감사 기록 | 확정 |
| 정책 동의 기록(`member_policy_consents`) | 회원 유지 기간. 익명화 때 IP·user-agent만 지우고 버전·시각은 남긴다 | 회원 익명화 | 기본값 |
| 제휴 담당자 연락처(파트너 계정·회사 정보) | 미정. 제안: 제휴 종료(계정 비활성) 후 1년 | 자동 파기 없음 | 운영자 결정 필요 |
| 휴면 회원 기준 | 미정. 마지막 접속 근거가 회원 테이블에 없다 | 없음 | 운영자 결정 필요 |
| 15기 종료 후 회원 데이터 | 미정. 서비스 종료·이관 방향 결정에 따른다 | 없음 | 운영자 결정 필요 |

보안 사고·분쟁은 `log_retention_holds`에 그룹·기간·사유를 남겨 파기를 멈춘다. 그룹은 원본 로그 6종과 `rate_limit_attempts`, `notification_deliveries`, `image_upload_sessions`, `platform_active_identities`, `partner_metric_unique_visitors`다. hold는 만료 시각이 지나면 효력이 없다.

쇼케이스 파기 시계는 관리자가 정산을 기록해야 시작한다. 결과 발표가 시작된 뒤에도 정산하지 않으면 추첨·발표 화면이 경고한다. 정산은 경품이 있는 분야의 첫 추첨이 모두 끝난 뒤에만 기록할 수 있고, 정산 뒤에는 일정·출품·검수를 바꿀 수 없다.

## 회원 익명화 범위

`members` 행은 지우지 않고 갱신하므로 FK cascade가 동작하지 않는다. `anonymize_deleted_member()`가 직접 처리하는 범위는 다음과 같고, 회원 FK가 있는 테이블이 이 목록이나 보존 목록 중 하나에 반드시 들어가도록 [FK 범위 테스트](../../tests/member-anonymization-fk-coverage.test.mts)가 막는다.

- 삭제: 프로필 사진 기록, 이메일 인증·로그인 전환·비밀번호 토큰, 졸업 프로필, 레거시 SSAFY 검증(테이블이 있을 때만), 푸시 설정·구독, 회원 알림함·발송 결과, 즐겨찾기, 리뷰 반응, 관리자 알림 수신자·설정·구독·발송 결과, 쇼케이스 대표자 명단 행, Wallet 패스(별도 purge RPC)
- 식별 정보만 제거: 정책 동의의 IP·user-agent, 수료생 인증 요청(마스킹), 수동 가져오기 행의 이름·이메일·Mattermost ID, 이벤트 경품 당첨 스냅샷, 푸시 로그의 회원 연결, 수료생 업로드의 회원 연결, 쇼케이스 등록·조회·체험·피드백·관심·제외·당첨·출품의 회원 연결과 학번
- 보존: 리뷰 본문과 미디어(작성자는 "탈퇴한 회원"으로 표시), 제휴 혜택 이용·쿠폰 발급·사용 기록(정산 증빙, 로그 보존 기간 적용), 관리자로서 남긴 처리 주체 FK(검수자·발송자·작성자 등), 비활성화한 관리자 프로필

## 백업과 파기

| 사본 | 보존 | 상태 |
| --- | --- | --- |
| 운영 서버 pgBackRest | 최근 전체 백업 2개와 필요한 WAL chain(현행 설정) | 확정 |
| 운영 서버 Restic snapshot | 위 DB 백업과 같은 수명. 만료된 DB 백업의 snapshot만 정리 | 확정 |
| PVE·관리 Mac 외부 사본 | 기본 30일(관리 Mac은 30세대 상한 유지). 현재 PVE 사본은 무기한이라 운영자 적용이 필요하다 | 기본값 |
| 복구 키 escrow 사본 | 사본 수와 보관 매체는 비공개 운영 문서에 둔다 | 운영자 결정 필요 |

운영 데이터 파기는 백업 사본이 만료될 때 완결된다. 따라서 파기 후 백업 잔존 기간은 위 보존 기간을 넘지 않아야 한다. 백업에서 복원한 환경은 서비스에 연결하기 전에 회원 익명화와 보존 purge cron을 즉시 실행하고, 쇼케이스 파기 대상과 만료된 수료증 파일을 다시 정리한다. 자동 재삭제 체계가 있다고 가정하지 않는다.

## 삭제와 복구

운영 데이터 삭제 성공과 백업에서의 만료는 다르다. 복원 후 삭제·익명화 대상이 되살아나는지 확인해야 한다. 결정표에 없는 데이터의 보존기간은 운영 책임자가 정하기 전까지 새로 만들지 않고, 정한 값은 이 문서와 migration에 함께 반영한다.

[비기능 개인정보 기준](../requirements/non-functional.md), [Service Role 경계](./service-role-boundary.md)가 공통 규칙이다. 실제 운영의 보존·삭제 완료는 실행 증거가 필요하며 이 문서만으로 보장하지 않는다.
