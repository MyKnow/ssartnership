---
title: Production·Preview PVE 이전 기술 계획
type: implementation-plan
status: completed
authority: evidence
---

# 기술 계획

## 기존 시스템을 보존하는 이전

새 Ubuntu VM에는 Docker·Compose·guest agent를 설치한다. 기존 PVE bridge를 사용하며 호스트 네트워크·다른 게스트를 변경하지 않는다. 이미지 checksum과 PVE의 실제 장치·여유 공간을 확인하고 승인된 local-lvm 새 디스크만 사용한다. 관리 접속은 기존 PVE SSH를 경유하며 새 guest host key를 guest agent에서 확인한다.

각 환경의 현재 실행 이미지와 유효 Compose 설정을 먼저 수집한다. DB와 Storage는 승인된 일관성 검증 도구로 새 private 경로에 복원한다. 동일한 Docker 내부 subnet을 보존하여 기존 PostgreSQL 접속 정책과 수집기 권한을 유지한다. 서로 다른 이전 배포 경로를 참조하는 컨테이너는 실제 실행 설정을 기준으로 검증하며 하나의 오래된 Compose 파일로 추정하지 않는다.

앱 VM에는 앱·최소 Supabase·환경별 수집기를 두고 Prometheus·Grafana·Alertmanager와 Caddy는 운영 VM으로 모은다. 원격 upstream과 수집 포트는 운영 VM에서만 접근하도록 제한한다. 기존 관리 인증·알림 전달 계약을 유지한다. 별도 Prometheus DB의 원시 파일을 임의 합치지 않으며 과거 기록의 보존 범위와 신규 감시 시작 시점을 보고한다.

Grafana에 디렉터리를 bind mount할 때 비밀이 없는 provisioning·dashboard 디렉터리는 0755, 파일은 0644로 설치해 컨테이너의 비root 사용자가 읽을 수 있게 한다. 비밀 파일과 부모는 기존 private 권한을 유지한다. 인증된 dashboard API에서 실제 공급 여부와 환경 선택을 확인한다. 두 infra origin의 익명 Basic 401 계약은 유지하며 Preview 관리 주소는 인증 뒤 공용 대시보드로 이동한다.

`deploy/pve/compose.relay.yaml`은 기존 수신기가 사용하는 loopback 앱 포트를 유지하면서 운영 VM의 요청을 컨테이너 네트워크로 전달한다. `relay-firewall.service`를 Docker보다 먼저 실행하고, 원본 목적지 포트별로 운영 VM 주소만 허용한다. 다른 방화벽 chain을 비우지 않는다. 공유기 DHCP 예약과 실제 guest 주소를 함께 확인한다.

`compose.operations.yaml`의 Caddy 프로젝트 이름은 기존 자동 복구 도구가 사용하는 `ssartnership-edge`를 유지한다. `edge.Caddyfile`의 `PVE_PUBLIC_SERVICES_READY` 기본값은 0이며 앱·API 네 주소에 준비 중 503 응답을 반환한다. 두 환경의 최종 원본 snapshot 대조와 schema 검증 후에만 1로 변경하여 Caddy를 재생성한다. 이 값을 여는 순간부터 원본으로의 무조건 복귀를 금지하는 상태를 먼저 기록한다. 공개 전환이 끝난 뒤 [Issue #531](https://github.com/MyKnow/ssartnership/issues/531)에서 이 게이트를 제거했다. 환경 변수가 빠져도 공개 origin이 503으로 닫히지 않으며, 다시 점검 창이 필요하면 Caddyfile에 임시 응답을 넣고 validate 후 reload한다.

최초 이전에서는 MALMOA guest의 접근 정책을 유지하려고 `compose.legacy-relay.yaml`과 `legacy-relay-firewall.service`로 노트북의 private 9080 포트를 운영 VM에만 허용하고 MALMOA 두 환경·ClayFarm을 전달했다. 2026-10-02 [Issue #526](https://github.com/MyKnow/ssartnership/issues/526)의 후속 전환에서는 MALMOA를 공용 ingress VM에서 직접 연결하고 노트북 handler와 접근 허용을 제거했다. 이어 사용자 요청으로 ClayFarm API·노트북 relay·전용 firewall unit과 저장소의 legacy relay 배포 템플릿을 제거했다. 현재 경로·ClayFarm 종료 및 보존 범위·복구 절차는 [자체 호스팅 운영 문서](../../operations/runbooks/self-hosting.md#malmoa의-pve-직접-연결)를 기준으로 한다.

## 전환과 복귀

1. 원본 상태·소스 SHA·digest·migration checksum·백업 custody를 확인한다.
2. 새 VM과 Preview를 준비하고 원본을 계속 유지한다.
3. Mac에 보관한 Production 암호문으로 대상의 격리 복원 시험을 수행한다.
4. 운영 VM의 Caddy·감시·비공개 upstream과 공유기 연결 전환을 준비한다. 공유 ingress의 다른 서비스 경로도 시험한다.
5. 기존 배포·예약 쓰기 작업을 잠그고 원본 writer를 멈춘 뒤 최종 DB·Storage snapshot을 확보한다. 중단·복귀 의도를 서버 private 상태에 남긴다.
6. 검증한 대상만 공개하고 배포·예약 작업·백업 소유자를 이동한다. 공유기 80·443 연결과 새 guest의 주소 안정성을 확인한다.
7. Mac의 backup transport를 새 Production으로 이동하고 새 암호문·hash·복구를 확인한다.

새 서비스에 쓰기가 없을 때만 원본의 정지된 writer를 재개하여 복귀한다. 새 쓰기가 발생한 뒤에는 대상 변경분을 보존·조정하는 절차가 선행된다. 기존 소스와 백업은 전환 후에도 삭제하지 않는다.

전환 시 원본의 수신기·백업·예약 쓰기 timer를 정지하고 재실행 방지 marker를 둔다. 실행 중인 작업을 먼저 종료시킨 뒤 앱·Storage·수집기·DB를 순서대로 멈추고 snapshot을 확보한다. 원본의 정기 작업 활성 상태를 기록하여 원래 비활성인 Apple Wallet 조정 작업을 대상에서 켜지 않는다. 대상의 준비용 데이터는 삭제하지 않고 별도 경로로 보존한다.

공개 요청이 새 Caddy의 `X-SSARTNERSHIP-Ingress: pve-5202` 헤더와 정상 응답을 반환하는 것을 확인한 뒤에만 대상 예약 실행을 활성화한다. 원본 public Caddy는 그 뒤 정지하며 다른 서비스용 private relay는 유지한다. 관리 경로와 정지된 원본 데이터는 보존한다.

calendar timer의 이력을 보존하되 monotonic timer는 과거 stamp만 복사해 실행을 보장하지 않는다. 수신기·edge 복구 서비스를 직접 실행하고 성공 결과와 다음 실행 시각이 유한한지 확인한다. 이미 실행 중인 온라인 백업은 중복으로 호출하지 않는다.

Mac의 백업 전용 키는 Mac에 남기고 기존의 고정된 PVE SSH를 경유하여 새 Production에 접근한다. PVE의 전용 백업 키도 호스트에서만 사용한다. 새 guest host key를 확인한 뒤 기존 pin과 이력을 보존하며 backup transport를 갱신한다. 새 Production에서 실제 암호화 백업을 생성하고 두 장치의 hash·확인 응답과 격리 복원을 검증한다. 6시간 간격 백업은 계속 유지하지만 지속 WAL 전송이나 임의 시점 복구를 의미하지 않는다.

## 검증 경계

DB 복원 대조, 실제 앱/API 실행, 공개 TLS, 브라우저 인증, 정확한 SHA의 수신기 상태, 예약 작업 단일 소유, VM 재부팅, Mac 백업과 복구를 서로 다른 증거로 기록한다. 저장소 변경은 집중 검증 및 문서 검사를 통과한 뒤 통합하며 GitHub 작업을 유발하기 전 운영 skill과 실패 ledger를 확인한다.

[명세](./spec.md), [작업 목록](./tasks.md).


## 승인된 감시 보완 순서

Issue #523과 같은 `feat/523-pve-service-migration` 작업에서 별도 공용 notifier/observer, numeric host collector, backup outcome/restore proof collector, alert policies와 동일 UID의 Grafana provisioning을 준비한다. 앱/DB 접근은 최초 운영자 구독의 소유 검증과 private export에만 사용하고 정상 발송의 의존성에서 제거한다. 변경 전에 설정의 root 전용 복구 사본을 확보하고 typed tests → config/unit rules → VM 5202 적용 → 승인한 호스트 수집 → 실제 운영자 synthetic 발생/복구 → 외부 heartbeat → Grafana API·렌더링 순서로 검증한다. 서버의 Node 24.18.1 pinned image와 저장소의 lockfile에 고정된 최소 push dependency subset을 사용한다.

감시 적용 시점의 node-forge audit 실패와 원본 앱 이미지 보존은 별도 증거로 유지한다. 이후 사용자의 main 승격 승인에 따라 아래의 의존성 교정을 검증한다. 변경한 앱 이미지의 배포, Git 커밋·푸시·병합, 외부 HTTPS polling과 새 유료 서비스는 이 감시 설정 적용의 완료 증거에 섞지 않는다. 반복 운영과 복귀 절차는 [공용 감시 runbook](../../operations/runbooks/self-host-observability.md#pve-공용-감시와-운영자-알림)을 따른다.


## main 승격을 위한 Wallet 서명 의존성 교정

2026-10-02 사용자의 main 반영 요청으로 typed branch → dev → main과 실제 자체 호스팅 배포까지 진행한다. node-forge의 registry 수정 버전은 없으므로 passkit-generator를 제거하고 BSD-3-Clause인 pkijs 3.4.1·asn1js 3.0.7과 기존 JSZip으로 패스 생성을 대체한다. payload는 앱 소유 타입으로 유지하고 Node native crypto/WebCrypto로 RSA 키 일치·서명을 처리한다. 기존 SHA-1 manifest와 detached CMS, signer/WWDR certificate, signingTime 및 패스 메타데이터를 유지한다. 키 passphrase, 안전한 실패 메시지와 기존 활성화 flag도 보존한다.

검증은 ZIP 전량 해시·payload 대조, native Node의 독립 서명/변조 검사, 암호화 키와 잘못된 키·certificate 거부, 별도 OpenSSL interoperability, 기존 Wallet 테스트와 Production/full audit를 포함한다. audit 예외나 upstream Git override를 추가하지 않는다. 실제 iPhone Wallet 등록은 이 보안 교정의 완료 증거에 포함하지 않으며 현재 비활성 기능을 켜지 않는다. 전체 로컬 release와 exact-SHA 첫 CI, Preview/Production receiver·이미지·공개 health를 각각 확인한다.
