---
title: 자체 호스팅 앱 빌드와 실행
type: runbook
status: current
authority: normative
issue: https://github.com/MyKnow/ssartnership/issues/435
---

# 자체 호스팅 앱 빌드와 실행

이 절차는 [자체 호스팅 명세](../../specs/self-hosting/spec.md)의 앱 실행 작업이다. 전체 데이터 이전과 서버 전환의 남은 조건은 [작업 목록](../../specs/self-hosting/tasks.md)을 확인한다. 모든 명령은 저장소 루트에서 실행한다.

## 현재 PVE 운영 배치

2026-10-02 공개 전환 후 Production의 앱·DB·Storage·수신기·Cron·온라인 백업은 VM 5200, 원본 Preview는 VM 5201, 공용 Caddy·Prometheus·Grafana·Alertmanager와 edge 복구 timer는 VM 5202에서 실행한다. 주소·자원·전환 및 복구 증거와 남은 검증은 [PVE 이전 작업 목록](../../specs/pve-service-migration/tasks.md)을 기준으로 한다. 노트북의 원본 쓰기 작업을 다시 켜지 않는다.

현재 공개 구성은 `deploy/pve/compose.operations.yaml`과 `edge.Caddyfile`, 앱의 private 연결은 `compose.relay.yaml`이다. 아래의 같은 호스트 edge overlay 예시는 기존 배치에 대한 구성 절차다. 현재 운영 VM의 복합 설정을 그 템플릿으로 덮어쓰지 않는다. 관리 SSH는 pinned PVE 경유 경로를 사용하며, 해당 역할의 VM 안에서만 운영 unit을 실행한다. MALMOA는 아래 직접 연결 절차를 따른다. ClayFarm과 전용 노트북 relay는 아래 종료 절차로 제거했으며, 현재 공개 서비스는 노트북을 경유하지 않는다.

### MALMOA의 PVE 직접 연결

[Issue #526](https://github.com/MyKnow/ssartnership/issues/526)의 경로는 공용 ingress VM 5202(`192.168.1.2`) → team VM 5100(`192.168.1.78:8080`) 또는 Preview VM 5101(`192.168.1.136:8080`)이다. 노트북은 MALMOA 공개 요청을 전달하지 않는다. 각 MALMOA guest의 `/opt/malmoa/ingress-firewall.sh`와 `malmoa-ingress.service`는 8080 유입에 ingress 주소와 기존 PVE 관리 주소 `192.168.1.132`만 허용한다. 다른 IPv4·IPv6 유입 차단과 Docker 시작 선행 조건을 유지한다. Preview nginx도 `set_real_ip_from`을 ingress 주소로 맞춰 클라이언트 IP 귀속과 위조 전달 헤더 거부를 유지한다.

전환은 기존 nftables 전용 테이블에 ingress 허용을 먼저 추가하고 직접 `/healthz`를 확인한 뒤 Caddy 후보를 validate하고 graceful reload하는 순서다. 두 공개 홈·`/healthz`, Preview `/api/health`, 싸트너십 경로를 확인한 뒤 노트북 허용과 MALMOA legacy handler를 제거한다. 최종 규칙을 시작 스크립트에도 반영하고 비허용 출발지의 TCP 차단을 확인한다. `malmoa-ingress.service`를 재시작하면 Docker 의존성 때문에 컨테이너가 중단될 수 있으므로, 실행 중에는 전용 규칙 스크립트의 원자적 nft 트랜잭션만 적용한다.

이후 구성 변경이 실패하면 직전에 검증한 guest ingress 규칙·Preview nginx 설정과 Caddy의 MALMOA 블록만 복구하고 validate·reload한다. 제거한 노트북 relay 주소로 upstream을 되돌리지 않는다. 다른 프로젝트의 변경이 들어온 오래된 전체 파일로 덮어쓰지 않는다. 단일 파일 bind는 원자적 rename만으로 컨테이너가 새 inode를 읽지 못할 수 있으므로 실제 mount와 내부 hash를 확인한다.

### ClayFarm 운영 종료와 노트북 relay 제거

2026-10-02 사용자 요청으로 `clayfarm-api-1`과 `ssartnership-legacy-relay-relay-1` 컨테이너를 제거하고, `ssartnership-legacy-relay-firewall.service`와 해당 unit이 소유한 9080 허용 규칙을 제거했다. 노트북의 8765·9080 listener와 두 서비스의 Docker 자동 재시작 설정은 남아 있지 않다. 저장소의 legacy relay 배포 템플릿도 제거했으며, `clayfarm.myknow.xyz`는 VM 5202에서 `Cache-Control: no-store`와 HTTP 410으로 운영 종료를 응답한다.

`clayfarm_state` 볼륨, 기존 이미지·release·비밀 설정·백업과 원본 환경의 공유 network는 보존한다. 종료 전 Caddy·relay 구성과 복구 참조는 각 호스트의 root 전용 `clayfarm-retirement-526` 디렉터리에 보존한다. 데이터 정리나 서비스 재개는 별도 승인 범위다. `down -v`, volume/image/network prune, 전체 방화벽 flush를 사용하지 않는다.

노트북의 옛 `ssartnership-home-preview` 시험 환경은 2026-10-02 사용자 요청으로 컨테이너 11개와 예약 작업을 중지하고 자동 재시작을 비활성화했다. DB·Storage·감시 볼륨과 원본 환경 데이터는 보존했다. 이를 현재 VM 5201의 공개 Preview와 혼동하거나 복구 명령으로 다시 켜지 않는다.

## Docker Desktop 로컬 smoke

Docker Desktop이 실행 중인지 확인한 뒤 독립적인 Compose project 이름으로 빌드하고 시작한다. 로컬 덮어쓰기는 상속된 secret 환경 파일을 제거하는 `!reset` 문법을 사용하므로 Docker Compose 2.24.4 이상을 사용한다.

```bash
docker compose -p ssartnership-smoke -f compose.yaml -f compose.local.yaml config --quiet
docker compose -p ssartnership-smoke -f compose.yaml -f compose.local.yaml up --build -d --wait
docker compose -p ssartnership-smoke -f compose.yaml -f compose.local.yaml ps
curl --fail http://127.0.0.1:3100/api/health
curl --fail --output /dev/null http://127.0.0.1:3100/
docker compose -p ssartnership-smoke -f compose.yaml -f compose.local.yaml exec app id
docker compose -p ssartnership-smoke -f compose.yaml -f compose.local.yaml restart app
```

재시작 후 liveness와 공개 페이지를 다시 확인한다. 홈 응답 HTML의 `/_next/static/` 자산 하나도 실제로 가져와서 public/static 복사를 확인한다. 앱은 비root 사용자여야 한다. `/api/health`는 DB 연결을 검사하지 않는 liveness이며, 이 검증의 mock 데이터는 실사용자 인증·DB 복원 증거가 아니다. 모의 인증용 bypass는 활성화하지 않는다.

이름이 지정된 테스트 프로젝트만 중지한다. `down -v`나 전체 Docker 정리는 사용하지 않는다.

```bash
docker compose -p ssartnership-smoke -f compose.yaml -f compose.local.yaml down
```

## 빌드와 실행 설정

`Dockerfile`은 Node 24.18.1 기반 이미지와 저장소 trusted install을 사용한다. Mac에서 Linux arm64 빌드를 성공해도 홈 서버의 Linux amd64 실행 검증은 별도로 필요하다. 운영 호스트 아키텍처를 확인하고 해당 `--platform` 이미지를 만든다.

빌드 공개 설정은 `NEXT_PUBLIC_DATA_SOURCE`, `NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`다. 사용하지 않는 선택 값도 이미지와 런타임이 일치해야 한다. 이 값들은 이미지에 들어가므로 비밀을 넣지 않는다. 실제 데이터 모드의 두 data source는 `supabase`다. 공개 사이트·Supabase URL은 운영에서 HTTPS를 사용하며 로컬 loopback의 HTTP는 로컬 검증 용도다.

```bash
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_DATA_SOURCE=supabase \
  --build-arg NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE=supabase \
  --build-arg NEXT_PUBLIC_SITE_URL=https://app.example.com \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://data.example.com \
  --tag ssartnership:reviewed-sha .
```

`deploy/self-host/runtime.env.example`에서 환경별 비밀 파일 `deploy/self-host/runtime.env`를 준비한다. 파일은 Git에서 제외하고 소유자만 읽도록 권한을 제한한다. 환경 값을 터미널 출력·공유 로그·이미지 build argument에 포함하지 않는다. `docker compose config`는 비밀을 표시할 수 있으므로 검증할 때 `--quiet`를 사용한다.

공개 값은 위 이미지와 동일하게 설정한다. `SUPABASE_URL`은 SDK가 브라우저용 파일 URL을 만들 수 있도록 `NEXT_PUBLIC_SUPABASE_URL`과 같은 공개 origin을 사용한다. 서버 전송은 선택적인 `SUPABASE_INTERNAL_URL`에 Compose 내부 서비스 주소(예: `http://gateway:8000`)를 지정한다. `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, 세션 키와 기능별 외부 연동 비밀은 runtime 파일로만 전달한다. 정확한 필수 설정과 오류 코드는 `deploy/self-host/runtime-env.mjs`가 최종 근거다. `runtime.env.example`의 placeholder 상태로 운영 실행하지 않는다.

실제 공급자 실행에서는 `compose.local.yaml`을 사용하지 않는다. 리뷰한 immutable image digest를 `SELF_HOST_IMAGE`에 지정한다.

```bash
SELF_HOST_IMAGE=registry.example.com/ssartnership@sha256:REVIEWED_DIGEST docker compose -p ssartnership -f compose.yaml config --quiet
SELF_HOST_IMAGE=registry.example.com/ssartnership@sha256:REVIEWED_DIGEST docker compose -p ssartnership -f compose.yaml up -d --wait
```

위 레지스트리 주소와 digest는 예시다. 이미지 게시와 홈 서버 배포는 별도 실행 단계다. 실제 자체 호스팅 Supabase와 연결할 때 앱과 gateway가 같은 명시적 Compose 네트워크에서 통신하도록 통합 구성을 검증한다.

Storage SDK의 signed/public URL과 공개 이미지 프록시는 [데이터 실행 절차](./self-host-database.md)에 따라 검증한다. 공개 origin과 내부 전송 주소를 설정한 것만으로 실제 업로드·다운로드 검증을 완료 처리하지 않는다.

## 공개 edge와 TLS

공개 edge는 별도 Caddy Compose overlay로 고정한다. Caddy는 기존 Preview edge network에서만 `app:3000`과 `gateway:8000`을 향해 프록시하고, Docker socket·관리 API·데이터 network에는 접근하지 않는다. Caddyfile의 `ssartnership-dev.myknow.xyz`와 `ssartnership-api-dev.myknow.xyz`는 실제 DNS가 홈 서버를 가리키고 방화벽 포워딩을 검증한 뒤에만 인증서를 발급한다.

```bash
docker compose -p ssartnership-edge -f deploy/self-host/compose.edge.yaml config --quiet
docker compose -p ssartnership-edge -f deploy/self-host/compose.edge.yaml run --rm --entrypoint caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

`config --quiet`와 Caddy validate는 공개 변경 없이 설정만 검사한다. 공개 전환 전 원본 Preview의 외부 암호화 백업/복구 드릴, 원본 쓰기 중지와 최종 동등성, DNS 수정 권한, 방화벽 전달 경로 및 기존 DNS 복구값을 확보한다. 합성 환경의 백업은 원본 Preview 복구 증거를 대신하지 않는다. 승인된 전환 창에서 edge를 시작하고 두 DNS 레코드를 홈 서버로 연결한 뒤 실제 TLS 발급과 외부 probe를 검증한다. 발급 전에 TLS 성공을 선행 조건으로 요구하지 않는다. 두 origin의 HTTPS redirect, 정상 Host/protocol 전달, `/api/health`, 로그인, Storage 업로드·다운로드를 확인하고 인증서 갱신 상태도 운영 점검에 포함한다. 실패하면 기존 DNS를 복원하고 Caddy를 중지한다. 전환 중 홈 서버에 새 쓰기가 있었다면 원본을 재개하기 전에 데이터 차이를 확인한다.

### 부팅 뒤 공개 edge 자동 복구

Compose의 Caddy healthcheck는 Caddyfile 설정만 검증하며, 실제 80/443 수신이나 인증서 handshake를 확인하지 않는다. 배포된 root 소유 release에서 전용 설치기를 한 번 실행하면 root systemd timer가 부팅 1분 뒤부터 매분 Production과 Preview의 SNI 및 인증서 검증 TLS handshake를 검사한다. 이 검사는 Caddy가 TLS 연결을 받는지 확인하며 HTTP 응답이나 app/API upstream은 호출하지 않는다. 실행 중인 Caddy에서 두 번 연속 handshake 실패하면 기존 Caddy 컨테이너만 재시작하고, 정지하거나 일시 정지된 컨테이너는 시작 또는 재개를 시도한다. 모든 복구 동작은 5분 cooldown으로 제한되며 결과와 실패는 journal에 기록된다.

```bash
sudo /opt/ssartnership/node24/node /opt/ssartnership/control/current/scripts/self-host-operations/install-edge-recovery.mjs
systemctl status ssartnership-edge-recovery.timer
systemctl list-timers ssartnership-edge-recovery.timer
journalctl -u ssartnership-edge-recovery.service --since today
```

복구를 비활성화하려면 timer만 중지·비활성화한다. 서비스 파일은 진단을 위해 그대로 둔다. 다시 켤 때는 `systemctl enable --now ssartnership-edge-recovery.timer`를 실행한다.

```bash
sudo systemctl disable --now ssartnership-edge-recovery.timer
```

이 내부 검사는 전체 호스트 프리징, 정전, 공유기·ISP 장애나 외부 방화벽 전달을 복구하지 못한다. 또한 TLS handshake 뒤 HTTP 처리가 멈춘 상태를 판별하지 못한다. loopback TLS 성공은 외부 인터넷에서의 접근 성공 증거가 아니므로, HTTP synthetic probe와 공개 URL 확인은 별도 감시에서 유지한다. 앱/API HTTP health는 upstream 상태로 계속 따로 관찰하며, 그 실패만으로 Caddy를 재시작하지 않는다. 기존 설치 파일이 현재 저장소 템플릿과 다르면 설치기는 덮어쓰기를 거절하므로 차이를 검토한 뒤 수동 교체한다.

## Cron 이식

Production 홈 서버 전환에서는 `vercel.json`의 `git.deploymentEnabled=false`로 모든 브랜치의 Vercel 자동 배포를 중지한다. Production과 Preview 모두 자체 호스팅 이미지 경로를 사용한다. 이는 새 앱이 이전 Cloud 스키마에 먼저 배포되는 것을 막는 전환 계약이다. 기존 Vercel 배포는 복구용으로 보존하며 이 설정만으로 기존 요청이나 Cron이 중지되지는 않는다. 최종 데이터 복사 직전에 Vercel 설정에서 Cron을 비활성화하고 기존 Production 요청을 정지한 뒤 진행 중인 쓰기 종료와 원본 쓰기 차단을 확인한다. 신규 Production 검증은 승인된 main SHA의 홈 서버 이미지·DB·실제 공개 흐름을 기준으로 수행한다. 새 서버가 쓰기를 받은 뒤에는 데이터 차이 확인 없이 기존 서비스와 DNS를 재개하지 않는다.

운영 이미지 준비 입력의 `refs/heads/main`은 앱 origin `https://ssartnership.myknow.xyz`, API origin `https://ssartnership-api.myknow.xyz`, `linux/amd64`, 유효한 공개 VAPID 키를 모두 요구한다. 기존 SHA·소스 archive hash·만료·root 소유 파일·전체 Release 검증을 유지하며, 실제 운영 키와 빌드/실행 값의 일치도 별도로 확인한다. 일반 main 입력이나 Preview 주소를 섞은 main 입력은 거절한다. `main` push는 Production 전용 GitHub workflow에서 이미지를 발행하고, 서버 수신기는 첫 성공 attempt와 현재 main SHA·schema approval·immutable digest를 다시 확인한 뒤 app만 자동 적용한다. 설치·중지·복구 절차는 [격리 CI·배포·유지보수](./self-host-ci-maintenance.md)를 따른다.

등록 endpoint와 중지된 Vercel 호환 일정은 `vercel.json`에 남긴다. 아래 범용 CLI는 이 복구용 UTC 목록을 조회하며 HTTP 요청을 보내지 않는다. 현재 Production 실행 일정은 아래의 별도 자체 호스팅 구성이다.

```bash
node scripts/self-host-cron.mjs --list
```

단발 호출은 운영 쓰기가 생길 수 있다. `SELF_HOST_CRON_BASE_URL`과 `CRON_SECRET`을 보안 환경에서 주입한 상태에서 등록된 한 경로만 지정한다. 정확한 명령은 CLI의 사용법과 맞춰 검증한다. 로컬 smoke에서는 실행하지 않는다.

```bash
node scripts/self-host-cron.mjs --run /api/cron/rss
```

별도 scheduler를 구성할 때는 승인된 실행 주기에 대응하는 단발 명령을 사용한다. 같은 job이 겹치지 않게 실행 잠금을 설정하고 종료 코드와 실패 알림을 수집한다. 도구가 timeout으로 끝났다고 서버 작업까지 취소됐다고 가정하지 않는다. 재실행 전에 실행 로그와 실제 데이터 결과를 확인한다.

운영 전환에서는 기존 Vercel Cron을 중지한 다음 새 scheduler 하나만 활성화한다. 전환 직후 job별 마지막 실행 시각, 결과, 중복 여부를 확인한다. 이 앱 Compose는 반복 scheduler를 자동으로 시작하지 않는다.

홈 Production의 실제 일정은 `deploy/self-host-operations/production-cron/schedules.json`이 정의한다. Vercel의 중지된 복구용 일정과 구분하며, 전체 등록 경로 대조에서 Wallet을 제외한 작업이 하나라도 누락·중복·추가되면 설치를 중단한다. `production-cron.mjs`는 검증한 매일·매시간·분 간격 부분집합만 UTC systemd calendar로 변환한다. `Persistent=false`이므로 중지 중의 작업을 재개 직후 몰아서 실행하지 않는다.

| 작업 | 권장 실행 주기 (KST) |
| --- | --- |
| Mattermost 발신 계정 상태 | 5분, 매시 01/06/11…56분 |
| 만료 프로모션 정리 | 10분, 매시 04/14/24/34/44/54분 |
| RSS 갱신 | 15분, 매시 02/17/32/47분 |
| 제휴 결제 상태 반영 | 매시간 10분 |
| 졸업 증빙·임시 이미지·수동 명부 정리 | 매시간 각각 30/32/35분 |
| 삭제 회원 익명화·운영 로그·프로젝트 개인정보 정리 | 매일 각각 03:40/03:50/03:55 |
| 만료 제휴 알림 | 매일 09:00 |

Wallet timer와 기능은 이번 운영 전환에서 제외하고 비활성 상태를 유지한다. 고정 loopback 앱에만 요청하고 비밀은 root 전용 파일에서 읽는다. 검증한 버전 아래에 스크립트·공용 모듈·일정·등록 경로 목록·실패 알림 모듈을 설치한다. 기존 설정을 보존한 뒤 `current` 링크와 해당 11개 timer만 갱신한다. `systemd-analyze calendar`와 unit validation을 통과하고, 기존 Vercel Cron 비활성화·공개 전환·복원 검증을 확인한 후 root 전용 `cron-owner=home-production`으로 단일 소유를 보장한다.

전용 잠금은 최대 120초 대기하고 호출은 응답 본문까지 60초로 제한한다. HTTP 성공이어도 JSON의 `ok`가 true가 아니거나 `failed`가 0이 아니면 실패다. 잘못된 JSON·HTML·256KiB 초과 본문도 거절한다. 실패 시 자동 재시도하지 않으며 systemd OnFailure로 기존 운영자 이메일 경로에 작업명만 알린다. 같은 작업의 반복 실패 메일은 시간 단위 idempotency 키로 중복을 억제한다. 응답의 회원 정보·비밀·원문 오류는 출력하지 않는다. 시간 초과는 서버 작업의 롤백을 뜻하지 않으므로 작업 이력과 진행 상태를 먼저 확인하고 수동 재실행한다.

중지·복구는 이 11개 timer만 대상으로 한다. 이전 코드와 timer로 되돌려도 이미 수행한 개인정보 보존 정책이나 결제 상태 변경이 되돌아가지는 않는다. 복구용 Vercel Cron을 동시에 다시 켜지 않는다.

## 운영·복구 검증

공개 노출 전 TLS reverse proxy, 정상 Host/protocol 전달, 업로드 크기와 요청 제한, HTTPS redirect, cookie와 인증 흐름을 확인한다. 임의 forwarded IP를 신뢰하도록 앱 코드를 완화하지 않는다. 이미지 digest, 원본 SHA, 빌드 공개 설정, 적용 시각을 함께 기록하고 이전 이미지를 보존한다.

단일 앱 인스턴스의 롤백은 이전 digest로 재기동하고 liveness·공개 흐름을 확인하는 방식이다. 데이터 변경 후 롤백은 별도의 DB/Storage 복구 판단이 필요하다. 운영 DB·Storage는 외부 암호화 백업과 깨끗한 환경에서의 복원 시간을 확인해야 한다. 서버 디스크의 백업 파일 존재만으로 재해 복구 완료를 판단하지 않는다.

집중 검증은 다음과 같다. broad runtime 변경이므로 실제 작업 브랜치에서 `npm run verify:release`도 실행한다.

```bash
node --test tests/self-host-runtime.test.mts tests/self-host-cron.test.mts
npm run check:docs
```

설계 근거: [Next.js 환경 변수와 self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Compose 파일 병합](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/).


### 독립 회선 HTTPS 수동 검증

`.github/workflows/self-host-public-health.yml`은 운영자 요청 때만 GitHub-hosted Ubuntu에서 실행한다. 예약 실행·배포 권한·앱 비밀·URL 입력이 없다. `verify-public-health.mjs`는 고정 Production/Preview health의 TLS·HTTP 200·비캐시 `{status:"ok"}`와 두 infra origin의 Basic 인증 401을 확인한다. redirect를 따르거나 실패 요청을 재시도하지 않는다. 결과에는 환경명과 고정 상태만 남긴다.

재부팅 복구 또는 공개 edge 변경 후 승인된 main 소스에서 한 번 실행하고 run의 실제 head SHA·첫 attempt·전체 결과를 확인한다. 서버 내부 검증이나 같은 회선의 브라우저를 독립 회선 증거로 표현하지 않는다. 이 작업은 웹 접속·인증 경계 검증이며 DB 가용성·실제 로그인·상시 외부 감시를 대신하지 않는다. 실패한 실행은 보존하고 원인 확인 후 새 증거로 검증한다.
