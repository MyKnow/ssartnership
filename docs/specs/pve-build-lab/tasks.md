---
title: PVE 빌드 실험 작업 상태
type: task-list
status: active
authority: normative
---

# 작업 상태

- [x] Issue #497, dev 기준 SHA 및 별도 작업 브랜치 준비.
- [x] 빌드 VM 4970의 KVM 부팅·SSH·Docker·QEMU agent 확인.
- [x] 전용 사설망·운영 주소 차단·전송 상한 구성 및 연결 검사.
- [x] 기준 코드의 탐색 cold/warm gate와 SHA·83 E2E 검증.
- [ ] 실제 VM 자원 조합별 cold/warm 각각 최소 3회.
- [ ] 고정 자원에서 코드 최적화별 cold/warm 각각 최소 3회.
- [ ] 브랜치 push → 기동 → 빌드 → 배포 → 유휴 종료 실증.
- [x] Preview VM 4971의 디스크·게스트 도구·새 합성 환경값 준비.
- [ ] 합성 DB·스토리지·서비스 실행 및 외부 동작 차단 실증.
- [ ] 작은 변경 push부터 Preview 정상 응답까지 측정.
- [ ] 비교 결과 및 전환·복구안 제출. 운영 전환은 별도 승인.

## 고정 경계

- Issue: [#497](https://github.com/MyKnow/ssartnership/issues/497).
- worktree: `ssartnership-build-lab`, branch: `ci/497-pve-build-lab`.
- baseline: `308281074ed752b6cccce693d27755da13dd675f`.
- archive SHA-256: `27846014a638fc7305200918867ded81f3421601c14eefcdc0981ca546e65af9`.
- 사전 준비 gate image: `sha256:7b7ecbe44b645fcf39fe23833c238616322b7e7292ecec8fc42913b88b7ed0da`.
- 기존 production/preview·dev/main 배포·도메인·공유기·운영 DB·운영 비밀값은 변경하지 않는다.
- 원본 checkout의 미추적 사용자 파일은 보존한다. 기반 코드 `81dc3a368adcf2fa74d88aa3f2deeabbd175667e`를 실험 브랜치에 push했고 원격 SHA 일치를 확인했다. 해당 SHA의 Actions/check runs/status contexts는 모두 0개이며 PR과 자동 제어기 활성화는 아직 없다.

## 2026-09-27 현재 측정

PVE host의 `build-lab-497-resource-matrix.service`가 실제 VM 할당량을 비교한다. 최초 확인 MainPID는 15715다. 재개 시 동일 unit·PID·결과를 먼저 확인하고 중복 실행하지 않는다. VM 4970을 정상 종료한 뒤 2/4/8 vCPU 및 6144 MiB로 바꾸며, 각 조건에서 cold/warm 3회씩 실행한다. gate 컨테이너는 5120 MiB 제한이다. CPU 비교 뒤 RAM 비교와 코드 최적화 비교가 남아 있다.

로컬 측정기는 다음 RAM 비교를 지원하도록 준비했다. CPU 결과에서 선택한 동일 코어 수를 고정하고 VM/container를 각각 6144/5120 MiB와 8192/6144 MiB로 비교한다. 따라서 이는 VM 메모리만의 효과가 아니라 실제 사용 가능한 메모리 구성 비교다. 각 조건 cold/warm 3회이며 `ram-` 실행 이름으로 CPU 비교 결과와 분리한다. 현재 실행 중인 host/guest 스크립트는 교체하지 않았다.

- 실제 VM 2 vCPU/6144 MiB cold-1: 474.723초, warm-1: 450.771초. 두 실행 모두 유효 gate이며 cold-2도 475.833초로 완료했다. 다음 warm-2는 live unit에서 확인한다.
- 이전 탐색은 VM 8 vCPU/8192 MiB에서 컨테이너 2 CPU/5120 MiB만 제한했다. cold-1 452.415초, warm-1 426.275초, cold-2 456.580초다. 세 실행 모두 83 E2E 통과, 실패/오류/skip/retry 0이다. 실제 VM 조건별 통계와 섞지 않는다.
- 탐색 guest matrix는 cold-2 완료 및 Docker 실행 없음 확인 후 정상 종료했다. MainPID 0/inactive, guest busy false를 확인했으며 재개 대상이 아니다.
- cold는 새 workspace 및 npm/Next cache 없음이다. gate image는 준비되어 있고 host page cache는 통제하지 않았다. warm은 동일 SHA의 성공 결과에서 npm 및 두 Next cache만 복사한다. 준비 시간을 별도 기록한다.
- cgroup memory.peak는 파일 캐시 등을 포함하므로 앱 RSS로 해석하지 않는다. guest 메모리는 MemTotal-MemAvailable의 1초 표본 최댓값이다.
- 성공한 cold/warm 쌍의 `result.json`, `phases.json`, `gate.log`, `validated-gate.json`을 보존하고 재생성 가능한 work만 해제한다. 실패한 쌍은 보존하며 자동 재시도하지 않는다.
- gate 시간은 이미지 준비·패키징·전송·배포를 포함하지 않는다. GitHub 전체 job 시간과 직접 동일 범위로 비교하지 않는다.

## 인프라

- VM 4970: Debian 12, 80 GiB 디스크, 10.77.49.10, 자동시작 비활성. 현재 자원은 측정 스크립트가 바꾸므로 live config를 확인한다.
- VM 4971: Debian 12, 4 vCPU/4096 MiB/40 GiB, 10.77.49.20. 측정 간섭 방지를 위해 정지했다.
- vmbr497 및 전용 nft 테이블: 기존 vmbr0 재시작 없이 NAT, private/CGNAT/운영 공인 IPv4/호스트 관리 접근 차단. 운영 DNS는 네트워크 적용마다 다시 조회하며 실패 시 중단한다.
- VM NIC rate는 빌드 8, Preview 2다. PVE rate 단위에 따라 해석하고 실제 전송량도 별도 관측한다.
- 외부 HTTPS 성공, 운영 LAN SSH·PVE 8006·호스트 SSH·Tailscale SSH 차단을 실제 확인했다. SSH host key는 신뢰된 guest agent로 대조했다.
- `build-lab-497-network.service`는 enabled다. PVE 자체 재부팅 복원은 아직 검증하지 않았다.

## 자동 실행·배포 구현

호스트의 브랜치 제어기는 설치했으나 timer는 disabled/inactive다. guest agent 및 request worker의 초기 버전도 설치되어 있다. root 소유 제어 코드는 브랜치에서 자동 갱신하지 않는다. host controller가 resource-matrix lock을 존중하는 것은 실제 PVE 호출에서 `wait-resource-matrix`로 확인했다.

최신 로컬 초안에는 완료 결과 검증, PVE가 두 실험 게스트 사이에서 수행하는 제한된 artifact 전송, Preview의 SHA/해시/image label/내부 네트워크 검사 및 정상 응답 receipt가 추가되어 있다. 이 최신 배포 경로는 아직 설치·실행하지 않았다. 전송 전용 SSH key 배치, DB/스토리지 준비, 브랜치 push 및 전체 경로 측정이 남았다. 실패한 빌드/배포는 자동 반복하지 않는다. 빌드 origin은 실험 서비스의 loopback 주소로 설정하며, 빌드 VM에 운영 또는 Preview 비밀값을 제공하지 않는다.

## Preview 준비

Docker Compose 2.39.4 checksum을 확인했고, Node 24.18.1/npm 11.16.0은 digest 고정 이미지에서 추출했다. 새 data/app env를 VM의 root 전용 경로에 생성했으며 값을 출력하거나 운영값을 복사하지 않았다. Compose config의 default/edge는 모두 internal=true다. 실제 DB·Storage·app 컨테이너, 합성 데이터, 실행 중 egress 및 재부팅 지속성 검증은 미완료다. 배포 스크립트는 기존 네트워크도 app 시작 전에 검사하며 DB migration은 수행하지 않는다.

## 로컬 검증

- Node 24.18.1/npm 11.16.0 trusted install: lifecycle script 실행 없음.
- `verify:change`: 문서·정책·lockfile·migration·lint·typecheck·1939 Node cases(기존 skip 9, 실패 0)·133 unit cases·보안 감사 통과. 전체 로그 2141줄을 검사했고 rollback mock의 기존 4개 진단 외 새 오류/재시도는 없었다.
- Python 계약 테스트: 현재 29개 통과. SHA/결과물 경계, matrix lock, 진행 중 작업 보호, 실패 빌드 배포 차단, 이미지/네트워크 검증 포함.
- `verify:release`: loopback port 32497에서 exit 0. Quick·프로덕션 build·E2E 83개 통과, 재시도 0. 전체 2489줄에서 기존 rollback mock 4개 및 admin 테스트 사이 Fast Refresh 2개 외 새 오류/재시도 없음. 실행 중 서버나 산출물 디렉터리를 다른 검증과 공유하지 않았다.

[요구사항](./spec.md) · [구현 계획](./plan.md)

## 캐시 최적화 후보

설치된 Next.js 16.3.4는 Docker 환경에서 생성 키 저장 디렉터리를 사용하지 않으며, 매 빌드 생성하는 Server Actions 키를 webpack cache version의 serverReferenceHashSalt에 포함한다. 따라서 캐시 디렉터리 복사만으로 컴파일 캐시가 유효하지 않을 수 있다. 이는 소스 기반 원인 후보이며 성능 개선을 아직 입증한 것은 아니다.

실험 플래그 `SSARTNERSHIP_BUILD_LAB_CACHE=1`에서만 생성한 32바이트 키를 warm cache와 함께 재사용하는 후보를 준비했다. 실제 결과물과 E2E fixture의 키는 분리하며, 운영 키를 상속하지 않는다. cold에서는 새 키를 만들고 파일 권한 0600과 symlink 경계를 검사한다. 플래그가 없는 기존 흐름의 환경은 변경하지 않는다. [Next.js self-hosting 문서](https://nextjs.org/docs/app/guides/self-hosting#server-functions-encryption-key)의 지원 설정을 사용하며 같은 후보 SHA에서 플래그 off/on 각각 cold/warm 3회를 비교해야 한다. 집중 Node 테스트 2개, Python 테스트 33개, 전체 로컬 release(83 E2E, 실패/skip/오류/재시도 0)는 통과했다. 로컬 release는 Docker gate의 두 번 빌드 경로를 직접 실행하지 않으므로 해당 경로의 VM 검증과 성능 실측은 남아 있다. 전체 로그 2491줄에는 기존 mock rollback 진단 4개와 admin 테스트 사이 Fast Refresh 2개 외 새 오류가 없었다.

## 내부 네트워크의 호스트 접속 보완

과거 Actions ledger의 internal-only Docker 포트 미발행 장애를 확인했다. 최신 초안은 Docker port publication을 제거하고 systemd-socket-proxyd가 VM loopback 3100/54321에서 실제 private container IP로만 전달한다. 내부 전용 네트워크와 외부 동작 차단은 유지한다. 최초 DB/Storage 초기화 스크립트는 기존 stack이 있으면 중단하며, 별도 합성 smoke 및 지속성 marker만 사용한다. 이 변경은 로컬 준비 단계이며 실제 Preview에서 포트·차단·재부팅 검증이 남아 있다. 필수 Actions skill·ledger 523줄 전체를 읽고 저장소 trigger를 대조했다. 실험 브랜치 최초 push의 예상 GitHub workflow는 0개, Vercel Git deployment는 false이며, 현재 진행 중 Actions와 이 브랜치의 PR은 없다. 최초 publication은 자동 제어기 비활성 상태의 기반 코드 전달이며 성능 측정용 push와 구분한다.
