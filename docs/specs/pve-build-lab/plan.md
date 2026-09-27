---
title: PVE 빌드 실험 구현 계획
type: implementation-plan
status: current
authority: normative
---

# 구현 계획

## 작업 경계

기준 SHA는 dev의 `308281074ed752b6cccce693d27755da13dd675f`이며 작업 브랜치는 `ci/497-pve-build-lab`이다. 기존 checkout은 변경하지 않는다. 운영 이미지 워크플로는 dev/main push에만 연결된 상태를 보존한다.

## 구성 순서

1. 빌드 VM은 8 vCPU/8 GiB/80 GiB를 초기 상한으로 준비한다. 측정용 컨테이너 CPU/RAM 조합은 별도로 제한하고 guest overhead를 남긴다.
2. VM 관리 제어 경로와 소스 실행을 분리한다. 제어기는 고정 저장소·브랜치만 감시하며 정확한 SHA 작업을 생성한다. 빌드 작업에는 PVE·운영 권한을 주지 않는다.
3. 새 private 네트워크 또는 동등한 차단으로 운영 LAN/DB와 격리한다. 관리 연결과 의존성 다운로드에 필요한 경로만 허용하며 공유 인터넷 전송량을 제한한다.
4. 기존 Docker gate를 기준으로 실행하고 단계 시간 및 peak memory를 수집한다. cold는 캐시 범위를 명시하고 warm은 동일 범위의 캐시 재사용을 기록한다.
5. 컨테이너 quota 탐색과 실제 VM 할당량 비교를 구분한다. 실제 VM 2/4/8 vCPU와 6 GiB RAM을 먼저 비교한 후, 선택 CPU에서 RAM 6/8 GiB 등 메모리 조합을 좁혀 측정한다. 자원 고정 후 코드를 하나씩 최적화한다. 기준 코드 변경 여부와 검사 수를 기록한다.
6. 별도 서비스 VM에 합성 데이터만 설치하고 메일·푸시·cron을 비활성화한다. 브라우저 접근은 제한된 관리 경로를 사용한다.
7. 빌더 종료 상태 및 기동 상태에서 push-to-ready 각각 최소 3회, 실제 작은 변경을 포함해 측정한다.

## 안전과 복구

기존 운영 receiver가 읽는 manifest 이름·workflow·이미지 namespace를 재사용하지 않는다. 실험 제어기를 중지하면 추가 작업을 차단하며 실행 중 작업의 상태를 확인한 뒤 실험 VM만 정상 종료한다. 기존 서버·공유기·도메인·관리 인터페이스를 바꾸지 않는다. 실험 서비스의 네트워크 차단과 외부 부작용 차단이 검증되기 전 배포를 시작하지 않는다.

## 검증

동일 테스트 목록과 E2E zero retry/failure/skip (Node의 기존 구성 skip 8개와 구분), image/source SHA, HTTP readiness, 자원 상한, 중복 push·취소·timeout·유휴 종료를 검증한다. cold/warm 조건별 중앙값·범위와 원시 숫자 기록을 보관한다. 캐시 효과와 하드웨어·코드 효과를 따로 보고한다.

### 실험 Preview 브라우저 접근

VM 4971의 loopback app 3100/API 54321을 관리 Mac의 같은 loopback 포트로만 전달한다. 공개 DNS·공유기 port forwarding은 추가하지 않는다. 두 포트가 비어 있는지 확인하고 `ExitOnForwardFailure=yes`로 기존 listener를 덮어쓰지 않는다. 기존 Mac 관리 키는 복사하거나 agent-forwarding하지 않는다.

```sh
ssh -N -o BatchMode=yes -o ExitOnForwardFailure=yes \
  -J pve-agent -i ~/.ssh/pve-agent \
  -L 127.0.0.1:3100:127.0.0.1:3100 \
  -L 127.0.0.1:54321:127.0.0.1:54321 \
  builder@10.77.49.20
```

접속 URL은 `http://127.0.0.1:3100`이며 빌드 시 public origin 및 합성 runtime origin과 일치해야 한다. 실제 터널·브라우저·합성 데이터 및 Preview guest 재부팅은 검증했다. 최종 게시 SHA의 마감 검증은 Issue #497의 최종 기록으로 확인한다. 검증 종료 시 해당 SSH 프로세스를 정상 종료하면 관리 Mac의 listener가 해제된다.

[요구사항](./spec.md) · [진행 상태](./tasks.md)

## 측정 후 선택

권장 빌더는 4 vCPU/6144 MiB VM/5120 MiB container, stable lab cache 및 warm reuse 활성화다. 운영 자원 회수 없이 동시 실행 1개로 제한한다. [측정 결과](../../performance/measurements/pve-build-lab-2026-09-27.md)와 [운영·복구 절차](../../operations/runbooks/pve-build-lab.md)를 참조한다. 운영 전환은 별도 승인 대상이다.
