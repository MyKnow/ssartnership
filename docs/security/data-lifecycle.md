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
| 회원·인증 | 최소 입력, 서버 전용 비밀번호 해시·토큰 처리; 원문 로그 금지 | [익명화 계약](../../tests/member-anonymization-schema-contract.test.mts), [계정 삭제](../../tests/member-account-deletion-flow.test.mts) |
| 사진·증명서·리뷰 미디어 | 소유권·타입·크기 확인 후 Storage 저장, 필요한 범위만 조회 | [파일 계약](../../tests/graduate-verification-files.test.mts), [미디어 정리](../../tests/partner-media-attachment-cleanup.test.mts) |
| 감사·제품·보안 로그 | 민감 값 제거, 역할별 조회 | [로그 정본](../architecture/event-logging.md), [보존 정책 테스트](../../tests/log-retention-policy.test.mts) |
| Preview 복제 | 비밀번호 hash/salt와 legacy avatar 제거, 승인된 사진 ledger·private 객체 유지 | [sanitizer](../../tests/preview-sync-sanitize.test.mts), [Storage 복제](../../tests/preview-sync-storage.test.mts) |
| 백업·외부 사본 | 암호화·별도 권한·복원 검증 | [백업 runbook](../operations/runbooks/self-host-operations.md), [외부 사본](../operations/runbooks/self-host-observability.md) |

## 삭제와 복구

운영 데이터 삭제 성공과 백업에서의 만료는 다르다. 복원 후 삭제·익명화 대상이 되살아나는지 확인해야 하며, 새로운 자동 재삭제 체계가 구현됐다고 가정하지 않는다. 데이터 종류별 승인 보존기간과 복원 후 재삭제 절차가 정본에 없는 경우 운영 책임자가 결정할 미결정 사항으로 기록한다. 임의 기간을 새로 정하지 않는다.

[비기능 개인정보 기준](../requirements/non-functional.md), [Service Role 경계](./service-role-boundary.md)가 공통 규칙이다. 실제 운영의 보존·삭제 완료는 실행 증거가 필요하며 이 문서만으로 보장하지 않는다.
