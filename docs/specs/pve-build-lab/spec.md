---
title: PVE 빌드 실험 요구사항
type: feature-spec
status: current
authority: normative
---

# PVE 빌드 실험

Issue: [#497](https://github.com/MyKnow/ssartnership/issues/497)

## 목표와 불변조건

기존 production·preview를 변경하지 않고 빌드 VM 및 합성 데이터 Preview에서 성능 개선을 입증한다. 운영 전환 및 dev/main 머지는 별도 승인 대상이다. 운영 자격증명, 데이터, 배포 신호를 실험 환경에 제공하지 않는다. 기존 VM 자원 회수는 하지 않는다. 임의 PR을 신뢰된 관리 권한으로 실행하지 않는다.

## 완료 기준

- 기존 코드와 동일 SHA·검사 계약으로 GitHub/VM 기준 비교.
- CPU/RAM 조합과 최적화 케이스마다 cold/warm 각 최소 3회.
- 브랜치 push 감지, 자동 기동, 대기 작업 없는 유휴 종료를 실제 검증.
- 별도 서비스 VM에 합성 DB·스토리지와 앱을 배포하고 외부 부작용 차단.
- 대기·부팅·설치·검사·빌드·전송·배포·정상 HTTP 응답과 최대 메모리 기록.
- 작은 변경을 push한 전체 경로 검증, SHA 일치 및 동일 테스트 통과 확인.
- 효율적 자원 조합, 최적화 결과, 전환/복구안 제출.

[구현 계획](./plan.md) · [진행 상태](./tasks.md)
