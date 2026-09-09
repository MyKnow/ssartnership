---
title: 자체 호스팅 외부 복구 사본과 관측 운영
type: runbook
status: current
authority: normative
---

# 외부 복구 사본과 관측 운영

범위와 전환 게이트는 [데이터 계획](../../specs/self-host-database/plan.md), 기존 백업/PITR은 [운영 복구](./self-host-operations.md)를 따른다. 아래 도구는 운영자의 SSH 권한에서만 실행하며 공개 관리 API가 아니다. 실제 실행 여부는 [작업 목록](../../specs/self-host-database/tasks.md)에 별도로 기록한다.

## 외부 백업

`scripts/self-host-operations/offhost.mjs`는 로컬 pgBackRest 저장소·Storage Restic 저장소·선택한 paired manifest를 별도의 암호화 Restic 저장소로 전송한다. 전송된 시점의 **paired 복구 지점까지** 복원할 수 있다. 외부의 실시간 WAL 복제가 아니며 전송 주기보다 짧은 재해 RPO를 주장하지 않는다. `capture`는 기존 operations 잠금을 공유하여 backup/expire/prune와 겹치지 않는다. 이미 보관된 WAL은 불변 파일이고 이후 추가되는 WAL은 선택한 복구 지점의 필수 조건이 아니다.

외부 목적지는 `rest:https://<receiver>/<username>/ssartnership/` 형식이다. 현재 실행 adapter는 REST HTTPS만 지원한다. S3/SFTP 전환은 별도 adapter 검증 후 추가한다. 인증 값은 URL이 아닌 private env에 넣는다. `OFFHOST_PASSWORD`는 외부 Restic 암호화 키, `OFFHOST_CREDENTIAL`은 수신 인증 값으로 역할이 다르다. 내부 pgBackRest/Storage 복구 키와 외부 키는 재사용하지 않는다. 키·앱 env·DB env는 전송 대상에 포함되지 않는다.

수신기는 [Rest Server](https://github.com/restic/rest-server)의 TLS 1.3·인증·private repo·append-only·용량 제한을 사용한다. `deploy/self-host-operations/compose.backup-receiver.yaml`을 **독립된 백업 호스트**에 설치한다. 업로드 계정은 기존 snapshot 삭제/덮어쓰기가 불가능하다. 보존 삭제는 백업 호스트의 별도 관리자에게만 허용하고 복구 시험 전에 실행하지 않는다. 저장소 암호화/복구는 [Restic 문서](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html)를 따른다.

로컬 모의 수신 초기화:

```bash
node -- scripts/self-host-operations/init-backup-receiver.mjs .tmp/self-host/receiver
docker compose --env-file .tmp/self-host/receiver/receiver.env \
  -f deploy/self-host-operations/compose.backup-receiver.yaml up -d
node -- scripts/self-host-operations/offhost.mjs init \
  --env-file .tmp/self-host/data.env \
  --operations-env-file .tmp/self-host/operations.env \
  --offhost-env-file .tmp/self-host/receiver/offhost.env
```

초기화는 기존 경로·저장소를 덮어쓰지 않는다. 모의 인증서는 30일 유효하며 실제 운영 인증서 갱신 정책을 대신하지 않는다. 실제 수신기에는 hostname/CA와 인증서 교체 절차를 별도로 준비한다. 수신 container에는 인증서·TLS 키·htpasswd 세 파일만 읽기 전용으로 제공한다. client의 외부 암호화 키는 수신 container에 mount하지 않는다.

`init` 뒤 같은 세 env 인자로 아래 명령을 실행한다.

- `capture`: 고정 manifest와 두 암호화 저장소를 전송하고 immutable snapshot ID를 반환한다.
- `check`: 원격 저장소의 모든 data pack을 읽어 검사한다. 접근 실패 시 재초기화하지 않는다.
- `restore --snapshot <64자리 ID>`: 새 무작위 볼륨에 외부 사본을 복원하고 Restic 검증을 수행한다. `latest`나 기존 대상 경로는 받지 않는다.
- `rehearse --snapshot <64자리 ID>`: 외부 사본에서 복구한 저장소만 새 볼륨에 복제하고, 네트워크 없는 새 PostgreSQL/Storage 대상으로 기존 PITR marker·파일 hash 검증을 수행한다. 원본 저장소는 이 복구 단계에 mount하지 않는다.

모든 결과는 `backup-manifest.jsonl`에 고정 필드만 기록한다. 실패를 성공으로 덮지 않는다. 의도된 복구 볼륨은 검사와 장애 분석을 위해 남겨두며 자동 `down -v`/전체 prune을 하지 않는다. 정리할 때 해당 receipt의 정확한 볼륨만 확인하고 별도 삭제한다.

홈 서버와 같은 집의 디스크/컨테이너는 독립 재해 사본이 아니다. 노트북 사본은 장치 분리 증거일 뿐 상시 가용성·지리적 분리를 보장하지 않는다. 외부 목적지·백업 주기·독립 키 보관·실복구가 확인되지 않으면 전환 게이트는 미완료다.

### Production의 Mac 백업 목적지 수용

[Issue #453](https://github.com/MyKnow/ssartnership/issues/453)의 2026-09-09 운영자 결정에 따라 현재 작업 Mac을 Production 백업 목적지로 사용한다. 별도 외부 저장소가 없다는 상황을 확인한 명시적 선택이며, 이 이전에서는 지리적 분리 저장소 확보를 전환의 선행 조건으로 요구하지 않는다. 같은 장소의 화재·도난·전원 장애와 Mac 분실에 대한 한계는 남는다. 이 결정은 정기 백업, 복구 키 보관, 실제 복원 검증을 생략하는 승인이 아니다.

장기 보관 사본은 작업용 `.tmp`와 분리한 사용자 Library의 전용 Application Support 디렉터리에 둔다. Mac의 FileVault가 꺼져 있으면 DB와 Storage의 평문 파일을 남기지 않는다. 암호문 전체의 hash와 인증 복호화 검증은 가능하며, 실제 DB 복원은 운영자가 승인한 서버의 새 비공개 격리 대상으로 수행한다. Mac 사본에서 다시 전송한 입력과 Mac Keychain에서 복구한 키만 사용하고 원본 백업·운영 DB·Storage를 복원 입력으로 대체하지 않는다. 같은 서버에서 수행한 시험은 별도 장치의 저장 사본 복구 증거이며, 독립 컴퓨팅 장치나 지리적 재해 복구 증거로 표현하지 않는다.

정기 작업에는 임시 `codex-bootstrap` 계정의 만료를 연장하거나 그 관리자 키를 재사용하지 않는다. 백업 전용 전송 경계와 실행 주기, 보존 기간, Mac 절전·오프라인 후 재개, 마지막 성공 시각의 노후 감지를 검증한 뒤에만 정기 백업 완료로 기록한다. 초기 이전 스냅샷을 Mac에 한 번 복사한 것만으로 운영 데이터의 지속 백업이나 RPO를 보장하지 않는다. 실제 적용 상태와 복원 receipt는 Issue에 기록한다.

### Production 일일 암호화 스냅샷

서버의 `ssartnership-production-backup.timer`는 매일 03:00 Asia/Seoul에 실행하고 성공 사본 7개를 보존한다. CI의 heavy 잠금이 사용 중이면 해당 실행은 실패하며 다음 성공으로 숨기지 않는다. 앱·API·Storage를 정지하고 DB를 정상 종료한 뒤 물리 DB와 Storage, 복구용 env를 함께 암호화한다. 잠시 서비스가 중단되는 cold backup이며 연속 WAL/PITR을 제공하지 않는다. 정상·실패 종료 모두 저장된 재개 의도에 따라 원래 실행 중이던 컨테이너만 다시 시작한다. 호스트 재부팅 후에도 백업 서비스의 `resume`으로 남은 의도를 먼저 처리한다.

실행 파일은 `scripts/self-host-operations/production-*.mjs`, 전송 파일은 `serve-production-backup.mjs`와 `pull-production-backups.mjs`다. 서버 systemd 템플릿은 `deploy/self-host-operations/production-backup/`에 둔다. 설치 시 템플릿의 버전 경로와 실제 root 소유 실행 파일을 일치시키고, private `backup.json`의 source·DB system identifier·공개 age recipient·전송 그룹을 확인한다. 비밀 설정 자체는 저장소에 넣지 않는다.

Mac의 `dev.myknow.ssartnership-production-backup` LaunchAgent는 로그인 시와 매시간 실행한다. 저장 위치는 `~/Library/Application Support/ssartnership-backups/production`이고 성공 사본 30개를 보존한다. Mac이 잠들거나 꺼져 있으면 복사는 재개 후 실행되므로 실제 복구 가능 시점은 마지막으로 검증된 Mac 사본이다. 온라인 상태의 일일 백업 목표는 약 24시간이며 보장 SLA가 아니다. 26시간 이상 된 사본은 실패 상태로 표시한다. 암호문 파일의 크기와 SHA-256이 맞아야 receipt 및 서버 확인 응답을 남긴다. 실패한 부분 파일은 성공 사본으로 승격하거나 복구 입력으로 쓰지 않는다.

전용 SSH 계정은 고정 Mac 주소·고정 호스트 키·전용 키로만 연결하며 `list`, `get <UUID>`, `ack <UUID> <SHA256>`만 허용한다. sudo, Docker 권한, 셸, 포트 전달은 제공하지 않는다. 서버의 공개 recipient로 암호화하고 private 복구 키는 Mac Keychain 기반 envelope로 보관한다. 호스트 키 변경 오류는 관리자 확인 후 핀을 교체하며 검증을 끄지 않는다.

서버의 metrics timer는 매분 마지막 스냅샷과 Mac에 실제 복사된 스냅샷 시각을 갱신한다. Production 전용 경보는 수집 중단 5분, 서버/Mac 사본 26시간 노후 또는 지표 누락을 감지한다. 오래된 파일을 다시 확인해도 사본의 생성 시각은 갱신하지 않는다. 외부 알림 수신처 설정과 전달 성공은 별도로 검증한다.

복구 시험은 Mac 암호문과 Keychain 키로 복원한 새 서버 비공개 경로를 `restore-production-backup.mjs`에 제공한다. network-none DB에서 테이블별 전체 행 hash와 Storage 전체 파일 hash·메타데이터를 비교하고 원본 mount가 없음을 확인한다. 실제 설치·예약 실행·Mac 수신·복구 시험의 결과는 각각 Issue #453 receipt로 구분하며, 최종 데이터 전환 후 새 스냅샷으로 다시 확인한다.

### Production 외부 관측 경로

`deploy/self-host/Caddyfile.production`는 API 및 인프라 도메인 전용 조각이다. 활성화 시 기존 edge 설정을 보존한 새 버전 설정에 이 조각을 결합하고 Caddy 검증을 통과시킨다. Caddy를 Production edge·monitoring 네트워크에 연결하고, Dev와 Prod의 upstream은 서비스 별칭 대신 환경별 전체 컨테이너 이름으로 구분한다. 전체 네트워크를 연결한 뒤 `app` 같은 중복 별칭을 남기면 다른 환경으로 연결될 수 있다. 기존 Dev upstream도 전체 이름으로 고정하고 두 환경 응답을 함께 검증한다.

`/run/production-infra-auth/users`는 별도 Production 인프라 계정의 bcrypt hash 파일만 읽기 전용으로 mount한다. 원본 부모는 0700이며 사용자 비밀번호와 앱 계정을 설정 조각에 넣지 않는다. Prometheus·Alertmanager 경로는 GET/HEAD만 허용하고 인증 헤더와 쿠키를 upstream에 전달하지 않는다. Grafana는 동일한 전용 operator 계정을 자체 검증한다. 외부 Origin과 cross-site API 요청을 차단한다. DNS의 권한 서버 및 독립 resolver 응답이 일치한 뒤 TLS 발급을 시작한다. 원시 서비스 포트는 loopback으로 유지한다.

이 조각에는 실제 앱 도메인을 넣지 않는다. 앱 주소 전환은 최종 데이터 동기화, 인증 검증, 실행 SHA 및 Cron 단일 소유 확인을 완료한 뒤 별도 수행한다.

## 관측 구성

기존 세 Compose 파일에 `compose.monitoring.yaml`을 추가한다. Linux 서버에서는 `compose.monitoring.host.yaml`도 추가한다. Docker Desktop 기본 exporter는 Linux VM을 관측하며 Mac 하드웨어 감시로 표현하지 않는다.

```bash
node -- scripts/self-host-operations/monitoring.mjs init .tmp/self-host/monitoring
node -- scripts/self-host-operations/monitoring.mjs install-role \
  .tmp/self-host/monitoring .tmp/self-host/data.env .tmp/self-host/operations.env
node -- scripts/self-host-operations/monitoring.mjs collect \
  .tmp/self-host/monitoring .tmp/self-host/data.env .tmp/self-host/operations.env
docker compose --env-file .tmp/self-host/data.env \
  --env-file .tmp/self-host/operations.env \
  --env-file .tmp/self-host/monitoring/monitoring.env \
  -f compose.yaml -f compose.supabase.yaml -f compose.operations.yaml \
  -f compose.monitoring.yaml up -d --build \
  prometheus alertmanager grafana node-exporter postgres-exporter telemetry
```

`install-role`는 명시적인 운영 작업이다. `ssartnership_monitor`에는 `pg_monitor`, CONNECT, 최대 3 connections만 부여한다. superuser·DB/role 생성·replication·BYPASSRLS가 없으며 회원 table 접근 거절을 검증한다. SQL/비밀번호를 출력하지 않는다. monitoring 비밀의 부모 디렉터리는 0700, env는 0600이다. 서로 다른 비root container UID가 읽는 개별 bind 파일은 0444이지만 부모 디렉터리를 공개하지 않는다.

기본 loopback 포트는 Grafana `53000`, Prometheus `59090`, Alertmanager `59093`이다. 공개 ingress에 연결하지 않는다. Grafana 계정은 `operator`, 암호는 private `secrets/grafana-password`다. 익명 접근·가입·업데이트/분석 외부 전송을 끈다. 대시보드와 datasource는 [파일 provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)으로 관리한다. 비밀 없는 textfile만 node_exporter에 제공하고 Docker socket은 어느 exporter에도 제공하지 않는다.

Prometheus는 7일 및 2GB 보존 상한을 사용한다. WAL/head/compaction 작업 공간이 추가로 필요하므로 2GB를 전체 디스크 quota로 간주하지 않는다. 각 container의 메모리·PID·로그 제한을 유지하고 서버의 CI 자원과 함께 측정한다.

`collect`를 매분 실행하여 원자적으로 textfile을 갱신한다. DB가 응답하지 않으면 archive health가 0이 된다. 명령이 중단되거나 manifest가 손상되어 갱신하지 못하면 collected timestamp가 오래되어 경보가 난다. 백업 ID·객체 경로·비밀·오류 본문을 metric label에 넣지 않는다. PostgreSQL, 호스트, 백업/복구 나이, 외부 사본과 점검 결과, 앱 health probe와 알림 전달 결과를 관측한다. health probe 지연은 전체 실제 사용자 요청의 서버 지연 분포가 아니다.

## 알림과 Web Vitals

private monitoring env의 `OPS_ALERT_WEBHOOK_URL`에 운영자가 지정한 HTTPS Mattermost-compatible webhook을 설정한다. Alertmanager → token 인증 내부 relay → 고정 HTTPS 수신처로 전달한다. 외부 redirect를 따르지 않고 알려진 경보 이름·심각도·firing/resolved만 전달한다. DB row, 주석 원문, instance/path, 응답 본문은 전달하지 않는다. 미설정/전달 실패는 503/502와 실패 metric으로 드러난다. 같은 서버가 전원/회선을 잃으면 자체 Alertmanager도 중단되므로 **별도 장치의 외부 probe/heartbeat와 실제 수신 검증이 별도로 필요**하다.

`deploy/observability/compose.alert-fixture.yaml` 및 `tests/fixtures/self-host-alert-sink.mjs`는 로컬 TLS 수신 시험 전용이다. 이를 운영 수신처로 설치하지 않는다. `promtool test rules`는 임시 `/tmp` 파일시스템을 제공하여 `deploy/observability/alerts.test.yml`의 장애·회복·누락/노후 경보를 확인한다.

자체 호스팅에서 [Next.js useReportWebVitals](https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals)로 LCP/INP/CLS를 수집한다. 프레임워크에 포함된 web-vitals를 재사용하며 추가 외부 telemetry 서비스에 보내지 않는다. 기본 샘플링은 페이지 로드의 10%, DNT=1은 수집하지 않는다. 검증 환경에서만 `SELF_HOST_VITALS_SAMPLE_RATE=1`로 전체 표본을 사용한다.

클라이언트는 원본 경로를 8개 고정 화면 분류로 바꾼다. `/api/web-vitals`는 설정 origin, JSON content type, 512-byte 실제 body 한도, 프로세스당 분당 1200개 전역 제한과 strict schema를 적용한다. 회원/IP/세션 ID를 rate-limit 저장소에 쌓지 않는다. 추가 키·URL·metric ID·entries·비정상 수치는 거절한다. 내부 collector는 별도 token으로 인증하고 고정 histogram만 보관한다. 원본 event 저장소가 없고 Prometheus의 7일 보존 정책이 집계 데이터에 적용된다. 익명 클라이언트 수치는 위조 가능하므로 보안 감사나 과금 근거로 사용하지 않는다. 단일 app/collector 기준의 quota이며 다중 replica 도입 시 공유 ingress 제한이 필요하다.

Vercel 배포의 기존 Analytics/SpeedInsights와 제품 이벤트는 유지한다. 자체 호스팅의 웹 성능 수집은 비활성 기본값이며 monitoring overlay에서 활성화한다. 공개 GET 설정에는 활성 여부와 샘플링 비율만 들어간다. 수집 실패는 사용자 화면의 오류로 표출하지 않지만 endpoint 실패와 운영 metric으로 점검한다.
