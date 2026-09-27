---
title: PVE 빌드 실험 작업 상태
type: task-list
status: active
authority: normative
---

# 작업 상태

## 현재 실행: 전체 경로 반복 계측

보안 검사 수정 `c3a905e75d99a19fd738cbcf7fb0066e29127cd4`의 cold 준비 빌드는 394.621초, 83 E2E 및 strict audit로 통과했고 합성 Preview의 실제 image SHA·healthy·상세 HTTP 200을 검증했다. 정상 캐시를 만든 뒤 정식 running/warm 첫 push `96f4e5d2697c6034fba32b95d4ec0e31fcd9a222`를 자동 감지해 배포했다. push-to-ready 604.037초, gate 295.746초, 전송 245.951초, 배포 3.782초다. 응답의 실험 표식과 SHA가 일치했고 GitHub Actions/운영 배포는 0회다. 1회 결과이므로 최종 통계는 아니다.

running/cold 첫 시도 `a8f63471a84f4a8600f1bd938f3e532be5ac3afd`는 의존성 다운로드 중 ECONNRESET으로 43.865초 후 실패했고 배포가 차단됐다. 원래 push·로그·실패 결과를 보존하고 성공 통계에서 제외한다. 같은 빌더에서 잠금 파일의 Next 패키지를 읽기 전용 조회해 HTTP 200·SHA-512 일치를 확인했다. 새 SHA의 별도 cold 실행으로 표본을 계속 수집하며 자동 설치 재시도나 캐시 조건 변경은 하지 않는다. 유효 표본은 아직 1/12다.

운영 앱 두 곳의 컨테이너·이미지·시작 시각을 읽기 전용으로 기록했다. production revision은 `17ddf32b2b6d67c3d197d428347861cdfea18c1f`, 기존 preview는 `308281074ed752b6cccce693d27755da13dd675f`이며 모두 healthy다. 초기 준비 실행 30e0ed83의 생성된 work 폴더만 제거했고 원본 source/image archive·측정·실패 작업 폴더·최신 캐시는 보존했다.

## 수정 및 준비 검증 이력

재부팅 수정 `5065fe30974a06f0f50cb4cc8bcb52d340985203` 게시 후 설치 코드 및 controller unit을 동기화했다. timer를 켜서 준비 빌드를 자동 접수했지만 npm 보안 endpoint의 HTTP 503/exit 1을 기존 wrapper가 빈 취약점 목록으로 해석하는 결함을 발견했다. 배포 전에 timer를 disabled/inactive로 되돌렸으며 이 실행은 성공 표본에서 제외한다. 정식 push 12회는 아직 시작하지 않았다. 실제 운영 health 두 곳은 HTTP 200이었다.

오류 envelope·불완전한 report·프로세스 중단을 실패로 처리하고 정상 advisory exit 1은 정책 평가에 전달하는 회귀 검사를 추가했다. 집중 검사 6개와 live npm audit는 통과했다. 전체 Release도 E2E 83개, 실패/오류/skip/retry 0, XML 115.943초로 통과했다. 기존 startup/admin full-reload 안내 3개 및 rollback mock 진단 4개 외 새 오류는 없다. 원래 준비 실행은 598.362초 후 gate 성공을 보고했으나 원본 receipt와 별도 host rejection 기록을 함께 보존하고 배포하지 않았다. 수정 게시 후 계측을 재개한다. 이전 48회 결과는 시간·E2E 수치이며, 당시 wrapper가 audit transport 성공까지 보장하지 못했다는 한계를 유지한다.

## 완료된 자원 및 캐시 계측

CPU 18회, RAM 12회, GitHub 기준 6회, 같은 후보 SHA의 캐시 최적화 12회를 완료했다. 모든 결과는 각 조건 n=3, SHA 일치, E2E 83개 및 실패/오류/skip/retry 0, OOM 없음이다. `build-lab-497-optimization-matrix.service`는 2026-09-27 09:00:29 KST에 success/inactive/MainPID 0으로 종료했으므로 재시작하지 않는다.

| 캐시 | 최적화 미적용 중앙값 | 적용 중앙값 | 조건별 반복 |
| --- | ---: | ---: | ---: |
| cold | 386.184초 | 386.629초 | 3회 |
| warm | 359.106초 | 292.786초 | 3회 |

warm은 66.320초, 약 18.5% 단축됐다. cold는 차이가 거의 없다. compile marker 구간은 off warm 첫 두 회에서 real/fixture 각각 약 51초, on에서 약 19초였으며 전체 Next build 시간과 구분한다. 측정은 4 vCPU/6144 MiB VM 및 5120 MiB container, 같은 후보 SHA `30e0ed839979f79026cea477a1db168346dd1017`와 image `sha256:0074c15043d3aec5b59f5576b8b2ddcede3a2ff7a9cd918e88ad486230ee68e8`다. 이미지 준비·부팅·전송·배포를 포함한 결과는 아직 아니다.

효율 기준은 4 vCPU/6 GiB로 선택했다. CPU 4→8은 할당 두 배 대비 약 6~7% 개선, RAM VM/container 6144/5120→8192/6144 MiB는 약 0.4~0.5% 개선이었다. 빌더 root 소유 profile은 cpus=4, vmMemoryMiB=6144, containerMemoryMiB=5120, stableLabCache=true, reuseCache=true로 설치했고 실제 guest 자원과 일치함을 검증했다. root 제어기는 아직 disabled/inactive다.

측정 종료 후 API로 Preview VM 4971을 기동했다. 이전 설치본을 `/root/build-lab-preview-before-<SHA>`에 보존한 뒤 같은 후보의 스크립트 42개와 Compose overlay·합성 seed를 설치했다. 설치 묶음은 174080바이트, SHA-256 `e0b759c850e4fd94b141121862b1c973f59f7385b6f5d37aa3546331c5662aca`다. 합성 env는 재생성하거나 출력하지 않았다. guest의 관련 계약 12개와 실제 Compose config 검증이 통과했다. 서비스는 db/rest/storage/gateway 4개, 네트워크 2개 모두 internal=true, 공개 포트 없음이다.

`build-lab-preview-provision-30e0ed83.service`는 09:09:55 KST에 success/inactive/MainPID 0으로 종료했다. 실제 db/rest/storage/gateway 4개가 healthy이며 migration·DB/Storage smoke·합성 seed가 성공했다. 회원 0명, 가상 업체/제휴 각 1개다. seed 재적용은 `LAB_SEED_REQUIRES_EMPTY_APPLICATION_DATA`로 거부됐고 행 수가 유지됐다. 모든 실행 네트워크 internal 및 port publication 없음도 inspect로 확인했다.

Storage 컨테이너에서 내부 gateway:8000 TCP 연결은 성공하고 인터넷 443·SMTP 587·PVE SSH·현재 운영 공인 IP 443은 모두 차단됐다. 발송 자격증명 설정 없음, DB cron.job 0개, runtime env root 소유 0600도 확인했다. 앱 자체에서도 같은 외부 연결 차단과 내부 gateway 연결을 검증했다. guest 재부팅은 아래 결함 수정 후 검증을 완료했다.

제어기를 한 번만 호출해 현재 후보의 첫 request를 시작했고 timer는 계속 disabled/inactive다. request `30e0ed839979f79026cea477a1db168346dd1017`은 gate 389.534초, cold, 83 E2E 및 zero failure/error/skip/retry로 완료했다. source 준비부터 artifact 완료까지 약 408초, packaging 약 7.138초이며 이는 실제 push 측정에서 제외하는 준비 실행이다. archive는 343201280바이트, SHA-256 `d754ca21d5d6570b36c4d68858617490260424e60a80aa1b6ebd16769edda1f8`이다. 첫 delivery는 host의 `build-lab-first-delivery-30e0ed83.service`에서 09:19:32 KST success/inactive/MainPID 0으로 완료했다. 전송 약 246.306초, Preview 이미지 적용~HTTP readiness 약 3.843초다. 실행 이미지 ID는 `sha256:82e6869c358e11651a99176a14cd6a7e7c62be0dcbbc54ce983d414eafb48f86`이며 archive·SHA·label이 일치했다. 이 준비 실행은 push-to-ready 반복 통계에서 제외한다. Mac loopback 3100/54321 SSH 터널을 사용하며 공개 DNS/공유기는 변경하지 않았다.

PVE의 일회용 인증으로 두 guest의 hostname 조회와 제한된 SCP 다운로드를 실제 검증했다. 공개 파일 hash는 builder controller `30527dfde0d998dee32efb9971dd426234f29a3abc5d092ae5c6bafab00b1f84`, Preview seed `1eaaa55a83a8f83b87e1165af89ecdab42bd4464410aee129821dd3de0c8a482`다. 개인키 파일 없이 메모리/agent에서만 사용했고 종료 후 agent와 임시 디렉터리 제거를 확인했다. 기존 관리 SSH도 유지됐다. 실제 app artifact 전달과 최초 배포도 검증했다.

실제 push 시간 측정용 opt-in Git shim은 준비했고 read-only Git passthrough를 확인했다. 아직 시간 측정 대상 push는 하지 않았다. 설치·전송 검증은 기존 production/preview와 분리했고 마지막 운영 health 확인은 08:35 KST 두 URL 모두 HTTP 200이었다.

## 재부팅 복구 결함과 수정

첫 Preview 재부팅에서 Docker가 private IP를 재할당했으나 loopback proxy unit이 이전 IP를 고정해 앱/API 연결이 reset됐다. 컨테이너와 볼륨은 정상이며, 실패한 최초 검증과 후속 진단을 보존했다. 이 실패를 초기화 재실행이나 공개 포트 추가로 우회하지 않았다.

현재 로컬 변경은 proxy service activation마다 고정 lab container의 주소 및 모든 네트워크의 internal 여부를 조회한다. root는 주소 조회에만 사용하고 groups를 비운 뒤 UID/GID nobody로 내려가 proxy를 exec한다. 잘못된 서비스/host/외부 네트워크/기동 timeout과 권한 강등 순서를 포함해 Python 78개가 통과했다. Preview에만 helper hash `fbdefb9962e8236b8a2d540afc9d7fe9833bb38388e7ee43e6aa0514984389a8`를 적용했고 이전 파일은 `/root/build-lab-loopback-before-reboot-fix`에 보존했다. 아직 Git 커밋/게시 및 host/builder 코드 동기화는 하지 않았다.

수정 후 두 번째 재부팅에서 boot ID 변경, 5개 healthy 컨테이너·같은 이미지/볼륨/컨테이너 ID, 회원 0·가상 업체/제휴 각 1개 유지, 기존 Storage marker와 private signed object smoke, 앱 health/합성 상세 HTTP 200을 확인했다. 두 프록시의 UID 65534, effective capabilities 0도 실제 process에서 확인했다. Chrome에서 재접속 후 합성 제휴 상세를 검증하고 screenshot을 보존했다. 앱 출처의 경고/오류 0, 브라우저 확장 출처 경고 12, 출처 불명 0이다.

로컬 `verify-loopback-reboot-fix-release-1.log`는 exit 0, E2E 83개, 실패/오류/skip/retry 0, XML 110.390초로 완료했다. 전체 2495줄에는 기존 검토된 startup/admin full-reload 3개와 rollback mock 진단 4개만 있었다. 새 오류 서명이 없으며 실패 ledger에 재부팅 원인·수정·실증을 기록했다. 다음 단계는 수정 게시/설치 상태 정리 후 timer 활성화 및 작은 변경의 stopped/running × cold/warm 각 3회 계측이다. 기존 운영 환경 전환은 하지 않는다.

## 최신 로컬 보완: 연속 변경 처리

기존 최신 tip polling은 빌드 중 도착한 중간 SHA와 이전 SHA의 배포를 건너뛸 수 있어 수정 중이다. 로컬 제어기는 별도 bare history에서 고정 실험 브랜치의 새 커밋을 위상 순서로 수집하고, 최대 64개의 pending 큐와 cursor를 먼저 저장한다. fast-forward 이력이 아니거나 수집이 불완전하거나 한도를 넘으면 요청을 버리지 않고 중단한다. push 이벤트를 수신하는 방식은 아니므로 한 push에 여러 커밋이 있으면 각각 빌드하며, 강제 push는 지원하지 않는다. 실제 Git 저장소의 연속 커밋·되돌림·없는 SHA 테스트를 포함한다.

완료된 이전 SHA의 배포는 최신 tip과 분리한다. 큐의 첫 SHA를 실행하고 다음 요청을 보존하며, 대기 요청이 있으면 유휴 종료하지 않는다. 실행 요청 전에 SHA와 dispatch intent를 저장하므로 guest 응답 유실 시 자동으로 재실행하지 않는다. 다음 tick에서 해당 SHA의 결과를 확인하며, 실제 실행 여부가 불확실한 실패는 진단 후 복구해야 한다. 빌더는 고정 브랜치 전체 이력을 받아 요청 SHA가 현재 tip의 조상인지 검증한다. 이로 인한 source 준비 시간은 전체 경로 측정에 포함한다.

Python 테스트 72개 및 diff 검사가 통과했고 30e0ed83으로 게시 및 host/builder 설치를 완료했다. 실제 연속 push·큐 복구 검증은 남았다. 실행 중인 optimization matrix 파일은 교체하지 않는다.

- [x] Issue #497, dev 기준 SHA 및 별도 작업 브랜치 준비.
- [x] 빌드 VM 4970의 KVM 부팅·SSH·Docker·QEMU agent 확인.
- [x] 전용 사설망·운영 주소 차단·전송 상한 구성 및 연결 검사.
- [x] 기준 코드의 탐색 cold/warm gate와 SHA·83 E2E 검증.
- [x] 실제 VM 자원 조합별 cold/warm 각각 최소 3회.
- [x] 고정 자원에서 코드 최적화별 cold/warm 각각 최소 3회.
- [ ] 브랜치 push → 기동 → 빌드 → 배포 → 유휴 종료 실증.
- [x] Preview VM 4971의 디스크·게스트 도구·새 합성 환경값 준비.
- [x] 합성 DB·스토리지·서비스 실행 및 외부 동작 차단 실증.
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

## 2026-09-27 측정 이력

이하 절은 당시 진행 기록이다. 현재 실행 및 완료 여부는 문서 상단과 체크리스트를 기준으로 하며, 아래의 실행 중·미게시·미설치 표현을 재실행 지시로 해석하지 않는다.

PVE host의 `build-lab-497-resource-matrix.service`는 06:19:29 KST에 success/inactive/MainPID 0으로 종료했다. VM 4970의 실제 2/4/8 vCPU 및 6144 MiB, gate 컨테이너 5120 MiB에서 각 cold/warm 3회, 총 18회가 모두 유효하다. 기준 SHA·archive와 83 E2E 계약을 유지했으며 실패·OOM이 없다. 이 CPU unit은 재시작 대상이 아니다.

4 vCPU를 효율 기준으로 선택했다. 2→4 vCPU는 cold 약 18.5%, warm 약 20.0% 단축인 반면 4→8 vCPU는 CPU를 두 배 할당해 cold 약 6.1%, warm 약 6.7% 단축이다. 가장 짧은 CPU 비교 시간은 8 vCPU지만, 나머지 VM을 위한 여유와 추가 할당 대비 개선 폭을 고려해 이후 실험은 4 vCPU로 고정한다.

CPU unit 종료·guest busy=false를 확인한 뒤 `de9bc0851a0da8ef0ccf1598f744a805f581206d` 실행 파일을 host와 빌드 VM에 설치했다. 이전 코드는 각각 `installed-before-<SHA>`와 `/root/build-lab-before-<SHA>`에 보존했다. 두 환경에서 Python 59개가 통과했다. RAM 비교는 `build-lab-497-ram-matrix.service`, 최초 MainPID 55984로 06:22 KST에 시작했다. 재개 시 이 unit의 실제 상태를 먼저 확인한다. 4 vCPU를 고정하고 VM/container를 각각 6144/5120 MiB와 8192/6144 MiB로 비교하므로 VM 메모리만의 효과가 아닌 실제 메모리 구성 비교다. 각 cold/warm 3회이며 `ram-` 실행 이름으로 CPU 결과와 분리한다. 첫 `ram-vm4c6g-cold-1`은 388.662초로 통과했고 나머지는 진행 중이다. 실행 중인 RAM 측정 코드는 교체하지 않는다.

- 실제 VM 2 vCPU/6144 MiB cold/warm 중앙값은 475.833/450.771초, 4 vCPU는 387.796/360.576초, 8 vCPU는 364.294/336.516초다. 모든 조건 n=3이며 RAM 및 코드 최적화 선택은 미완료다.
- 이전 탐색은 VM 8 vCPU/8192 MiB에서 컨테이너 2 CPU/5120 MiB만 제한했다. cold-1 452.415초, warm-1 426.275초, cold-2 456.580초다. 세 실행 모두 83 E2E 통과, 실패/오류/skip/retry 0이다. 실제 VM 조건별 통계와 섞지 않는다.
- 탐색 guest matrix는 cold-2 완료 및 Docker 실행 없음 확인 후 정상 종료했다. MainPID 0/inactive, guest busy false를 확인했으며 재개 대상이 아니다.
- cold는 새 workspace 및 npm/Next cache 없음이다. gate image는 준비되어 있고 host page cache는 통제하지 않았다. warm은 동일 SHA의 성공 결과에서 npm 및 두 Next cache만 복사한다. 준비 시간을 별도 기록한다.
- cgroup memory.peak는 파일 캐시 등을 포함하므로 앱 RSS로 해석하지 않는다. guest 메모리는 MemTotal-MemAvailable의 1초 표본 최댓값이다.
- 성공한 cold/warm 쌍의 `result.json`, `phases.json`, `gate.log`, `validated-gate.json`을 보존하고 재생성 가능한 work만 해제한다. 실패한 쌍은 보존하며 자동 재시도하지 않는다.
- gate 시간은 이미지 준비·패키징·전송·배포를 포함하지 않는다. GitHub 전체 job 시간과 직접 동일 범위로 비교하지 않는다.
- 비교 중 PVE 전력 정책은 `amd-pstate-epp`, governor `powersave`, EPP `balance_power`, boost `0`으로 확인했다. 기존 저전력 설정을 변경하지 않았다. 따라서 이 결과는 해당 정책에서의 실제 운영 후보 성능이며, 이 CPU의 최대 성능이나 GitHub runner와 동일한 주파수 조건을 뜻하지 않는다. 호스트 전력 정책 변경 효과는 이번 VM 자원 비교와 섞지 않는다.

## 인프라

- VM 4970: Debian 12, 80 GiB 디스크, 10.77.49.10, 자동시작 비활성. 현재 자원은 측정 스크립트가 바꾸므로 live config를 확인한다.
- VM 4971: Debian 12, 4 vCPU/4096 MiB/40 GiB, 10.77.49.20. 측정 간섭 방지를 위해 정지했다.
- vmbr497 및 전용 nft 테이블: 기존 vmbr0 재시작 없이 NAT, private/CGNAT/운영 공인 IPv4/호스트 관리 접근 차단. 운영 DNS는 네트워크 적용마다 다시 조회하며 실패 시 중단한다.
- VM NIC rate는 빌드 8, Preview 2다. PVE rate 단위에 따라 해석하고 실제 전송량도 별도 관측한다.
- 외부 HTTPS 성공, 운영 LAN SSH·PVE 8006·호스트 SSH·Tailscale SSH 차단을 실제 확인했다. SSH host key는 신뢰된 guest agent로 대조했다.
- `build-lab-497-network.service`는 enabled다. PVE 자체 재부팅 복원은 아직 검증하지 않았다.

## 자동 실행·배포 구현

호스트의 브랜치 제어기는 설치했으나 timer는 disabled/inactive다. guest agent 및 request worker의 초기 버전도 설치되어 있다. root 소유 제어 코드는 브랜치에서 자동 갱신하지 않는다. host controller가 resource-matrix lock을 존중하는 것은 실제 PVE 호출에서 `wait-resource-matrix`로 확인했다.

최신 로컬 초안에는 완료 결과 검증, PVE가 두 실험 게스트 사이에서 수행하는 제한된 artifact 전송, Preview의 SHA/해시/image label/내부 네트워크 검사 및 정상 응답 receipt가 추가되어 있다. 이 최신 배포 경로는 아직 설치·실행하지 않았다. 아래 일회용 전송 인증의 설치·실제 전송, DB/스토리지 준비, 브랜치 push 및 전체 경로 측정이 남았다. 실패한 빌드/배포는 자동 반복하지 않는다. 빌드 origin은 실험 서비스의 loopback 주소로 설정하며, 빌드 VM에 운영 또는 Preview 비밀값을 제공하지 않는다.

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

## 비교 실행기 및 집계

캐시 비교 실행기는 동일 후보 SHA와 immutable gate image ID를 고정하고 off/on을 번갈아 실행한다. 각 변형 cold/warm 3회, 동일 VM 및 container 자원이며 resource-matrix lock을 공유한다. 후보 source archive hash와 이미지 ID를 검증하고 실패 실행은 재시도하지 않는다. 이 실행기는 로컬 준비 단계이며 아직 VM에 설치하지 않았다.

집계기는 SHA·VM CPU/RAM·container memory·cache mode·최적화 여부·측정 profile이 다른 결과를 합치지 않는다. 중복/실패/OOM/비정상 수치 및 83 E2E 계약 위반을 거절하고 3회 미만은 incomplete로 표시한다. 현재 수집한 CPU 결과 5개 중 2 vCPU cold 3회 중앙값은 475.833초(474.723~476.279초)다. 최고 cgroup 메모리는 5368709120바이트로 한도에 닿았으나 OOM은 없었으며 파일 캐시를 포함한다. warm 3회도 완료했으며 450.771/447.966/451.214초, 중앙값 450.771초로 cold 대비 약 5.3% 단축이다. 여섯 실행 모두 83 E2E와 결과 SHA 계약을 통과했다. Python 계약 테스트는 41개 통과했고 verify:change도 통과했다. 기존 mock rollback 진단 4개 외 새 오류는 없다. 05:02 KST에 VM 4970이 4 vCPU/6144 MiB로 전환되어 cold-1을 시작했다. 같은 시각 기존 production/preview의 /api/health는 모두 HTTP 200이었다. 이는 해당 시점의 가용성 확인이며 운영 무영향 전체를 증명하지는 않는다.

## 전체 경로 시간 기록 준비

로컬 실행기는 sourceReadyAt, gateImageReadyAt, gateStartedAt, gateFinishedAt, packagingStartedAt을 기록하며 guest/host 경계에서 유한한 숫자와 시간 순서를 검증한다. 전송 receipt는 다운로드 완료, Preview 기동 요청·SSH 준비, 업로드 시작·완료, archive 크기를 분리한다. 따라서 기존 transferStartedAt~transferFinishedAt 전체를 순수 전송 시간으로 해석하지 않는다. host controller는 SHA별 observed/boot-requested/dispatched/deployment-started/ready/shutdown-requested 이벤트를 별도 보존한다. 이 변경은 아직 설치하지 않았고, 실제 push 요청 시각과의 결합 및 전체 경로 검증은 남아 있다. 관련 Python 테스트 42개가 통과했다.

## 첫 4 vCPU 결과의 단계 비교

4 vCPU/6144 MiB cold-1은 387.862초, 83 E2E 및 zero failure/error/skip/retry로 완료했다. 2 vCPU cold 중앙값 475.833초 대비 약 18.5% 짧지만 1회이므로 자원 선택의 최종 통계로 사용하지 않는다. 단계 marker 간 시간은 install 46.20초, lint 38.77초, typecheck 31.87초, Node/unit test 묶음 34.62초, real compile 49.90초, fixture compile 50.69초다. 2 vCPU cold의 test 묶음은 약 81.6초, 두 compile은 약 60초였다. 컴파일 marker 구간은 전체 Next build 시간이 아니며 누락된 후처리/trace/검사 구간과 혼동하지 않는다. 4 vCPU warm-1은 같은 matrix process에서 실행 중이다.

## 연속 push 캐시 및 선택 자원 적용 준비

자동 빌드의 임시 자원 하드코딩을 제거했다. root 소유 `/etc/build-lab-497/profile.json`에 cpus, vmMemoryMiB, containerMemoryMiB, stableLabCache, reuseCache를 선택해야 실행되며 guest CPU·메모리와 불일치하면 중단한다. 아직 최적 조합을 선택하거나 설정 파일을 설치하지 않았다.

성공한 이전 request의 캐시를 재사용할 수 있게 연결했다. 기본 benchmark는 동일 SHA만 허용하며, request 경로가 명시적으로 cross-SHA를 허용하더라도 gate image ID·lockfile·Next 설정·npm 정책·Node 버전·public origin의 fingerprint와 성공한 83 E2E 계약이 맞아야 한다. 캐시 조건이 달라지면 cold로 진행하고 모든 검사와 결과물은 새로 생성한다. latest-success는 이미지 패키징까지 성공한 뒤에만 교체한다. 실제 연속 push 및 저장공간 보존 정책 검증은 남아 있다. 관련 Python 테스트 46개 통과.

## GitHub 비교 기준 반복 준비

기존 GitHub run 36247463568의 head SHA가 기준 308281074ed752b6cccce693d27755da13dd675f와 일치하고 attempt 1 성공임을 API로 재확인했다. workflow 전체는 809초이며 build job 563초, publish job 238초다. 보존한 동일 job 108419205216의 marker에서 install 시작~app packaging 시작은 466.709초다. 이는 VM gate 시간과 근접한 범위지만 정확히 동일 시작/끝 marker는 아니며 packaging·게시·서버 배포는 포함하지 않는다.

1회 과거 기록을 반복 비교 결과로 취급하지 않기 위해 실험 브랜치 전용 Isolated Build Lab Baseline workflow를 준비했다. 해당 workflow 파일 변경 push에만 실행되며 contents:read와 credential 미보존 checkout을 사용한다. 기준 SHA/archive hash·기존 gate image source를 고정하고 container 2 CPU/5120 MiB에서 cold/warm 3회씩 순차 실행한다. 이미지 게시·운영 배포·운영 비밀값 접근은 없다. GitHub host 메모리 표본은 전체 runner 값이므로 전용 VM 메모리와 직접 비교하지 않는다. 현재 workflow 경계 테스트는 통과했으며 전체 release 검증은 진행 중, push 및 원격 실행은 아직 하지 않았다. 이 파일을 push하는 단계의 예상 Actions는 기존 0개에서 실험 workflow 1개로 달라진다.

## GitHub 실험 publication 사전 검증

전체 local Release 두 번 모두 83 E2E, 실패/오류/skip/retry 0이다. 처음과 새 개발 캐시 실행 모두 시작 1회·관리자 전환 2회의 full-reload 경고가 있었다. 별도 fresh-server 첫 경로 진단은 Next WebSocket의 hadRuntimeError=false와 HMR fetch 실패, failed HMR request 1개, page/console error 0개를 기록했다. 설치된 Next 소스 및 기존 Issue #435 기록과 대조해 개발 HMR의 비런타임 분기로 분류했고 원본 로그를 보존했다. 경고를 숨기거나 테스트를 완화하지 않았으며 이 검토는 실험용 publication 범위다. GitHub의 production fixture gate 6회는 별도로 검증해야 한다. 타임스탬프 Python 3.9 호환 회귀 테스트를 포함한 Python 47개도 통과했다.

## 후속 준비 및 검증 범위

GitHub 비교 workflow는 `c1a33345d6450f939f47f13d944a62205f6604af`에서 [run 36269916621](https://github.com/MyKnow/ssartnership/actions/runs/36269916621) attempt 1로 성공했다. 구조 감사는 로그·annotation 수집 완료, 실패/skip step 및 오류 signature 없음이다. 여섯 결과는 기준 SHA가 일치하고 각각 83 E2E, 실패/오류/skip/retry 0, OOM 없음이다. 앞 절의 미게시 상태는 당시 준비 기록이며 현재 상태가 아니다.

GitHub cold 368.101/369.996/365.341초의 중앙값은 368.101초, warm 387.391/379.660/382.513초의 중앙값은 382.513초다. container는 2 CPU/5120 MiB이고 runner는 4 CPU를 노출하므로 실제 2 vCPU VM과 topology까지 같지는 않다. cold 설치는 18.1~20.7초로 PVE의 약 46초보다 빠르다. warm 설치는 16.4~17.5초지만 real/fixture compile 구간이 cold의 약 51초에서 약 55~58초로 늘었다. 기존 캐시 복사만으로 전체 실행이 빨라진다고 볼 수 없으며 원인과 최적화 효과는 별도 비교한다. 단순 VM 이전의 절대적인 속도 우위를 입증한 결과가 아니다.

합성 데이터 파일 `deploy/build-lab/seed-preview.sql`은 실제 회원 없이 가상 업체와 제휴 한 곳만 추가한다. 기존 회원·업체·제휴 데이터가 있으면 트랜잭션을 거부하며, 일반 migration 경로에는 포함하지 않는다. Preview 초기화 전에 이 파일을 `/srv/build-lab-497/seed-preview.sql`에 설치해야 한다. 파일 누락, 공개 포트, 외부 네트워크, 예상하지 않은 서비스는 컨테이너 생성 전에 거부한다. 실제 SQL 적용·기존 데이터 보호·화면 검증은 아직 남았다.

`timed_git.py`는 opt-in PATH shim으로 canonical release의 실제 push 시작·종료를 기록한다. `/usr/bin/git`으로 전달하며 고정 실험 브랜치·origin URL·정해진 push 인자만 측정한다. SHA별 최초 실패 기록도 덮어쓰지 않는다. `.tmp/build-lab/push-events/<SHA>.json`의 pushStartedAt을 host 이벤트와 결합하고, 로컬 prepush 검사 시간을 배포 지연으로 합산하지 않는다. 실제 push 연결 검증은 아직 남았다.

`ephemeral_transfer.py`는 PVE의 Python cryptography와 OpenSSH agent를 사용한다. 개인키를 메모리에서 생성하여 stdin으로 agent에 전달하고 파일에 쓰지 않는다. `/run`의 전용 임시 디렉터리에는 공개키·known_hosts·agent socket만 있으며 전송 종료 시 agent와 디렉터리를 정리한다. 키 유효시간은 1800초다. `transfer_identity.py`는 QGA를 통해 실험 게스트 두 곳에만 공개키를 설치하고, 기존 관리용 authorized_keys를 보존한다. 새 키는 `from="10.77.49.1",restrict`를 적용한다. 호스트 키도 QGA에서 조회해 StrictHostKeyChecking으로 사용하며 agent forwarding은 하지 않는다. 두 게스트에 root 소유 helper를 설치한 뒤 실제 전송을 검증해야 한다.

PVE에서 guest 변경 없이 수행한 agent 시험은 identity 1개, 개인키 파일 없음, 종료된 agent와 제거된 임시 디렉터리를 확인했다. Python 계약 59개가 통과했다. Preview seed 준비 시점의 full Release는 83 E2E(191.721초), 실패/오류/skip 0 및 검토된 HMR 경고 3회였다. 후속 push timing의 Quick gate도 통과했다. 이후 추가한 전송 인증 코드는 집중 검사와 PVE agent 시험까지 확인했으며 전체 변경 gate·게스트 적용·전송·배포 실증은 남아 있다. 이 기록은 운영 전환 승인이나 성능 실증 완료를 뜻하지 않는다.
