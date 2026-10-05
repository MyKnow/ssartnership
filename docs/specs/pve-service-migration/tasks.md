---
title: Production·Preview PVE 이전 작업 목록
type: task-list
status: completed
authority: evidence
---

# 작업과 증거

> 종료 정리(2026-10-05): Issue #523은 2026-10-02에 종료됐고 변경은 #524·#525로 `main`에 반영됐다. 이 문서는 완료 증거이며 현재 운영 절차는 runbook을 따른다. 미체크로 남은 "독립 회선의 공개 HTTPS 검증 및 저장소 통합 절차"는 저장소 통합이 끝났고, 독립 회선 확인과 상시 외부 polling만 [기술 부채 원장](../../plans/tech-debt.md#종료-issue에서-이관한-잔여-항목)으로 옮겼다.

- [x] Issue #523 생성, origin/dev `5e0d4bf8a171f2bc693982da2977d3debef104de`에서 `feat/523-pve-service-migration` 시작.
- [x] PVE 장치 식별·공간·기존 게스트와 원본 앱·DB·Storage·백업 경계 확인.
- [x] 사용자 승인: local-lvm VM 5200 80GiB, 5201 40GiB, 5202 32GiB 새 가상 디스크.
- [x] 공식 checksum과 일치하는 Ubuntu cloud image로 세 VM 생성·부팅.
- [x] 현재 자체 호스팅 migration ledger는 두 환경 모두 208개다. Production의 기존 Supabase ledger 206개는 이전 공급자의 보존 이력이며 현재 적용 기준과 구분한다.
- [x] guest 설치·관리 host key·주소 안정성·파일 시스템 확인. 공유기에 세 VM의 DHCP 예약을 저장했고 cloud-init 정상 종료·실패한 서비스 0개 및 재부팅 후 같은 IP·host key 유지를 확인했다.
- [x] Preview 일관된 복사·전량 대조·실제 자원/인증/Storage 검증. 준비용 snapshot이며 최종 전환용 복사는 별도다.
- [x] Mac Production 암호문을 새 guest에서 격리 복원·전량 대조.
- [x] 공용 ingress·두 환경 수집기·접근 제한·기존 공유 서비스 경로 및 Alertmanager 실제 가동 확인.
- [x] 두 환경 최종 snapshot·원본 writer 정지·공개 전환·단일 자동화 소유자 확인.
- [x] 새 Production → Mac·PVE 암호문 백업과 Mac 사본의 실제 격리 복원 확인.
- [x] 공개 서비스 중단 범위를 포함한 사용자 승인 후 새 VM 세 대 순차 재부팅·공개 서비스 복구 확인.
- [x] 준비 시 Quick Gate·문서 검사·빌드·E2E 86개 통과. E2E는 기존 사용자 프로세스가 점유한 3100 포트를 보존하고 3173 포트에서 검증했다. 최종 보안 감사 실패는 아래에 별도로 기록한다.
- [x] 최종 Production dependency audit의 새 node-forge 취약점을 제거하고 로컬 release 재검증.
- [x] 전환 시각·최종 데이터·공개 경로·자동화·백업·감시 증거와 잔여 위험 기록.
- [ ] 독립 회선의 공개 HTTPS 검증 및 저장소 통합 절차 완료.

## 2026-10-02 01:00 KST 준비 증거

| VM | 역할 | LAN 주소 | 할당 자원 | 측정한 남은 메모리 |
| --- | --- | --- | --- | --- |
| 5200 | Production 앱·DB·Storage·수집기 | 192.168.1.182 | 2 vCPU·4GiB·80GiB | 약 2.77GiB |
| 5201 | 개인용 Preview 앱·DB·Storage·수집기 | 192.168.1.69 | 1 vCPU·2GiB·40GiB | 약 0.94GiB |
| 5202 | Caddy·공용 감시 | 192.168.1.2 | 1 vCPU·2GiB·32GiB | 약 1.31GiB |

측정 시 세 VM 모두 swap 사용량 0이었다. 운영 VM의 Alertmanager는 설정만 검증했고 아직 실행하지 않았으므로, 이 수치는 전체 운영 및 부하 시험 결과가 아니다.

- Production 앱 SHA `e8b271f96dc5be8b90aad325d9d1f7d0f7607485`, Preview `5e0d4bf8a171f2bc693982da2977d3debef104de`와 실제 이미지 ID를 보존했다. 두 대상의 배포 수신기를 직접 실행하여 `unchanged`를 확인했고 대상 예약 실행은 비활성 상태다.
- Mac의 21:00 KST Production 백업 `e7cf49ca-576a-4236-bb9a-10c62a03180e` 암호문 SHA-256 `f0f6e2c48c81fe35667fb0a016f431bea60b663a77c4fa177800e5ecfc6d9939`를 확인했다. 새 Production에서 격리 복원한 149개 테이블·184,499행, Storage 931개 파일·43,451,117바이트를 전량 대조했다. Mac에 평문 백업이나 복구 키 파일을 만들지 않았다.
- 원본 Preview의 일관된 snapshot을 새 Preview에서 격리 복원했다. 149개 테이블·126,130행, Storage 825개 파일·39,953,694바이트 및 파일 메타데이터를 대조했다. 임시 원본 정지는 약 39초였고 이후 원본 서비스를 재개했다.
- Preview의 로그인 성공·안전한 세션 쿠키, 외부 Origin 거부, 비공개 프로필 이미지의 익명 접근 거부 및 허용된 다운로드의 바이트 일치를 확인했다. 임시 시험 암호는 대상에서만 변경한 뒤 원래 값으로 복구했다. 전환 시에는 인증 로그까지 포함해 원본의 최종 snapshot으로 다시 교체한다.
- Preview 페이지 10회 순차 요청에서 첫 응답 시간은 약 63~121ms였다. 시험 중 컨테이너 OOM은 없었다. 동시 빌드나 높은 동시 접속에 대한 용량 보증은 아니다.
- 앱 VM의 5개 relay 포트는 운영 VM에서 정상 응답했고 PVE 호스트에서 직접 접근한 요청은 차단됐다. DB 포트는 게시하지 않았다. 관리 페이지의 인증·Origin·읽기 전용 요청 제한도 확인했다.
- 새 운영 VM의 4개 앱·API 주소는 최종 복사 검증 전 공개 쓰기를 방지하도록 503을 반환한다. 기존 공개 사이트는 여전히 노트북이 서비스한다. MALMOA 두 환경과 ClayFarm 경로는 새 운영 VM에서 노트북의 제한된 private relay를 통해 200 응답을 확인했다.
- 두 장치의 기존 전용 백업 키로 새 Production의 제한된 SSH `list`가 작동하고 임의 명령은 거부되는 것을 확인했다. 정기 Mac·PVE 백업 연결은 아직 원본에 연결되어 있다.

## 2026-10-02 공개 전환 증거

- 08:47:24 KST에 원본 writer와 예약 실행을 정지했다. 실행 중인 작업이 끝난 뒤 두 환경을 동시에 고정하고 08:48:46에 최종 snapshot 확보를 마쳤다. 최종 전환의 서비스 중단은 09:00 공개 확인까지 약 13분이었다. 그 사이 공유기 세션 만료로 재로그인이 필요했다.
- Production 최종 snapshot은 149개 테이블·184,754행, Storage 932개 파일·43,460,039바이트다. Preview는 149개 테이블·126,130행, 825개 파일·39,953,694바이트다. 대상의 network-none 복원에서 모든 행·파일 hash·Storage 참조·파일 메타데이터가 일치했다.
- 두 환경 각각 8개 원본 컨테이너의 모든 환경 값과 앱 env 파일 hash를 대조했다. 운영·Preview 앱 SHA와 이미지 ID, 회원 인증 자료 및 두 DB system identifier를 보존했다. 현재 자체 호스팅 ledger 208개와 소스 migration checksum을 검증했다.
- 공유기의 WAN/LAN 80·443을 모두 운영 VM `192.168.1.2`로 변경했다. 재조회 후 저장된 규칙과 기존 2222 연결 보존을 확인했다. 09:00 두 앱의 실제 공개 도메인에서 HTTPS 200 및 `X-SSARTNERSHIP-Ingress: pve-5202`를 확인했다.
- 대상의 실제 공개 API 인증 읽기 200, 외부 Origin 403, 비공개 Storage의 익명 접근 거부 및 허용된 파일 바이트 일치를 두 환경에서 확인했다. 공개 앱도 브라우저에서 렌더링했다. 익명 관리 요청은 두 infra origin 모두 Basic 인증 401이며 Preview 관리 주소는 인증을 통과한 뒤 공용 대시보드로 이동한다.
- 09:00:13에 단일 자동화 소유자 이동을 마쳤다. 원본 수신기·11개 Cron·백업·공개 Caddy는 중지했으며 재실행 방지 marker와 정지된 원본 데이터는 보존했다. 원래 비활성인 Apple Wallet 작업은 대상에서도 비활성이다. 대상 수신기 두 개와 edge 복구 서비스를 직접 실행해 성공 및 유한한 다음 timer 실행 시각을 확인했다. 과거의 monotonic timer stamp 복사만으로 다음 실행을 보장하지 않는다.
- 09:00:34에 새 Production에서 온라인 백업 `01bc8904-28c1-4c58-817d-d142b789b468`을 생성했다. 81,325,640바이트 암호문의 SHA-256은 `03b907a7269cd7355ffe60c8060aeb92b876a4c22958274137805554d777ae00`이다. Mac·PVE 전용 키와 기존 host pin·백업 이력을 보존하며 새 Production으로 수신 경로를 바꾸고 두 장치의 전체 hash와 ACK를 검증했다.
- 09:03:34에 위 Mac 암호문을 새 Production의 별도 비공개 대상으로 실제 복원했다. 149개 테이블·184,762행과 Storage 932개 파일·43,460,039바이트가 백업 시점과 전량 일치했다. 최종 원본 snapshot 뒤 새 서비스의 정상 쓰기로 늘어난 행은 이 새 백업에 포함된다. Mac에는 평문 백업을 만들지 않았고 복구 키도 새 guest에 파일로 저장하지 않았다.
- 09:04:29에 공용 감시의 9개 scrape target이 모두 정상이며 firing 경보가 없는 상태에서 기존 Production·Preview 알림 경로를 활성화했다. 준비 중 경보를 외부로 발송하지 않았다. Grafana의 비밀이 없는 provisioning 디렉터리는 0755, 파일은 0644로 수정했고 인증된 API에서 10개 패널과 `production,preview,operations` 환경 선택을 확인했다. 대시보드 화면은 Basic 인증 장벽으로 새 렌더링을 검증하지 못했다.
- 공용 Prometheus는 신규 수집 이력을 사용한다. 노트북의 정지된 기존 감시 데이터는 보존했으며 서로 다른 TSDB를 합치지 않았다. MALMOA 두 공개 홈은 200, ClayFarm `/health`는 200이다. 이 서비스들의 private relay 때문에 노트북은 계속 필요하다.

## 2026-10-02 순차 재부팅 복구 증거

사용자가 공개 서비스와 MALMOA·ClayFarm의 일시 중단 범위를 확인하고 VM 5200·5201·5202 순차 재부팅을 승인했다. 각 VM의 새 boot ID와 공개 HTTPS 복구를 확인한 뒤 다음 VM으로 진행했다. PVE 호스트·다른 게스트·노트북의 전원은 변경하지 않았다.

| VM | 재부팅 요청 KST | 공개 복구 확인 KST | 요청부터 확인까지 |
| --- | --- | --- | --- |
| 5200 Production | 09:15:10 | 09:16:00 | 약 50초 |
| 5201 Preview | 09:16:02 | 09:16:56 | 약 54초 |
| 5202 공용 ingress·감시 | 09:16:58 | 09:18:21 | 약 83초 |

- 세 VM 모두 예약 IP·관리 host key·모든 컨테이너 이미지가 유지됐다. 컨테이너 23개가 자동으로 복구됐고 cloud-init 정상 종료·실패한 서비스 0개·OOM 없음 및 두 앱의 실제 공개 HTTPS 200을 확인했다. 표의 시간은 요청부터 검증 완료까지이며 실제 연결 중단 시간을 정밀 측정한 값은 아니다.
- 두 환경의 인증된 API 읽기 200, 외부 Origin 403, 비공개 Storage의 익명 접근 거부와 허용된 파일 바이트 일치가 다시 통과했다. 공개 health 검사 4개도 앱 200·두 infra 익명 401 계약을 통과했다.
- 공용 감시의 9개 target이 모두 정상이며 firing 경보 0개다. 인증된 Prometheus·Alertmanager·Grafana API와 Preview 관리 주소의 인증 후 이동도 확인했다. MALMOA 두 공개 홈과 ClayFarm `/health`가 200으로 복구됐다.
- 앱 relay의 5개 포트는 공용 ingress·감시에서 정상 접근되고 PVE 호스트의 직접 TCP 연결은 재부팅 후에도 차단된다. 두 환경의 배포 수신기·Production 백업·11개 Cron 및 공용 edge 복구 timer는 활성·자동 시작이며 다음 실행 시각이 유한하다. Production 수신기는 09:21:00, Preview는 09:21:36에 부팅 후 자동 실행해 종료 코드 0으로 완료됐다. 원본 writer·예약 실행·공개 Caddy는 계속 정지 상태이고 재실행 방지 marker가 유지된다.
- 09:15:15에 예약된 PVE 암호문 백업 수신 작업은 Production 재부팅과 겹쳐 실패했다. 해당 수신 서비스만 09:20:08에 다시 실행해 종료 코드 0으로 복구했고 암호문 전체 hash·수신 ACK와 활성 정기 timer를 확인했다. 다른 서비스의 실패 상태를 지우거나 호스트를 재부팅하지 않았다.
- 재부팅·공개 경로·감시·자동화·백업 수신 검증을 원본 서버와 공용 운영 VM의 root 전용 `/srv/ssartnership-migration-523/post-reboot-proof.json`에 저장했다. 기존 공개 전환 증거는 덮어쓰지 않았다.

## 남은 검증과 통합

현재 공개 경로 증거는 같은 집 네트워크의 실제 DNS·HTTPS 및 브라우저 접속이다. 외부 웹 조회 도구는 두 사이트에 접근하지 못했으므로 독립 회선 성공으로 기록하지 않는다. 기존 수동 공개 health workflow는 두 infra 주소의 익명 401 계약을 유지하며, 실행 전 GitHub Actions 운영 절차가 필요하다. 상시 외부 장애 감시와 이메일 실제 수신은 별도 증거다.

최종 `verify:change`는 문서 116개·설치/플랫폼/lockfile/migration 정책·lint·typecheck, Node 1,974개 중 1,965개 통과와 기존 설정 skip 9개·실패 0개, unit 133개 통과 후 Production dependency audit에서 실패했다. `passkit-generator@3.5.7`의 `node-forge@1.4.0`에 [RSA 서명 검증 취약점](https://github.com/advisories/GHSA-86w9-cpqp-85rv)이 보고되며 확인 시 패치 버전은 없다. 앱의 확인된 사용은 Apple Wallet 서명 생성이고 현재 두 환경의 Wallet 활성 플래그와 조정 timer는 비활성이다. 이 사실은 취약 의존성 해결이나 gate 통과를 의미하지 않는다. 원본 앱 이미지를 보존하며 advisory를 무시하거나 자동 의존성 교체로 숨기지 않았다. GitHub Actions skill의 failure ledger에 실패·노출 경계·남은 검증을 기록했으며 새 소스 release는 별도 교정과 검증이 필요하다.

6시간 간격 백업은 연속 WAL/PITR이 아니다. Production과 SATA 암호문 사본이 같은 PVE 호스트에 있으므로 PVE 사본은 독립 호스트 장애 영역이 아니다. Mac 사본도 항상 온라인이거나 지리적으로 분리되어 있음을 보장하지 않는다. Grafana 화면은 아래 후속 검증으로 확인했으며 독립 회선·보안 감사·저장소 통합이 남아 있으므로 전체 수용 기준 완료로 표시하지 않는다. 저장소 변경은 `feat/523-pve-service-migration`에 staging했으며 아직 커밋·푸시·병합하지 않았다.

## 2026-10-02 공용 감시 개편 적용·검증

- [x] Issue #523에 승인된 개편 범위·분리된 collector/발송기·검증·branch flow를 기록하고 구현했다.
- [x] 같은 Grafana UID에 46개 패널·8개 행을 적용했다. 내부 상태·활성 경보·서비스/DB·VM/물리 PVE·백업/실복원·Vitals·감시 자체 상태를 구분한다.
- [x] VM 5202의 독립 notifier/observer를 적용하고 두 앱 VM의 직접 운영 알림 자격 증명을 활성 container 및 private monitoring env에서 제거했다. 앱·DB의 가용성에 의존하여 알림을 발송하지 않는다.
- [x] Production critical 발생·복구는 운영자 이메일과 기존 PWA의 운영자 구독 3개, Preview warning 발생·복구는 이메일만 발송했다. 제공자 접수와 사용자 실제 수신을 각각 확인했다. 사용자는 아이폰 PWA·Naver 메일·Gmail 외부 감시 장애/복구 메일이 모두 도착했다고 확인했다.
- [x] PVE 호스트의 1분 수집 서비스와 source IP·전용 bearer token·POST·4KB 입력 제한을 승인받아 적용했다. 잘못된 source IP 403, 허용 source의 잘못된 token 401, GET 405 및 정상 자동 수집 204를 확인했다. SMART는 두 디스크 모두 정상이다.
- [x] 물리 CPU는 1초 `/proc/stat` 차분, 가용 메모리는 `MemAvailable`로 수집한다. PVE CLI의 첫 CPU 관측 0과 `MemFree`를 가용 메모리로 오해하지 않도록 수정하고 회귀 검증했다.
- [x] Production backup outcome timer와 OnFailure 지표 수집 drop-in을 적용했다. 기존 snapshot 수집 및 6시간 생성 주기는 유지했고 실제 09:03:34 KST 실복원 증거를 restore marker로 연결했다. 아직 새 부팅에서 종료한 backup job이 없으면 작업 결과를 데이터 없음으로 표시한다.
- [x] Healthchecks에 1분 heartbeat·2분 grace·Gmail 알림을 연결했다. 감시 엔진·발송기의 가용성 및 알림 실패 경보를 검사한 뒤에만 heartbeat를 보낸다. 외부 실패·복구 시험과 사용자 이메일 수신이 확인됐다. 이것은 공개 HTTPS 직접 polling이 아니다.
- [x] 재시도 시 성공한 이메일·푸시 구독은 재발송하지 않고 같은 본문·idempotency key를 유지한다. 발송 state의 재시작 후 보존을 확인했다. 운영자 외 회원 구독은 발송 대상에서 제외했다.
- [x] pinned Node 24.18.1 container에서 발송기·observer·PWA 핵심 테스트 10개 통과. Mac의 Node 24.19.0에서 host collector와 기존 감시/backup 회귀를 포함한 집중 테스트 26개·실패 0개·skip 0개, typecheck·ESLint·문서 검사, Compose/Caddy/amtool 및 두 promtool 규칙 suite를 확인했다.
- [x] 기존 lockfile과 일치하는 push 의존성 17개만 사용했으며 해당 subset의 npm advisory 조회 결과 취약점 0개, node-forge 포함 0개였다. 앱 전체의 node-forge 감사 실패는 해결된 것으로 처리하지 않는다.
- [x] 실제 Chrome에서 1440/820/360px 및 작은 화면 위험 확인용 320/390px를 캡처했다. Preview 환경 선택·전체 선택 복귀, 행 접기·키보드 펼치기, 호스트/백업/미연동 상태 표시를 확인했다. 문서 가로 폭은 각 viewport를 넘지 않았으며 Grafana 기본 breadcrumb와 긴 행 제목은 작은 폭에서 줄여 표시된다. 기본 UI 계약을 유지했고 고유 컴포넌트를 변경하지 않았다.
- [x] 최초 화면의 `Datasource prometheus was not found`를 수정했다. Grafana 13.2.1 이미지에 포함된 plugin 경로와 자동 설치/갱신 비활성화를 지정하고 read-only root를 유지했다. datasource health 및 실제 Grafana `/api/ds/query`의 46개 패널 쿼리 모두 200을 확인했다. TLS session 재사용으로 인증서 정보가 누락되던 수집도 수정했으며 실제 잔여 기간이 약 9.5~9.7주로 표시됐다.
- [x] 최종 live target 12개 모두 UP, 경보 규칙 23개 정상 평가, 활성 경보 0개, 두 앱 공개 도메인의 health 200 및 PVE ingress header를 확인했다. 관리 계정·앱 이미지·공개 전환 준비 플래그·DB/Storage는 보존했다.

버전별 적용 소스와 root 전용 rollback은 VM 5202에 보존했고 Mac의 ignored `.tmp/grafana-redesign-20261002/`에 설정·query·발송·hash 검증 증거, `.tmp/ui-qa/grafana-20261002/`에 화면 증거를 보존했다. 수신 URL/token/password/구독 원문은 이 증거에 포함하지 않는다. 반복 운영과 복귀 절차는 [공용 감시 runbook](../../operations/runbooks/self-host-observability.md#pve-공용-감시와-운영자-알림)을 따른다.

남은 경계는 독립 회선의 공개 HTTPS 직접 검증/상시 polling, 앱 전체 node-forge 보안 감사 교정, 사용자 요청에 따른 커밋·푸시·Preview 통합 및 Production promotion이다. 새 앱 이미지나 GitHub Actions 배포를 실행한 것으로 표현하지 않는다.

[명세](./spec.md), [기술 계획](./plan.md).


## 2026-10-02 main 승격 준비

사용자가 main 반영을 승인했다. passkit-generator/node-forge를 제거하고 고정 registry pkijs·asn1js와 기존 JSZip, Node native crypto로 Wallet 패스 서명을 구성했다. payload·manifest·certificate·키 설정·비활성 feature flag는 유지했다. 45개 Apple Wallet 집중 사례, 독립 OpenSSL detached CMS 검증, semantic types, canonical lockfile 및 Production/full dependency 정책이 통과했다.

완전한 로컬 release는 Node 1,989개 중 1,980개 통과·기존 platform skip 9개·실패 0개, unit 133개, Production build와 retry-free E2E 86개를 통과했다. 여섯 Next development full-reload notice는 기존 86-case lifecycle 위치와 같았고 다른 오류·retry·flaky는 없었다. 이 기록은 새 소스의 Preview/Production 배포 증거가 아니다. 정확한 CI·배포 SHA와 독립 외부 HTTPS의 최종 결과는 [Issue #523](https://github.com/MyKnow/ssartnership/issues/523)과 연결된 PR에 기록한다. 상시 외부 HTTPS polling은 현재 heartbeat와 구분하는 후속 경계다.
