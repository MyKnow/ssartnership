---
title: 자체 호스팅 외부 복구 사본과 관측 운영
type: runbook
status: current
authority: normative
---

# 외부 복구 사본과 관측 운영

범위와 전환 게이트는 [데이터 계획](../../specs/self-host-database/plan.md), 기존 백업/PITR은 [운영 복구](./self-host-operations.md)를 따른다. 아래 도구는 운영자의 SSH 권한에서만 실행하며 공개 관리 API가 아니다. 실제 실행 여부는 [작업 목록](../../specs/self-host-database/tasks.md)에 별도로 기록한다.

2026-10-02 PVE 이전 뒤 현재 Production 백업 생성·수집은 VM 5200, 두 환경 공용 감시는 VM 5202가 소유한다. 감시 구성의 정본은 `deploy/pve/`이며 공용 대시보드는 `deploy/pve/grafana/build-dashboard.mjs`로만 생성한다(UID `ssartnership-operations`). `deploy/observability/`는 telemetry 이미지·알림 전달 모듈 같은 PVE 런타임 소스와 게스트 VM 로컬 보조 구성을 담으며, 그 Grafana 대시보드는 정본과 겹치지 않도록 UID `ssartnership-guest-local`의 비정본 보조 화면으로 분리했다(RF-04). 게스트 감시 블록의 삭제 여부는 운영자 결정 사항이다. 두 infra origin은 익명 요청에 Basic 인증 401을 반환하며 Preview 관리 로그인 후 공용 dashboard로 이동한다. 구성은 `deploy/pve/`를 사용하며 아래의 같은 호스트 monitoring overlay와 별도 Preview dashboard 설명으로 현재 설정을 덮어쓰지 않는다. 최종 백업·Mac/PVE custody·격리 복원·신규 감시 이력 및 미검증 경계는 [PVE 이전 작업 목록](../../specs/pve-service-migration/tasks.md)에 기록한다.

공용 [SSARTNERSHIP Operations 대시보드](https://ssartnership-infra.myknow.xyz/infra/grafana/d/ssartnership-operations/ssartnership-operations)는 `SSARTNERSHIP` 폴더에 등록된다. Grafana 관리자 사용자의 홈 대시보드는 UID `ssartnership-operations`로 지정했다. 홈 지정이 없으면 기본 홈에 운영 대시보드가 보이지 않을 수 있으므로, 위 직접 주소나 Dashboards의 해당 폴더에서 연다. [Preferences API](https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/api-legacy/preferences/)의 `PATCH /api/user/preferences`로 `homeDashboardUID`만 변경하며 다른 사용자 설정은 보존한다. 2026-10-02 후속 개편에서 46개 패널로 확장했고, 사용자 요청에 따라 로그인된 외부 Chrome에서 화면과 환경 필터를 검증했다. 내장 브라우저의 Basic 인증 차단은 서버 인증을 완화하지 않고 외부 브라우저로 해결했다.

Grafana 자체 계정은 사용자가 변경했으며 2026-10-02 10:05 KST에 새 계정의 API 조회를 검증했다. 자동 검증은 Mac 키체인의 generic password 서비스 `ssartnership-grafana`에서 계정명과 암호를 실행 시점에 읽고, pinned SSH를 통해 VM 5202의 loopback API를 사용한다. 평문 자격 증명 파일을 만들거나 값을 로그에 출력하지 않는다. 키체인 항목 접근이 실패하면 기존 Grafana 계정으로 대체하지 않고 실패로 보고한다. 앞단 Caddy Basic 인증은 별도 계정이며 기존 서버의 `infra-auth/users`와 보호된 암호 파일을 유지한다. Grafana 계정 변경은 이 앞단 인증이나 초기 설치용 `GF_SECURITY_ADMIN_USER`·암호 파일을 자동 갱신하지 않는다. 새 Grafana 자격 증명만으로 공개 origin의 앞단 인증을 통과할 수 있다고 가정하지 않는다.

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

### Production 6시간 온라인 암호화 스냅샷

서버의 `ssartnership-production-backup.timer`는 03:00/09:00/15:00/21:00 Asia/Seoul에 실행하고 성공 사본 28개(정상 주기 기준 7일)를 보존한다. CI의 heavy 잠금이 사용 중이면 해당 실행은 실패하며 다음 성공으로 숨기지 않는다. 2026-09-10부터 아래 온라인 drop-in을 적용하여 운영 앱·DB를 중단하지 않는다. 연속 WAL/PITR은 제공하지 않는다. 기존 cold 실행 파일은 복귀용으로 보존한다. cold 방식으로 명시적으로 복귀하면 앱·API·Storage·DB가 잠시 중단되며, 정상·실패 종료 모두 저장된 재개 의도에 따라 원래 실행 중이던 컨테이너만 다시 시작한다.

실행 파일은 `scripts/self-host-operations/production-*.mjs`, 전송 파일은 `serve-production-backup.mjs`와 `pull-production-backups.mjs`다. 서버 systemd 템플릿은 `deploy/self-host-operations/production-backup/`에 둔다. 설치 시 템플릿의 버전 경로와 실제 root 소유 실행 파일을 일치시키고, private `backup.json`의 source·DB system identifier·공개 age recipient·전송 그룹을 확인한다. 비밀 설정 자체는 저장소에 넣지 않는다.

Mac의 `dev.myknow.ssartnership-production-backup` LaunchAgent는 로그인 시와 매시간 실행한다. 저장 위치는 `~/Library/Application Support/ssartnership-backups/production`이고 성공 사본 30개를 보존한다. Mac이 잠들거나 꺼져 있으면 복사는 재개 후 실행되므로 실제 복구 가능 시점은 마지막으로 검증된 Mac 사본이다. 운영 서버와 상시 PVE 사본의 목표 복구 지점 간격은 6시간이며 보장 SLA가 아니다. Mac은 30개 사본을 유지하므로 정상 주기 기준 약 7.5일이다. 26시간 이상 된 사본은 실패 상태로 표시한다. 암호문 파일의 크기와 SHA-256이 맞아야 receipt 및 서버 확인 응답을 남긴다. 실패한 부분 파일은 성공 사본으로 승격하거나 복구 입력으로 쓰지 않는다.

전용 SSH 계정은 고정 Mac 주소·고정 호스트 키·전용 키로만 연결하며 `list`, `get <UUID>`, `ack <UUID> <SHA256>`만 허용한다. sudo, Docker 권한, 셸, 포트 전달은 제공하지 않는다. 서버의 공개 recipient로 암호화하고 private 복구 키는 Mac Keychain 기반 envelope로 보관한다. 호스트 키 변경 오류는 관리자 확인 후 핀을 교체하며 검증을 끄지 않는다.

PVE 이전 뒤 Mac의 전용 백업 키는 Mac에 남기며 pinned PVE SSH의 `ProxyCommand`를 통해 Production `192.168.1.182`에 접속한다. PVE 자체 전용 백업 키도 호스트에서만 사용한다. 새 서버에서 보이는 전송 source는 PVE LAN 주소로 제한한다. 임시 bootstrap 관리자 키로 정기 백업 전용 키를 대체하지 않는다. 기존 host pin·암호문 이력을 보존하며 새 서버 pin을 확인해 추가한다.

서버의 metrics timer는 매분 마지막 스냅샷과 Mac에 실제 복사된 스냅샷 시각을 갱신한다. Production 전용 경보는 수집 중단 5분, 서버/PVE 사본 8시간 노후, PVE 전송 확인 40분 중단, Mac 사본 26시간 노후 또는 지표 누락을 감지한다. 오래된 파일을 다시 확인해도 사본의 생성 시각은 갱신하지 않는다. 외부 알림 수신처 설정과 전달 성공은 별도로 검증한다.

복구 시험은 Mac 암호문과 Keychain 키로 복원한 새 서버 비공개 경로와 검증한 receipt의 `databaseSystemId`를 `restore-production-backup.mjs <경로> <databaseSystemId>`에 제공한다. 식별자는 초기 후보 상수가 아니라 해당 백업의 receipt·암호화 manifest·실제 격리 복원 DB에서 모두 일치해야 한다. network-none DB에서 테이블별 전체 행 hash와 Storage 전체 파일 hash·메타데이터를 비교하고 원본 mount가 없음을 확인한다. 새 백업의 암호화 manifest는 캡처 당시 실행 중인 앱의 Git SHA와 이미지 식별자도 보존하므로 데이터 시점에 맞는 앱을 복구할 때 사용한다. 실제 설치·예약 실행·Mac 수신·복구 시험의 결과는 각각 Issue #453 receipt로 구분하며, 최종 데이터 전환 후 새 스냅샷으로 다시 확인한다.

SSH 세션에서 Keychain 접근이 macOS -25308로 거절되면 운영자가 로그인한 Mac의 GUI Terminal에서 동일한 복구 helper를 실행하고 접근 요청을 직접 허용한다. 키 자체나 비밀번호를 출력·전송하지 않으며 키 ACL을 넓히지 않는다. Keychain 앱 실행 허용과 실제 복구 키 읽기 성공은 별도 단계다.

### 온라인 백업 방식과 이메일 수신

2026-09-10에 일일 중단 백업을 온라인 방식으로 전환했다. 2026-09-29 자체 호스팅 운영 주기 조정에서는 위 6시간 일정과 서버 28개 보관을 적용한다. `scripts/self-host-operations/production-online-backup.mjs capture`는 실행 중인 PostgreSQL 17의 `pg_basebackup`을 사용한다. WAL을 포함한 단일 archive가 완성되지 않으면 실패한다. 별도 tablespace 또는 unlogged 사용자 테이블이 있으면 실행 전에 거절한다. WAL 보존이 부족하여 backup 중 필요한 WAL이 제거돼도 성공으로 처리하지 않는다. 이 방식은 정기 스냅샷 복구 지점이며 연속 PITR 서비스가 아니다.

Storage는 원본과 독립된 버전 파일 사본을 DB 백업 전후에 만든다. 원본 파일을 hard link하지 않는다. 같은 버전의 바이트 변경, 사본 누락, 크기 불일치 또는 경로 탈출은 실패다. `pg_verifybackup` 검증 후 network-none 복원 DB에서 실제 참조하는 모든 버전을 대조한다. 이 복원 DB만 정상 종료하여 기존 복원 도구와 호환되는 DB archive를 만든다. 운영 앱·DB의 컨테이너 ID와 시작 시각 불변을 확인한다. 동시 삭제로 필요한 버전을 확보하지 못한 경우에는 기존 성공 사본을 보존하고 실패를 알린다. 실패한 `.partial` 경로는 자동 공개·보존 삭제 대상으로 취급하지 않는다.

수동 실제 capture → 암호화 Mac 수신 → 격리 복원의 전체 행·파일 대조를 통과한 뒤 `deploy/self-host-operations/production-backup/online-backup.conf`를 기존 백업 service의 drop-in으로 설치한다. 설치된 코드 경로를 먼저 확인하고 기존 service와 timer 파일을 보존한다. 온라인 방식의 설치와 주기 변경을 구분한다. 주기 변경은 위 timer와 서버 보존 수를 함께 적용하고 Mac LaunchAgent의 매시간 수신은 유지한다. `ExecStopPost`의 기존 cold resume을 제거하기 전에 남은 resume 의도가 없음을 확인한다. 실패 시 drop-in을 제거하고 `daemon-reload`하여 이전 실행 파일로 돌아갈 수 있다. 온라인 archive도 기존 receipt·암호화·SSH list/get/ack 계약을 유지한다.

초기 준비는 `prepare-online-backup.mjs`로 현재 DB의 system identifier와 HBA 경로를 확인한 뒤 Unix socket의 `supabase_admin` replication 규칙만 추가하고 reload한다. TCP 접속 규칙은 추가하지 않는다. 원래 HBA 사본은 PGDATA 밖에 보관한다. PGDATA 안에 root 전용 파일을 두면 비root base backup이 실패한다.

`backup-alerts.conf`는 백업 service의 별도 `alerts.conf` drop-in으로 설치하며, `OnFailure`를 `ssartnership-production-backup-failure.service`로 연결한다. 온라인 전환 전에도 기존 일일 백업의 실패를 알릴 수 있다. 이 서비스는 root 전용 monitoring env에서 발송 설정만 읽고 고정 `BackupFailed` 메시지를 보내므로 telemetry가 내려가 있어도 발송을 시도한다. 호스트 전원·네트워크·메일 공급자 장애 시 전달을 보장하지는 않는다. 잠금 충돌도 실패로 남기며 기존 성공 사본을 갱신하지 않는다.

Production의 비공개 `MONITORING_ENV_FILE`에 `OPS_ALERT_EMAIL_TO`, `OPS_ALERT_EMAIL_FROM`, `OPS_ALERT_RESEND_API_KEY`를 설정한다. 수신자는 운영자가 지정한 주소 한 개이고, 발신자는 Resend 검증 도메인의 메일 주소다. 도메인 한정 발송 전용 키를 사용하며 앱 env 전체를 telemetry에 전달하지 않는다. 기존 `OPS_ALERT_WEBHOOK_URL`은 비워 두며 두 방식을 동시에 설정하거나 일부 값만 넣으면 구성 오류로 처리한다. 수신 주소와 키를 저장소·로그에 넣지 않는다.

relay는 인증된 Alertmanager 요청에서 알려진 경보명·심각도·발생/복구 상태만 이메일로 보낸다. 원문 annotations·labels·회원 정보는 보내지 않는다. 같은 사건의 중복 통지는 Resend의 24시간 idempotency로 제한하고 복구 및 새 사건은 별도 키를 사용한다. 발송 실패는 HTTP 502와 실패 지표로 남겨 Alertmanager가 실패를 관측할 수 있게 한다. API 접수 성공과 실제 메일함 수신은 구분하여 확인한다. 이 relay는 홈 서버에 있으므로 서버 전체 전원·회선 장애를 독립적으로 탐지하는 외부 감시는 별도 구성이다.

참고: [PostgreSQL 온라인 base backup](https://www.postgresql.org/docs/17/app-pgbasebackup.html), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

### PVE SSD의 상시 암호화 사본

2026-09-29 운영자 승인으로 PVE 호스트의 Samsung 850 EVO 120GB SSD를 암호화 사본 저장소로 사용한다. 당시에는 Production 노트북과 호스트가 분리되어 있었지만 2026-10-02 이후 Production VM과 이 SSD는 같은 PVE 호스트다. 장치가 달라도 호스트 고장·전원·회선에 대한 독립 장애 영역은 아니며 Mac 사본을 계속 유지한다. 시스템 NVMe는 건드리지 않는다. `/mnt/ssartnership-backups`의 ext4 UUID를 root 전용 `config.json`의 `filesystemUuid`와 대조하고, mount가 없거나 다른 디스크이면 복사를 거절한다. 파일 시스템은 `nodev,nosuid,noexec`, 부모 0700, 비밀 0600을 유지한다.

`scripts/self-host-operations/pve-backup-pull.py`와 `deploy/self-host-operations/pve-backup/`의 unit을 설치한다. 별도 source-IP 제한 SSH key와 pinned host key를 `/etc/myknow/secrets/ssartnership-backup/`에 준비한다. 임시 bootstrap 관리자 키는 재사용하지 않는다. 전용 source 계정은 고정 `list/get/ack/ack-pve` 명령만 제공하고 셸·sudo·포트 전달은 제공하지 않는다. `ack-pve`는 별도 `latest-pve.json`에만 기록하여 Mac 확인 상태를 갱신하지 않는다. 새 전송 handler와 계약 모듈을 버전 디렉터리에 설치하고 sshd 구문 확인 후 forced-command 경로만 교체한다. 기존 파일과 설정은 복귀용으로 보존한다.

PVE timer는 부팅 후 및 15분마다 복사를 확인한다. receipt 형식·크기·SHA-256, root 소유권과 symlink 차단을 검증한 뒤에만 암호문을 최종 파일로 승격하고 PVE 전용 ACK를 보낸다. 기존 파일도 다시 검증한다. 최신 사본이 8시간 이상 오래되면 실패이며, 오래된 사본을 재확인해도 복구 지점의 생성 시각은 바뀌지 않는다. 운영 서버 collector와 Prometheus는 PVE의 사본 생성 시각과 최근 ACK를 별도로 관측한다. 경보 규칙과 telemetry 이미지의 허용 경보명을 함께 반영하고 `promtool test rules`를 통과시킨다.

SSD에서는 기존 성공 사본을 자동 삭제하지 않는다. 여유 공간 4GiB를 보존할 수 없으면 실패하고, PVE ACK 노후 경보로 드러난다. 향후 보존 삭제는 확인된 성공 사본과 복구 정책을 기준으로 별도 수행한다. PVE에는 암호문만 저장하며 복구 키는 Mac Keychain envelope에 남긴다. 같은 호스트의 다른 디스크이므로 독립 호스트·지리적 재해 사본이나 연속 PITR로 표현하지 않는다.

실복구는 SSD에서 받은 암호문을 검증하고 Mac Keychain에서 복구한 키를 메모리에서만 사용하여, 운영 서버의 새 root 전용 격리 경로로 전송한다. 운영 DB mount 없이 network-none 복원으로 전체 행·Storage hash와 메타데이터를 비교한다. 2026-09-29 검증에서는 148개 테이블 175,548행, 906개 파일 42,648,961 bytes가 일치했다. 복원 도구의 `encrypted-mac-roundtrip` 표기는 전송 경로이며, 이번 복원 입력의 보관 출처는 PVE SSD다. 평문은 Mac/PVE 디스크에 남기지 않았다.

### Preview 인프라 전용 로그인

`deploy/pve/edge.Caddyfile`의 `ssartnership-infra-dev.myknow.xyz`는 인증 뒤 Production 관리 origin의 공용 대시보드로 이동하며 앱·Storage와 분리된다. `deploy/pve/compose.operations.yaml`이 mount하는 private `infra-auth/users`에는 bcrypt hash만 둔다. 실제 비밀번호는 별도 monitoring secret으로 관리하며 저장소·로그에 기록하지 않는다. Grafana는 같은 operator 계정을 자체 검증한다.

Prometheus·Alertmanager는 GET/HEAD만 허용하며 Authorization·Cookie를 제거한다. 외부 Origin, cross-site API 요청과 iframe을 차단한다. Grafana의 인증 대리 헤더는 제거한다. 운영 VM의 monitoring upstream은 같은 Compose의 서비스 이름(`prometheus`, `alertmanager`, `grafana`, `notifier`)만 사용한다.

적용 전 설정을 보존하고 Compose config와 Caddy validate를 통과시킨다. 무인증·오류 암호 401, 정상 로그인 및 각 subpath assets/API, 외부 Origin 403, 조회 서비스 POST 405, 원본 포트 loopback을 함께 확인한다. 접근 문제 시 이전 Caddyfile과 Compose 설정을 복원한다. 인증 경계만 같다고 화면 검증을 대체하지 않는다.

2026-09-09의 세 서비스별 360/820/1440px 렌더링 검증은 [Issue #452](https://github.com/MyKnow/ssartnership/issues/452)에 보존돼 있다. 2026-09-29에 두 환경의 TLS·401/403/405·Grafana API 인증을 다시 확인했다. 현재 Browser 도구는 해당 Basic 인증 페이지 진입을 차단하여 새 캡처를 얻지 못했다. 이번 소스 정리는 이미 적용된 서버 설정을 반영하며, UI 변경은 없다. Alertmanager의 기존 360px 가로 넘침과 일부 Grafana 지표 미수집은 그대로 구분한다.

### Production 외부 관측 경로

API 및 인프라 도메인은 `deploy/pve/edge.Caddyfile` 하나에 함께 정의한다. 노트북 시대에 결합하던 `Caddyfile.production` 조각과 같은 호스트 edge overlay는 [Issue #531](https://github.com/MyKnow/ssartnership/issues/531)에서 삭제했다. 앱·API upstream은 각 앱 VM의 relay 주소, 관측 upstream은 운영 VM Compose 서비스 이름이다. edge Caddy는 내부 수집용 `caddy:9180/metrics`만 노출하고 공개 origin은 JSON 접근 로그를 남긴다. 세부 계약은 [자체 호스팅 운영 문서](./self-hosting.md#공개-edge와-tls)를 따른다.

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

클라이언트는 원본 경로를 8개 고정 화면 분류로 바꾸고 `fetch`의 `keepalive`로 POST한다. 페이지 이동 중에도 브라우저가 마지막 지표 전송을 계속하도록 요청하며 `credentials: omit`으로 쿠키를 보내지 않는다. 수집은 best-effort이고 브라우저의 전송 완료나 collector 도착을 보장하지 않는다. 전송 실패를 재시도하거나 화면 이동을 막지 않는다. `/api/web-vitals`는 설정 origin, JSON content type, 512-byte 실제 body 한도, 프로세스당 분당 1200개 전역 제한과 strict schema를 적용한다. 회원/IP/세션 ID를 rate-limit 저장소에 쌓지 않는다. 추가 키·URL·metric ID·entries·비정상 수치는 거절한다. 내부 collector는 별도 token으로 인증하고 고정 histogram만 보관한다. 원본 event 저장소가 없고 Prometheus의 7일 보존 정책이 집계 데이터에 적용된다. 익명 클라이언트 수치는 위조 가능하므로 보안 감사나 과금 근거로 사용하지 않는다. 단일 app/collector 기준의 quota이며 다중 replica 도입 시 공유 ingress 제한이 필요하다.

Vercel Analytics/SpeedInsights는 제거했고(RF-04) 브라우저 성능은 이 수집 경로와 [Web Vitals·Lighthouse 측정 절차](../../performance/measurements/web-vitals.md)로만 확인한다. 제품 이벤트는 그대로 유지한다. 자체 호스팅의 웹 성능 수집은 비활성 기본값이며 monitoring overlay에서 활성화한다. 공개 GET 설정에는 활성 여부와 샘플링 비율만 들어간다. 수집 실패는 사용자 화면의 오류로 표출하지 않지만 endpoint 실패와 운영 metric으로 점검한다.


## 복원된 원본 환경의 모니터링 경계

원본 Preview/Production overlay는 `restored-service-alerts.yml`의 서비스·DB·호스트·알림 전송 규칙을 사용한다. 합성 pgBackRest 환경용 `alerts.yml`의 WAL/복원/운영 manifest collector 규칙을 이 환경의 완료 증거로 사용하지 않는다. Production에는 별도 `production-backup-alerts.yml`과 실제 snapshot/PVE/Mac collector를 함께 유지한다. 원본 Preview 정기 백업·연속 PITR은 이 변경의 구현 범위가 아니다.

Postgres exporter는 각 환경의 전체 DB 컨테이너 이름에 연결한다. 배포 전에 실제 전용 DB 네트워크 CIDR을 확인하고 `pg_hba.conf`에 그 CIDR의 `postgres` DB, `ssartnership_monitor` 역할, `scram-sha-256`만 허용한다. 기존 파일을 보존하고 `pg_hba_file_rules` 오류가 없을 때 reload한다. 앱 역할이나 공개 네트워크 접근을 확장하지 않는다. monitor는 `pg_monitor`/CONNECT만 유지하고 회원 table 조회 거절을 다시 확인한다.

Preview 외부 알림은 해당 환경의 root 전용 monitoring env에 기존 운영자 이메일 발송 설정만 연결한다. 앱 비밀·회원 데이터는 복사하지 않고 relay token/DB credential은 환경별로 유지한다. telemetry 이미지와 env 변경은 앱 교체만 수행하는 자동 receiver와 별도로 적용한다. 각 환경의 5개 target과 `pg_up=1`, 실제 실패/복구 전달을 확인하며 경보가 없어졌다는 사실만으로 백업/PITR 완료를 주장하지 않는다.

2026-09-30 운영 점검에서 원본 Preview의 기존 `ssartnership_monitor`는 이미 `pg_monitor`와 CONNECT만 보유하고 회원 조회 권한은 없었다. 실제 전용 네트워크 `172.30.85.0/24`의 해당 역할에 SCRAM 접속 규칙을 추가하고 파일 구문 확인·reload 후 Prometheus의 `pg_up=1`을 확인했다. 이전 HBA와 monitoring env는 root 전용 복구 디렉터리에 보존했다. 이메일 설정은 준비했으며 telemetry 재배포 후 실제 전달 검증과 구분한다.


## PVE 공용 감시와 운영자 알림

Grafana 13.2.1의 실제 51개 패널 조회에서 384 MiB 상한에 도달해 OOM·exit 137·재시작과 502를 확인했다. [Issue #564](https://github.com/MyKnow/ssartnership/issues/564)의 수정 상한은 768 MiB다. [공식 설치 문서](https://grafana.com/docs/grafana/latest/setup-grafana/installation/)의 메모리 최소 권고 512 MB를 넘겨 질의·bundled plugin 여유를 확보한다. 기존 공용 VM 2 GiB와 이미지·인증·데이터는 유지한다. 모든 Compose 서비스의 메모리 상한 합계는 1632 MiB여서 OS 등에 416 MiB를 남기며, 실행 가능한 자원 예산 검사가 최소치와 전체 여유를 보호한다. 실제 적용 후 세 viewport·환경 필터·전체 행의 질의와 반복 새로고침을 확인했다. 독립 자원 확인에서 OOM/재시작 증가는 없었고, peak 약 629 MiB와 VM 가용 약 833 MiB를 측정했다. 자원 검사는 이 관측을 올림한 640 MiB workload에 64 MiB의 여유를 더해 보호한다. 재점검할 때도 화면과 Docker 이벤트·VM 가용 메모리를 함께 확인한다.

PVE 이전 이후의 활성 구성은 `deploy/pve/compose.operations.yaml`이다. 이전 노트북 overlay와 구분하며 실제 적용된 VM 경계는 [PVE 이전 명세](../../specs/pve-service-migration/spec.md)를 따른다. 공용 VM 5202에서 Prometheus → Alertmanager → `notifier.mjs`가 실행된다. Production·Preview telemetry는 앱 probe와 Web Vitals만 수집하며 활성 monitoring env 및 container에서 `OPS_ALERT_*` 발송 설정을 제거한다. 다음 receiver 실행이 이 설정을 복구하지 않도록 환경별 private monitoring env도 같이 정리한다. VAPID는 기존 앱의 기능에 계속 필요하지만 notifier는 앱·DB를 호출하지 않고 별도 private 사본으로 발송한다.

### 대시보드 계약

대상은 인프라 관리 계정의 운영자이며, 한 가지 행동은 장애의 환경·VM·원인을 확인하고 대응하는 것이다. Grafana의 기존 UI·provisioning·UID를 유지한다. Next.js/TDS 컴포넌트와 Storybook을 이 도구에 이식하지 않는 예외이며 앱 UI나 공개 공유 범위는 변경하지 않는다. 첫 행의 내부 상태와 경보 수 → 활성 경보 표 → 서비스/DB → VM/물리 호스트 → 백업 → 체감 성능 → 감시 자체 상태 순으로 읽는다. Grafana 고유 색상 역할은 정상 green, 장애 red, 미연동 gray이며 수치는 단위와 범례로 함께 표현한다. 많은 패널이 있으므로 자주 보지 않는 행은 사용자 화면에서 접어 사용한다.

지표 소유자는 각 collector와 Prometheus다. VM/환경별 30초 scrape, 물리 호스트·backup outcome 1분 수집, 기존 snapshot collector 5분을 구분하며 시간대는 Asia/Seoul이다. 운영자가 보는 host/backup/notifier 전체 지표와 환경 필터를 따르는 서비스·VM·Vitals 지표를 구분한다. CPU는 비율, 메모리·디스크는 bytes와 비율, 응답 시간은 seconds, LCP/INP는 milliseconds, CLS는 무단위다. 물리 CPU는 `/proc/stat`의 1초 간격 차분이며 user/nice에 이미 포함된 guest를 중복 합산하지 않는다. 물리 가용 메모리는 `/proc/meminfo`의 `MemAvailable`을 사용하며 `MemFree`와 구분한다. 데이터 없음·미연동·표본 부족을 정상이나 0으로 대체하지 않는다. 활성 경보가 없는 경우에만 count를 0으로 표시한다. 빈 경보 표는 상단의 감시 상태와 경보 수를 함께 확인하며 패널 설명에 해석을 명시한다. 최소 5개 표본이 있는 최근 15분 Vitals p75를 표시하며 route별 p75를 다시 평균하지 않는다. `node deploy/pve/grafana/build-dashboard.mjs`로 동일 UID의 51개 패널·9개 행을 생성한다. 생성기는 `buildDashboard()`를 export하며 `tests/pve-grafana-dashboard.test.mts`가 생성물과 커밋된 JSON의 일치와 결정성을 검사하므로, 생성기를 바꾸면 JSON을 다시 생성해 함께 커밋한다.

Grafana 13.2의 Prometheus는 별도 bundled plugin이다. 고정 digest 이미지의 `/usr/share/grafana/data/plugins-bundled`를 `GF_PATHS_BUNDLED_PLUGINS`로 지정하고 `GF_PLUGINS_PREINSTALL_DISABLED=true`, `GF_PLUGINS_PREINSTALL_AUTO_UPDATE=false`로 시작 시 다운로드·갱신을 막는다. 분석용 update check를 끄는 설정만으로는 plugin 자동 설치가 꺼지지 않는다. root filesystem의 `read_only`와 plugin 서명 검증은 유지한다. `Datasource prometheus was not found`가 나타나면 datasource UID 존재만 확인하지 말고 plugin 경로·시작 로그·datasource health·실제 `/api/ds/query` 응답을 확인한다. 설정 의미는 [Grafana 공식 설정 문서](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/)와 [13.2.1 plugin 설정 소스](https://github.com/grafana/grafana/blob/v13.2.1/pkg/setting/setting_plugins.go)를 따른다.

Ingress probe는 실제 hostname의 TLS를 검증하면서 LAN 주소에 연결한다. 인증서 만료일을 읽기 위해 probe마다 새 HTTPS agent를 사용한다. 재사용 TLS session의 `getPeerCertificate()`가 빈 객체를 반환할 수 있으므로 만료 timestamp 0을 과거 날짜로 표시하지 않는다. 인증서 정보가 없으면 해당 패널은 데이터 없음으로 표시하며 probe 결과와 구분한다.

`최근 백업 작업 결과/종료 시각`은 현재 부팅 이후 systemd가 기록한 실제 종료가 있을 때만 값이 있다. 이미 확보한 snapshot/복사본의 존재와 이 값은 별개다. 복원 검증 시각은 실제 전체 행·파일 hash·Storage metadata 대조 성공의 증거를 확인한 뒤 root 전용 `restore-proof.json`에 기록하며 단순 백업 성공으로 갱신하지 않는다. PVE SATA 사본은 같은 물리 호스트의 장애 영역이다. snapshot은 연속 PITR이 아니다.

### 경보와 수신처

| 상황 | 지속/기준 | 전달 |
| --- | --- | --- |
| Production 앱·HTTPS 경로 실패, exporter 중단 | 2분 | 운영자 메일 + PWA |
| Production DB 접속 실패 | 1분 | 운영자 메일 + PWA |
| Preview 앱·HTTPS 경로·exporter/DB 실패 | 2분 / DB 1분 | warning 메일만, 1분 묶음 대기·12시간 반복 |
| 디스크 여유 / 메모리 여유 / CPU | 15% 미만 5분 / 10% 미만 5분 / 90% 초과 10분 | 디스크 critical, 나머지 warning; Preview PWA 제외 |
| PVE SMART 불량 / thin pool 데이터·메타데이터 | 2분 / 85% 초과 5분 | critical 메일 + PWA |
| PVE 수집 지연 | 5분 이상 + 2분 지속 | warning 메일 |
| 백업 지표 갱신 / 유효 snapshot / PVE copy / Mac copy | 10분 / 8시간 / 8시간 / 26시간 초과 | critical 메일 + PWA |
| PVE 복사 확인 / 복원 검증 | 40분 / 30일 초과 | critical / warning |
| 실제 백업 작업 실패 | 다음 평가 즉시 | warning 메일, 정상 작업 종료 시 복구 |
| 알림 설정 누락·발송 실패 | 2분 | critical; 이 경보가 firing이면 외부 heartbeat도 중지 |
| TLS 인증서 | 14일 미만, 10분 지속 | warning 메일 |
| 앱 의존성(gateway·Storage·DB) 준비 실패 | 2분 | Production critical, Preview warning; 앱 자체 장애 중에는 억제 |
| 공개 edge upstream 5xx 비율 | 5% 초과 + 요청 하한, 5분 | warning 메일(edge 공용) |
| Production 예약 작업 성공 없음 | 예정 주기 3배, 10분 | warning 메일 |
| 배포 수신기 성공 실행 없음 | 1시간, 10분 | warning 메일 |
| DB 연결 수 / DB 용량 증가 추세 | 최대 연결 80% 10분 / 14일 예측 증가 > VM 루트 여유, 1시간 | warning 메일 |

기본 group wait는 15초, group interval 1분, 반복 4시간이며 발생·복구를 모두 보낸다. 동일 환경·VM의 exporter 장애가 해당 앱/DB 원인 경보를 억제한다. 메시지는 고정된 경보명·환경·VM·조건·KST 시각·Grafana 링크만 포함한다. 임의 annotations/회원·경로·오류 본문을 전달하지 않는다. 발송 성공은 제공자 접수이며 실제 단말/수신함 도착과 별도로 확인한다.

내부 메일 수신자는 기존 운영자 Naver 주소다. PWA는 해당 운영자 이메일과 일치하는 `members`에 연결된 활성 admin/member 구독만 export한다. 전체 회원 구독을 복사하거나 방송하지 않는다. 세 구독을 초기 설치 시 복사했으며 endpoint가 달라진 경우 동일한 소유 검증을 거쳐 별도 갱신한다. 만료·실패는 발송 실패 metric으로 드러나고 재시도하므로 PWA 재구독 후 private 구독 파일을 갱신해야 한다.

발송기는 UID 1001, 96MiB이고 observer는 64MiB다. 포트를 호스트에 publish하지 않는다. `PVE_NOTIFIER_ENV`, `PVE_PUSH_SUBSCRIPTIONS`는 별도 승인된 서버 비밀 경로에만 보관하며 저장소·로그·Mac 평문 파일에 넣지 않는다. 구독 파일은 UID 1001/0400, 부모는 root/0700, 상태 디렉터리는 UID 1001/0700이다. 발송의 안정된 본문·순번·채널별 성공·recipient hash를 상태 파일에 원자적으로 보존한다. 제공자 idempotency key와 4시간 알림 반복을 구분하고, 메일 성공 후 일부 push 실패 시 메일과 성공한 구독을 다시 보내지 않는다. 기존 lockfile과 일치하는 web-push 3.6.7 의존성 17개만 notifier에 mount하며 node-forge는 포함하지 않는다. 이는 앱 전체 dependency audit의 해결을 의미하지 않는다.

### 외부 생존 감시와 호스트 수집

Healthchecks.io에는 `SSARTNERSHIP PVE · 감시 엔진 생존`을 1분 period·2분 grace로 설정하고 계정의 Gmail 이메일 integration을 켠다. URL은 root 전용 `PVE_HEARTBEAT_ENV`에 저장하며 문서/로그/화면 증거에 노출하지 않는다. observer는 Prometheus 규칙 평가·Alertmanager·notifier 정상과 알림 전달 실패 경보가 없을 때만 내용 없는 HEAD 신호를 보낸다. 최근 성공 신호에서 약 3분 경과 시 외부 서비스가 알림을 담당한다. 운영자에 대한 통보는 Healthchecks가 자체 발송하므로 PVE·앱·DB가 정지해도 이 경로의 발송 서버는 살아 있다. 외부 서비스/메일 자체의 전달 보장은 별도다.

observer의 Production·Preview TLS 검사는 실제 hostname/SNI/인증서 검증을 유지하고 LAN ingress로 직접 연결한다. 이 검사는 독립 회선에서 공개 DNS·WAN port forwarding을 검증하는 외부 HTTPS polling이 아니다. `ssartnership_external_monitor_configured`는 운영자가 private heartbeat env에 선언한 `OPS_EXTERNAL_MONITOR_CONFIGURED=1`일 때만 1이다. 외부 polling 서비스를 아래 [외부 HTTP 감시](#외부-http-감시-설정) 절차로 설정하고 실패·회복 알림을 실측하기 전에는 선언하지 않으며, 대시보드는 그동안 미연동으로 표시한다.

사용자가 승인한 PVE 호스트 수집은 `pve-host-metrics.service/timer`와 `/opt/myknow-monitoring/pve-host-metrics.py`다. systemd는 `ProtectSystem=strict`를 유지하며 `pvesh get`, SMART 검사, `lvs --nolocking --nohints` 보고만 실행한다. thin pool의 live kernel 통계를 숨기는 `--readonly` 옵션은 사용하지 않는다. 디스크·관리 계정·방화벽·호스트 DNS는 수정하지 않는다. `OPS_HOST_METRICS_URL`은 고정 HTTPS 주소이며 LAN IP에 연결하고 실제 hostname의 TLS를 검증한다. Caddy는 `/infra/host-metrics`의 요청을 PVE source IP `192.168.1.132`, POST, 4KB 및 전용 bearer token으로 제한하고 notifier의 숫자 allowlist·120초 timestamp 검증을 통과시킨다. 일반 관리 인증 경로는 유지한다.

Production의 `backup-status.service/timer`는 systemd 작업 결과와 검증한 restore marker를 1분마다 기존 textfile 디렉터리에 기록한다. `backup-failure-monitoring.conf`를 기존 OnFailure unit의 drop-in으로 설치하여 즉시 지표를 갱신하고 환경별 직접 이메일 발송을 없앤다. snapshot backup timer의 주기는 바꾸지 않는다.

### 안전한 적용·복귀·검증

certificate/data volume을 보존한다. `PVE_PUBLIC_SERVICES_READY`는 edge Caddyfile이 더 이상 읽지 않으므로 값이 빠져도 공개 origin이 닫히지 않는다. 새 코드·규칙을 versioned 디렉터리에 준비한 뒤 Compose config, Caddy validate, amtool, promtool unit rules를 통과시킨다. promtool은 read-only container와 임시 `/tmp`를 함께 사용한다. 바뀐 bind mount를 위해 Prometheus만 재생성하고 notifier/observer만 시작한다. Alertmanager는 HUP, Caddy 2.11.4는 USR1으로 file reload한다. 이미 bind mounted인 단일 설정 파일은 inode가 바뀌지 않도록 제자리에서 기록한다. Grafana dashboard directory provisioning은 변경된 JSON을 읽으며 사용자 계정은 변경하지 않는다.

되돌릴 때 versioned rollback의 기존 Compose·Caddy·규칙·dashboard·private monitoring env를 복구하고 같은 검증/재적용 순서로 처리한다. host timer를 stop/disable하고 승인된 host 입력 경로를 제거하면 host 수집을 철회할 수 있다. Production backup outcome timer/drop-in을 철회할 때 기존 OnFailure 발송 경로와 자격 증명도 함께 복구하여 알림이 누락되지 않게 한다. backup snapshot/원본 데이터/사용자 관리 계정은 복귀 범위에서 삭제하지 않는다.

검증은 12개 target과 모든 rule health, 숫자 지표의 신선도, 실제 source IP·token 거부, 두 앱 HTTPS, synthetic 발생/복구의 Alertmanager→발송기→제공자 접수, 재시도/중복 방지, Healthchecks 외부 실패·회복을 포함한다. Grafana API 쿼리 성공과 360/820/1440px 화면 증거는 구분한다. 브라우저가 Basic 인증 페이지를 차단하면 인증을 완화하지 않고 사용자 직접 로그인 후 화면 검증을 이어간다.

## 오류 가시성·준비 상태·예약 작업 지표

Issue #543에서 "컨테이너가 살아 있다"만 보던 감시를 서버 오류·의존성 장애·예약 작업 정체·배포 수신기 침묵까지 넓혔다. 로그 수집기(Loki 등)와 요청 상관 ID는 도입하지 않았다.

### 서버 로그 형식

서버 코드는 `src/lib/server-log.ts`의 `logServerError`/`logServerWarning`으로 한 줄 JSON을 stdout/stderr에 쓴다. 필드는 `level`, `event`(고정 라벨), `time`, `error{name, code, status, digest, message}`, `properties`다. raw error 객체, Supabase/PostgREST `details`·`hint`는 기록하지 않고 message의 이메일·토큰·URL·행 값·긴 숫자는 마스킹한다. `properties`는 공용 로그 정제기를 통과한다. 관리자 edge guard 차단 로그의 IP는 IPv4 /24, IPv6 /48 단위로만 남긴다. `tests/server-log-adoption.test.mts`가 raw error 객체나 `{ message: error.message }` 같은 provider message를 `console.error`·`console.warn`으로 직접 찍는 서버 코드의 재유입을 막는다.

홈 제휴 목록처럼 오류 화면 대신 복구 가능한 상태를 반환하는 경로도 같은 JSON 형식을 쓴다. `error.message`와 정제된 `properties.cause.message`에서 URL·이메일·행 값과 `token=...` 같은 자격 증명 대입 값을 제거한다. 원인 코드에는 정제된 `properties.cause.errorCode`를 사용하며, raw provider 객체를 properties에 넣지 않는다. Next.js redirect 등 제어 흐름은 로깅 전에 다시 던진다.

Docker `local` 로그 드라이버가 10MB×3으로 회전하므로 오래 보관해야 할 근거는 장애 기록으로 옮긴다. 운영 VM에서 최근 오류만 보려면 다음 한 줄을 사용한다.

```bash
docker logs --since 1h ssartnership-production-app-1 2>&1 | grep '"level":"error"'
```

Next.js가 잡은 모든 서버 오류(render·route·action·proxy)는 `src/instrumentation.ts`의 `onRequestError`가 `"[request-error] unhandled server error"` 한 줄로 남긴다. 경로는 route 패턴(`/admin/(protected)/members/[memberId]/page`)과 고정 route group으로만 기록한다. 사용자 오류 화면의 "오류 코드"는 Next.js digest이며 같은 줄의 `error.digest`와 대조한다. 다섯 오류 경계(`app/error.tsx`, `app/global-error.tsx`, `app/(site)/error.tsx`, `app/partner/error.tsx`, `admin/(protected)/error.tsx`)는 같은 digest 블록을 표시하고 원본 message는 렌더링하지 않는다.

### 준비 상태(readiness)

`GET /api/ready`는 gateway(PostgREST 루트 HEAD), Storage(`/storage/v1/status`), DB(service role 단건 조회)를 병렬로 확인하고 1.5초 안에 `{ ok, checks }`를 200/503, `Cache-Control: no-store`로 반환한다. 5초 동안 결과를 병합해 DB 부하 증폭을 막는다. 공개 edge는 이 경로에 404를 반환하며 telemetry 컨테이너만 앱 내부 주소로 호출한다. Docker HEALTHCHECK와 공개 health 검증은 `/api/health`(liveness)를 유지한다. 의존성 장애가 컨테이너 재시작 루프가 되면 안 되기 때문이다.

telemetry는 `OPS_APP_PROBE_ENABLED=1`일 때 30초마다 health 다음 ready를 확인하고 `ssartnership_app_ready_success{dependency}`를 노출한다. probe가 한 번도 완료되지 않으면 이 지표를 내보내지 않는다. 경보 `AppDependencyUnavailable`은 같은 환경·VM의 `AppHealthFailed` 또는 telemetry `ExporterDown`이 firing인 동안 억제된다.

### edge 5xx

운영 Prometheus는 edge Caddy의 내부 수집 listener(`caddy:9180/metrics`, 공개 미노출)를 scrape한다. host label이 없으므로 `ServerErrorBurst`는 공개 edge 전체의 reverse_proxy 응답 중 5xx 비율이다. 5%·요청 하한 0.05 req/s·5분은 기준선 측정 전의 잠정값이며, 2주 운영 후 실제 5xx 비율을 보고 조정한다.

### 예약 작업과 배포 수신기 지표

`production-cron.mjs`는 작업이 끝날 때마다 `production-cron-<job>.prom`(마지막 실행·결과·마지막 성공·예정 주기)을 Production monitoring textfile 디렉터리에 tmp+rename으로 기록한다. 지표 기록 실패는 작업 결과를 바꾸지 않는다. `ProductionCronStale`은 마지막 성공이 예정 주기의 3배보다 오래된 작업을 알린다. 개별 실패는 기존 unit의 `OnFailure` 통지(메일 또는 HTTPS webhook)가 즉시 알린다. 수료생 파일 파기처럼 항목 단위로 일부 실패한 작업은 `ok:true` 대신 5xx로 응답해 같은 통지 경로를 탄다.

배포 수신기 unit은 `SuccessExitStatus=75`로 heavy lock 충돌(다른 백업·E2E 작업 실행 중)을 건너뛴 poll로 처리한다. 수신기는 실행마다 `release-receiver.prom`을 환경별 textfile 디렉터리에 기록하고 디렉터리가 없으면 생략한다. `ReleaseReceiverStale`은 1시간 동안 성공 실행이 없을 때 알린다. 스키마 승인 대기도 실패로 집계되므로 승인 지연이 길어지면 이 경보로 드러난다.

### 경보 규칙 검사

경보 규칙·Alertmanager·scrape 설정을 바꾸면 다음 명령으로 운영 VM과 같은 digest 고정 이미지의 promtool 규칙 테스트와 amtool 설정 검사를 네트워크 없이 실행한다. `npm run verify:change`도 해당 경로가 바뀌면 이 검사를 실행하므로 Docker가 필요하다.

```bash
npm run check:alerts
```

새 경보명을 추가하면 `deploy/observability/notifier.mjs`의 `CATALOG`에 고정 문구를 함께 추가한다. `tests/pve-alert-rules.test.mts`가 누락을 막는다. DB 경보의 postgres-exporter 지표명(`pg_stat_database_numbackends`, `pg_settings_max_connections`, `pg_database_size_bytes`)은 적용 전 각 VM의 exporter 출력에서 존재를 확인한다. 지표가 없으면 규칙은 조용히 비활성으로 남는다.

### 외부 HTTP 감시 설정

GitHub Actions 예약 실행은 추가하지 않는다. 독립 회선의 외부 모니터링 서비스에서 다음을 설정한다.

1. Production `https://ssartnership.myknow.xyz/api/health`를 5분 간격 HTTP(S) 검사로 등록하고 200과 JSON 본문 `{"status":"ok"}`를 성공 조건으로 둔다. Preview는 선택 사항이다.
2. 실패 2회 연속 시 운영자 이메일로 알리고 회복 알림도 켠다. 계정·수신처는 저장소에 기록하지 않는다.
3. 공개 DNS를 일시적으로 바꾸지 말고, 존재하지 않는 경로를 대상으로 한 임시 검사로 실패·회복 알림이 실제로 도착하는지 확인한 뒤 임시 검사를 삭제한다.
4. 확인 후 private heartbeat env에 `OPS_EXTERNAL_MONITOR_CONFIGURED=1`을 추가하고 observer만 재시작한다. 대시보드의 독립 회선 HTTPS 감시가 연동됨으로 바뀐다.

### Web Vitals 보존

Web Vitals는 telemetry 컨테이너 메모리의 고정 histogram에만 누적된다. telemetry 재시작·배포 시 누적값이 0부터 다시 시작하며, 집계된 시계열은 Prometheus 보존 기간(7일·2GB)이 지나면 사라진다. 원본 이벤트 저장소는 없다. 개선 전후 비교가 필요한 기준선은 7일 안에 대시보드의 p75와 표본 수를 [성능 지식 인덱스](../../performance/index.md)의 측정 기록으로 옮긴다. Vercel Speed Insights 기준선 문서는 폐기된 측정 경로의 시점 증거다.

로컬 Docker 브라우저 검증은 [Web Vitals 측정 문서](../../performance/measurements/web-vitals.md#로컬-docker-전송-검증)를 따른다. native 호출·API 응답·collector 수신을 구분하며, 브라우저의 종료 취소 이벤트만으로 성공이나 누락을 판정하지 않는다.

### 적용 순서(운영자)

1. `deploy/pve/` 규칙·Alertmanager·Prometheus 설정과 dashboard JSON을 versioned 디렉터리에 준비하고 `npm run check:alerts`를 통과시킨다. edge Caddy의 내부 수집 listener가 먼저 적용되어 있어야 `caddy` scrape job이 `ExporterDown`을 일으키지 않는다.
2. Prometheus·Alertmanager·notifier·observer를 위 [안전한 적용](#안전한-적용복귀검증) 절차로 재적용한다. Preview relay 토큰 mount는 Alertmanager가 사용하지 않으므로 Compose에서 제거됐다.
3. Production VM에 새 cron unit(`ReadWritePaths`에 textfile 디렉터리 추가)과 control 릴리스를 설치하고 `systemd-analyze verify` 후 daemon-reload한다. 첫 실행 뒤 textfile과 `ssartnership_production_cron_last_success_seconds`를 확인한다.
4. 두 앱 VM의 수신기 unit을 교체하고 daemon-reload한다. 다음 timer 실행 뒤 `ssartnership_release_receiver_last_success_seconds`를 확인한다.
5. 앱 배포 후 내부에서 `/api/ready`가 200이고 공개 주소에서는 404인지, `ssartnership_app_ready_success`가 세 의존성 모두 1인지 확인한다.

