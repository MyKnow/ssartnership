---
title: 기능 명세 인덱스
type: index
status: current
authority: normative
last_verified: 2026-10-05
---

# 기능 명세 인덱스

## Artifact 역할

- `spec.md`: 사용자가 얻는 결과, WHAT/WHY, 범위, 불변조건, 수용 기준
- `plan.md`: 기존 시스템을 존중하는 기술 설계, 데이터·API·운영·검증 방법
- `tasks.md`: 현재 구현을 재개할 수 있는 순서와 완료 증거

기존 시스템 전체를 소급 명세하지 않는다. 계획된 다중 surface, 데이터 모델, 인증·보안 또는 아키텍처 변경부터 이 구조를 사용한다. 작은 수정은 Issue와 집중 검증으로 충분하다.

## 현재 계약

구현이 끝나 현행 동작을 정의하는 명세다. 코드·스키마·테스트와 다르면 Issue로 차이를 정리한다.

- [관리자 콘솔 계약](./205-admin-console/spec.md) — Issue #205
- [수료생 증명서·프로필 사진 인증](./graduate-verification/spec.md) — Issue #432 롤아웃 완료
- [SSAFY 프로젝트 쇼케이스·체험 이벤트](./project-showcase-event/spec.md) — Issue #480(후속 #491·#510·#511·#512)
- [자체 호스팅 운영 기반](./self-hosting/spec.md) — Issue #435
- [자체 호스팅 데이터와 운영 복구](./self-host-database/spec.md) — Issue #435·#453
- [자체 호스팅 공개 edge 복구](./self-host-edge-recovery/spec.md) — Issue #478
- [Production·Preview PVE 이전](./pve-service-migration/spec.md) — Issue #523
- [문서 책임·테스트 유지 범위](./documentation-architecture/spec.md) — Issue #474

## 진행 중

- [Apple Wallet 회원 인증 패스](./301-apple-wallet-member-pass/spec.md) — Issue #301, active. 기능 플래그와 조정 timer는 비활성이다.

## 완료 기록

종료된 Issue의 `plan.md`·`tasks.md`는 시점 증거(`completed`/`evidence`)로 남긴다. 현재 절차로 실행하지 않는다. 미체크 항목은 각 작업 기록 맨 위의 종료 정리에서 완료 근거를 밝히거나 [기술 부채 원장](../plans/tech-debt.md#종료-issue에서-이관한-잔여-항목)으로 옮겼다.

- PVE 이전: [계획](./pve-service-migration/plan.md), [작업 기록](./pve-service-migration/tasks.md)
- 자체 호스팅 운영 기반: [계획](./self-hosting/plan.md), [작업 기록](./self-hosting/tasks.md)
- 자체 호스팅 데이터: [계획](./self-host-database/plan.md), [작업 기록](./self-host-database/tasks.md)
- 공개 edge 복구: [계획](./self-host-edge-recovery/plan.md), [작업 기록](./self-host-edge-recovery/tasks.md)
- 쇼케이스: [계획](./project-showcase-event/plan.md), [작업 기록](./project-showcase-event/tasks.md)
- 문서·테스트 정비: [계획](./documentation-architecture/plan.md), [작업 기록](./documentation-architecture/tasks.md), [문서 이관 장부](./documentation-architecture/migration-map.md)
- 수료생 기수 전환: [롤아웃 계획](./graduate-verification/plan-432.md)
