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
