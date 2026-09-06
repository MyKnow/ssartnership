---
title: 자체 호스팅 백업 PITR 운영 관리
type: runbook
status: current
authority: normative
---

# 자체 호스팅 백업·PITR·운영 관리

[데이터 실행 절차](./self-host-database.md)로 만든 환경에 운영 overlay를 적용한다. 이 절차의 named backup volume은 로컬 실행·복구 검증용이다. 운영 전에는 백업을 서버와 다른 장애 영역에 저장하고 복호화 키를 서버 밖에 보관해야 한다.

## 초기화와 백업

DB와 운영 도구는 같은 데이터 환경 파일을 참조한다. 별도 운영 환경 파일에는 난수 백업 암호와 저장소 설정만 둔다. 생성된 파일은 소유자 전용 권한으로 보관하고 터미널·CI 로그에 내용을 출력하지 않는다.

```bash
npm run self-host:operations -- init --env-file .tmp/self-host/data.env --operations-env-file .tmp/self-host/operations.env
docker compose --env-file .tmp/self-host/data.env --env-file .tmp/self-host/operations.env -f compose.supabase.yaml -f compose.operations.yaml up -d --build db rest storage gateway
npm run self-host:operations -- backup --type full --env-file .tmp/self-host/data.env --operations-env-file .tmp/self-host/operations.env
npm run self-host:operations -- backup --type incr --env-file .tmp/self-host/data.env --operations-env-file .tmp/self-host/operations.env
npm run self-host:operations -- check --env-file .tmp/self-host/data.env --operations-env-file .tmp/self-host/operations.env
npm run self-host:operations -- status --env-file .tmp/self-host/data.env --operations-env-file .tmp/self-host/operations.env
```

pgBackRest가 포함된 PostgreSQL 이미지는 전용 build context에서 만든다. 원래 PostgreSQL 초기화 계약을 유지하면서 WAL archiving과 암호화 repository를 추가한다. 백업 결과의 ID·시각·WAL과 Restic snapshot ID를 기록한 manifest를 보관한다. 명령 성공만 기록하지 말고 repository 검사와 새 대상 복원 결과까지 연결한다.

운영 overlay를 적용한 환경의 시작·재생성은 위의 두 Compose 파일을 합친 명령으로 고정한다. `self-host:database up`은 backup 관리 label 또는 해당 환경의 pgBackRest 저장소 볼륨을 발견하면 거절한다. 수동 Docker 명령까지 차단하는 장치는 아니므로 두 파일을 생략하지 않는다. `status`는 현재 `archive_mode`·`archive_command`도 검사하며 과거 성공 통계만으로 정상 표시하지 않는다. `secondsSinceLastArchived`는 최근 보관 후 경과 시간이지 실제 미보관 WAL 지연이나 RPO 보장은 아니다.

첫 paired checkpoint 구현은 앱·gateway·REST·Storage 중 실행 중인 쓰기 진입점을 잠시 중단하고 파일과 DB 복구 지점을 맞춘 뒤 해당 서비스만 재시작한다. 따라서 서비스 중단이 발생하며 관리형 무중단 백업과 동등하지 않다. 2026-09-06의 작은 synthetic 데이터에서는 stop 시작부터 resume 명령 종료까지 전체 백업 약 52초, 증분 약 19초였다. 이는 실사용 데이터·실제 HTTP 가용성 측정이나 운영 RTO 보장이 아니다. 자동 타이머를 설치하기 전에 유지보수 시간을 확정하거나, 무중단이 필요하면 객체 versioning·일관된 snapshot 방식으로 개선한다.

부분 stop 오류도 이전 실행 서비스 목록을 보존하여 재개를 시도한다. 명령 timeout, SIGKILL, 호스트 장애 뒤에는 Docker 내부의 pgBackRest/Restic 작업이 끝났는지 확인하고 중단된 앱을 재개해야 한다. 남은 `operations-state/operations.lock`을 확인 없이 지우거나 재시도하지 않는다. scheduler는 아직 설치·활성화하지 않았다.

## 복구 검사

복구 명령은 새로운 대상 볼륨만 사용한다. 기존 DB·파일 볼륨에 덮어쓰거나 운영 환경을 자동 전환하지 않는다. 복원 컨테이너는 공개 포트와 외부 네트워크 없이 시작하고 `archive_mode=off`로 원본 WAL 저장소에 복구 timeline을 쓰지 않는다. 앱·Cron·메일·push·외부 callback을 실행하지 않으며 실습용 DB는 `shared_preload_libraries`도 비워 복원된 `pg_cron`·`pg_net` worker의 자동 실행을 막는다. 실제 전환 전에는 필요한 확장과 작업을 검토하여 의도적으로 재활성화한다.

1. 저장소 검사와 복구할 manifest의 DB backup·WAL·파일 snapshot 존재를 확인한다.
2. manifest의 복구 지점을 새 PostgreSQL 대상에 복원한다.
3. 복구 지점 전 marker는 존재하고 이후 marker는 없는지 확인한다.
4. 짝지은 Restic snapshot을 새 파일 대상에 복원하고 실제 내용/hash를 비교한다.
5. 검사 결과·백업 ID·복구 지점·파일 snapshot·소요 시간을 기록한다.

```bash
npm run self-host:operations -- restore-drill --env-file .tmp/self-host/data.env --operations-env-file .tmp/self-host/operations.env
```

기본값은 최근 성공 manifest의 named 복구 지점이다. 실습 대상은 종료 후 보존되므로 결과를 검토할 수 있다. `status`는 최초 `check` 또는 복구 실습을 아직 하지 않은 상태도 정상 준비 완료로 표시하지 않는다.

DB의 임의 시점 PITR은 해당 시점의 파일 바이트를 자동 복원하지 않는다. 공개·비공개 Storage의 객체는 별도 snapshot으로 복원한다. 삭제/overwrite가 있었으면 DB와 객체의 일관성을 검증한 checkpoint를 선택하거나 복구 차이를 명시적으로 조정한다. [pgBackRest 복구](https://pgbackrest.org/user-guide.html), [Restic 복원](https://restic.readthedocs.io/en/stable/050_restore.html)을 따른다.

실제 전환 전에는 만료·삭제된 회원 정보와 인증 파일, retention 정책, 이미 발송한 메시지·예약 작업을 재조정한다. 복구가 개인정보나 외부 작업을 되살리지 않도록 검토하고 필요한 session·provider credential을 교체한다. 복구 실습의 성공은 운영 전환 허가나 실제 발송 성공의 증거가 아니다.

## 스케줄·감시·보관

호스트 스케줄은 전체 백업·증분 백업·정기 저장소 검사·상태 확인을 실행한다. 중복 백업을 잠금으로 제한하고 실패 코드를 감시한다. 백업 나이, WAL 아카이브 실패/지연, 최근 검사·복구 실습, 디스크 여유와 서비스 상태를 외부 감시 대상으로 연결한다. 서버의 systemd 템플릿은 검토 후 설치하며 실제 타이머 발화와 실패 알림 수신을 확인한다.

현재 기본 정책은 pgBackRest의 최근 전체 백업 2개와 그에 필요한 chain이다. Restic은 각 snapshot의 DB backup tag를 현재 pgBackRest 목록과 비교하고, DB 백업이 만료된 관리 대상 snapshot만 명시적 ID로 `forget --prune`한다. 고유한 backup tag마다 별도 보존 그룹을 만들어 영구 누적하거나, 살아 있는 DB chain의 파일을 날짜 정책으로 먼저 삭제하지 않는다. audit manifest는 만료 후에도 남으므로 과거 manifest 존재를 복구 가능 증거로 보지 말고 실제 backup·WAL·snapshot 존재를 확인한다. 보존 후보 선택은 단위 테스트했으며 장기 자동 만료·용량 회수는 운영 전 별도 실습한다. [Restic 보관 정책](https://restic.readthedocs.io/en/stable/060_forget.html)을 따른다.

동일 호스트의 repo는 서버·디스크 분실에 대한 복구 수단이 아니다. 운영 전 외부 repository 접근·용량·암호화·독립 키 보관을 설정하고 새 장치에서 복원한다. 초기 보관 일수·RPO/RTO 후보는 [기술 계획](../../specs/self-host-database/plan.md)에 있으나 실제 보장은 부하·장애·복구 실습으로 확정한다.

## 업그레이드와 관리 권한

앱·데이터·백업 이미지는 버전과 digest로 검토한다. PostgreSQL major 변경은 기존 데이터 볼륨에 새 이미지만 바꾸는 작업이 아니다. 격리 복원/업그레이드 검증과 rollback 경로가 필요하다. pgBackRest의 local/remote 버전은 맞추고 업그레이드 후 WAL과 backup/restore를 다시 확인한다.

운영 명령은 로컬/SSH 접근 통제, Git 변경 검토와 제한된 배포 권한으로 제공한다. HTTP 공개 관리 API나 앱 관리자 화면에 Docker·DB 관리자 권한을 연결하지 않는다. CI runner에는 운영 DB key를 주지 않고, 홈 서버에서 빌드·백업·복구 동시 실행은 용량 측정 후 제한한다.

운영 준비의 남은 항목은 [작업 목록](../../specs/self-host-database/tasks.md)이 정본이다.
