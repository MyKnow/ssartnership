---
title: 1인 운영 연속성과 사고 대응
type: runbook
status: current
authority: normative
---

# 1인 운영 연속성과 사고 대응

대상: 자체 호스팅 Production·Preview 운영. 권한: 승인된 운영자와 인계 수신자. 실제 계정·주소·보관 위치·키 값은 공개 저장소에 적지 않는다. 현재 정상 상태나 실제 봉인 완료를 이 문서가 증명하지 않는다.

## 복구 키 오프라인 보관

1. 현재 [Production 암호문 백업과 Keychain custody](./self-host-observability.md#production-6시간-온라인-암호화-스냅샷)의 X25519 age identity를 읽을 권한과 승인된 외부 보관 매체를 준비한다. Keychain 접근은 운영자가 승인한 기존 복구 경로를 사용하며 ACL을 넓히지 않는다. 이 내보내기 도구는 이미 승인된 비공개 identity 파일만 받으며 Keychain에서 키를 자동 추출하지 않는다. pgBackRest/Restic overlay의 암호와는 다른 자료다.
2. source 파일 0600, 목적 디렉터리 0700, 운영자 소유, 저장소 밖 절대·정규 경로를 확인한다. symlink나 기존 목적 파일이면 중단한다.
3. `node scripts/self-host-operations/export-recovery-identity.mjs <source> <destination>`을 운영자 터미널에서 실행한다. 단일 X25519 identity의 Bech32 길이·체크섬·패딩을 검사한다. 다른 키 형식이나 손상된 키는 거부한다. 경로와 결과 파일은 공유 로그에 복사하지 않는다. 출력은 성공 여부·형식 버전만 포함한다. version 1 JSON은 암호화된 봉투가 아니라 키 원문을 담은 비밀 자료이므로 승인된 암호화 매체에만 보관한다.
4. 매체 암호화·봉인·수신자·보관 위치를 비공개 인벤토리에 기록한다. 키 사본을 사용한 격리 복원 시험을 끝내기 전에는 보관 완료로 판정하지 않는다.
5. 아래 사본 가져오기와 [Production 격리 복원](./self-host-observability.md#production-6시간-온라인-암호화-스냅샷)을 수행한다. `restore-production-backup.mjs <복원경로> <databaseSystemId> <키출처>`의 마지막 선택 인자는 실제 사용한 키에 따라 `offline-escrow` 또는 `active-host`다. 생략한 오래된 호출의 영수증은 `not-recorded`다. 출처 표시는 운영자의 보고이며 봉인이나 키 진위를 증명하지 않는다.

스크립트는 덮어쓰지 않는다. 실행 파일은 배포된 `control/current` 링크를 통해 실행할 수 있지만 키 source와 목적 디렉터리는 위 정규 경로 규칙을 지켜야 한다. export는 `{"exported":true,"version":1}`, import는 `{"imported":true,"version":1}` 영수증과 exit 0을 모두 확인한다. 영수증 없는 exit 0은 완료가 아니다. 실패하면 실제 사본 생성 여부를 운영자가 확인한 뒤 새 목적 경로로 재실행한다. 어떤 경우에도 키를 표준 출력·이슈·채팅·Git에 붙이지 않는다.

실행 파일의 정규 경로 확인은 `export-recovery.mjs`, `export-recovery-identity.mjs`, `pull-recovery.mjs`, `rehearse-pulled-recovery.mjs`, `restore-production-backup.mjs`에 적용된다. 직접 경로와 `control/current` 실행은 같은 인자 검증·운영자 권한·입력 경로 규칙을 거친다. 이 실행 경로 지원이 키·백업 입력의 symlink를 허용하거나 실제 복구 완료를 증명하지는 않는다. 각 도구의 성공 영수증과 본문에 정한 사본·복원 결과를 별도로 확인한다.

### 보관 사본으로 복호화 준비

JSON은 `age -i` 입력 형식이 아니므로 `--import`로 단일 identity 파일을 만든다. 가져오기도 envelope 버전·필드·시각과 키 체크섬을 검사하며, source 0600·목적 디렉터리 0700·운영자 소유·저장소 밖 정규 경로와 기존 파일 거부 규칙이 동일하다. 운영자가 승인한 암호화 작업 매체나 격리 복원 호스트의 비공개 메모리 파일시스템을 사용한다. FileVault가 꺼진 Mac 일반 디스크에 키·DB·Storage 평문을 남기지 않는다.

아래 경로 표기는 운영자가 비공개로 정한 값으로 바꾼다. shell 추적(`set -x`)을 켜지 않는다. 원본 봉인 사본과 기존 복원 경로는 덮어쓰지 않는다.

```bash
umask 077
node scripts/self-host-operations/export-recovery-identity.mjs --import "<sealed-json>" "<private-working-directory>/identity.txt"
age --decrypt --identity "<private-working-directory>/identity.txt" \
  --output "<private-working-directory>/snapshot.tar" "<verified-ciphertext>"
```

실행 전 암호문의 bytes·SHA256·백업 ID를 성공 receipt와 대조하고 모든 출력 경로가 없는지 확인한다. 복호화는 검증한 기존 age CLI로 실행하며 키 문자열을 인자·파이프 출력으로 전달하지 않는다. 성공 exit code와 인증 복호화 완료가 있어야 다음 단계로 진행한다. 실패한 출력이나 파일 존재만으로 복구 가능 판정을 내리지 않는다.

복호화된 바깥 tar는 `database.tar.gz`, `storage.tar`, `data.env`, `compose.json`, `app.env`, `manifest.json`의 정규 파일만 담아야 한다. 경로 이탈·링크·예상하지 않은 항목이 없음을 검토한 뒤 Production 복원 도구가 허용하는 새 root 전용 격리 경로에만 푼다. `databaseSystemId`를 receipt·manifest와 대조하고 위 `restore-production-backup.mjs`를 `offline-escrow`로 실행한다. 원본 DB·Storage mount와 외부 네트워크 없이 전체 행·파일 동등성이 확인되어야 실제 복원 완료다. 이번에 만든 작업용 identity와 평문은 종료 후 정확한 경로를 확인해 정리하고 봉인 원본은 보존한다. 파일 삭제만으로 매체의 안전한 소거를 증명하지 않는다.

## 경보별 첫 조치

[경보 정본](../../../deploy/pve/service-alerts.yml), [복구 서비스 경보](../../../deploy/observability/restored-service-alerts.yml), [백업 경보](../../../deploy/observability/production-backup-alerts.yml)의 이름을 기준으로 한다. 실제 수신 경로는 비공개 기록에 둔다.

| 경보 | 첫 조치 |
| --- | --- |
| AlertDeliveryUnavailable | 발송 relay·수신 영수증을 확인하고 비공개 대체 연락 경로로 장애를 전달한다. |
| AppDependencyUnavailable | DB gateway·REST·Storage의 독립 probe와 앱 요청 결과를 대조한다. |
| AppHealthFailed | 대상 서비스와 exporter 자체 상태를 각각 확인하고 최근 배포·재시작·설정 변경을 대조한다. |
| ArchiveUnhealthy | 대상 서비스와 exporter 자체 상태를 각각 확인하고 최근 배포·재시작·설정 변경을 대조한다. |
| BackupFailed | 최근 성공 영수증·외부 사본·복원 시험 시각을 대조하고 마지막 유효 사본을 보존한다. |
| BackupMissingOrStale | 최근 성공 영수증·외부 사본·복원 시험 시각을 대조하고 마지막 유효 사본을 보존한다. |
| CertificateExpiring | 공개 인증서 만료와 갱신 결과를 확인하고 승인된 인증서 갱신 경로를 사용한다. |
| DatabaseConnectionsHigh | DB 연결·잠금·용량과 최근 변경을 확인한다. 복원/정리는 검증한 사본과 승인된 절차로 진행한다. |
| DatabaseSizeForecast | DB 연결·잠금·용량과 최근 변경을 확인한다. 복원/정리는 검증한 사본과 승인된 절차로 진행한다. |
| DatabaseUnavailable | DB 연결·잠금·용량과 최근 변경을 확인한다. 복원/정리는 검증한 사본과 승인된 절차로 진행한다. |
| ExporterDown | 대상 서비스와 exporter 자체 상태를 각각 확인하고 최근 배포·재시작·설정 변경을 대조한다. |
| HostCpuBusy | 프로세스·컨테이너별 점유와 최근 배포를 확인하고 작업 폭증 원인을 줄인다. |
| HostDiskLow | 비공개 디스크 지도와 용량·SMART·pool 상태를 대조한다. 사본 확인 전 파일·볼륨을 삭제하지 않는다. |
| HostMemoryLow | 프로세스·컨테이너별 점유와 최근 배포를 확인하고 작업 폭증 원인을 줄인다. |
| IngressEndpointDown | 서비스 외부에서 DNS·TLS·HTTP를 확인하고 내부 health와 ingress 상태를 대조한다. |
| OffhostBackupFailed | 최근 성공 영수증·외부 사본·복원 시험 시각을 대조하고 마지막 유효 사본을 보존한다. |
| OffhostBackupStale | 최근 성공 영수증·외부 사본·복원 시험 시각을 대조하고 마지막 유효 사본을 보존한다. |
| OperationsExporterStale | 대상 서비스와 exporter 자체 상태를 각각 확인하고 최근 배포·재시작·설정 변경을 대조한다. |
| ProductionBackupCollectorStale | 최근 성공 영수증·외부 사본·복원 시험 시각을 대조하고 마지막 유효 사본을 보존한다. |
| ProductionBackupJobFailed | 최근 성공 영수증·외부 사본·복원 시험 시각을 대조하고 마지막 유효 사본을 보존한다. |
| ProductionBackupStale | 최근 성공 영수증·외부 사본·복원 시험 시각을 대조하고 마지막 유효 사본을 보존한다. |
| ProductionCronStale | 해당 작업 결과와 timer 활성 여부를 확인한다. 중복 실행 전에 멱등성과 진행 중 실행을 확인한다. |
| ProductionMacBackupStale | 최근 성공 영수증·외부 사본·복원 시험 시각을 대조하고 마지막 유효 사본을 보존한다. |
| ProductionPveBackupPullStale | 최근 성공 영수증·외부 사본·복원 시험 시각을 대조하고 마지막 유효 사본을 보존한다. |
| ProductionPveBackupStale | 최근 성공 영수증·외부 사본·복원 시험 시각을 대조하고 마지막 유효 사본을 보존한다. |
| ProductionRestoreDrillStale | 최근 성공 영수증·외부 사본·복원 시험 시각을 대조하고 마지막 유효 사본을 보존한다. |
| PveDiskUnhealthy | 비공개 디스크 지도와 용량·SMART·pool 상태를 대조한다. 사본 확인 전 파일·볼륨을 삭제하지 않는다. |
| PveHostCollectorStale | 대상 서비스와 exporter 자체 상태를 각각 확인하고 최근 배포·재시작·설정 변경을 대조한다. |
| PveThinPoolLow | 비공개 디스크 지도와 용량·SMART·pool 상태를 대조한다. 사본 확인 전 파일·볼륨을 삭제하지 않는다. |
| ReleaseReceiverStale | 요청 SHA·서명 검증·현재 배포 영수증을 대조하고 적용 여부가 불명확하면 재요청을 보류한다. |
| RestoreDrillStale | 최근 성공 영수증·외부 사본·복원 시험 시각을 대조하고 마지막 유효 사본을 보존한다. |
| ServerErrorBurst | 오류 발생 시각·경로·배포 SHA를 대조한다. 개인정보를 포함하지 않은 로그로 영향 범위를 좁힌다. |
| ServiceDown | 대상 서비스와 exporter 자체 상태를 각각 확인하고 최근 배포·재시작·설정 변경을 대조한다. |

## 사고 기록 형식

| 항목 | 기록 내용 |
| --- | --- |
| 시작·인지·복구·종료 시각 | 시간대 포함, 근거 영수증과 대응 |
| 영향 | 환경, 실패한 사용자 과업, 확인한 범위 |
| 변경 | 적용 SHA/image, schema 버전, 변경 시각 |
| 대응 | 담당 역할, 실행 근거, 결과, 중단/rollback 판단 |
| 원인·재발 방지 | 확인 사실과 가설 구분, 후속 Issue와 완료 근거 |

사용자 식별자·요청 본문·키·내부 주소는 비공개 사고 기록에 최소한으로만 남긴다. 공개 이슈에는 영향과 정제한 결과를 적는다.

## 접근·디스크·시크릿 인벤토리

비공개 매체에 아래 형식으로 기록한다. 공개 문서에는 실제 값을 채우지 않는다.

| 접근 대상 | 승인 역할 | 접근 경로 식별자 | 인증 방식 | 복구 절차 식별자 | 마지막 검증일 |
| --- | --- | --- | --- | --- | --- |
| 운영 호스트·DB·백업·관측 | 역할명 | 비공개 참조 | 방식명 | 비공개 참조 | 날짜 |

디스크 지도는 라벨, 장치 식별자, 물리/가상 연결, filesystem/pool, mount, DB/WAL/Storage/백업 배치, 외부 사본 여부를 실측한다. 장치명만 보고 역할을 추정하지 않는다. 지도 정정은 운영자 실측 뒤 한다.

시크릿 인벤토리는 env 매니페스트의 항목명, 보관 참조, 사용 서비스, 승인 역할, 마지막 갱신일, 정책상 갱신/만료 주기, 폐기·복구 절차만 기록한다. 실제 값·계정·recipient는 공개 문서에 두지 않는다. 주기는 승인된 정책이나 provider 만료를 따르며 임의의 30/90일 주기를 만들지 않는다.

## 외부 HTTP 감시

호스트·가정 네트워크·동일 전원과 다른 장애 경계에서 제공되는 감시 서비스를 운영자가 선택한다. 공개 URL의 DNS·TLS·HTTP 성공/본문을 검사하고 수신 경로를 확인한다. private raw port나 인증 토큰을 URL에 포함하지 않는다. 내부 probe와 외부 probe를 끊는 시험으로 각각의 감지·수신을 확인한다. 설정 절차 준비와 실제 외부 감시 활성화는 별도 판정이다.

## 인계와 공개 정보

인계자는 배포/rollback, 로그인 복구, DB·Storage 복원, 외부 사본 확인, 경보 수신, 오프라인 키 복원 시험의 영수증을 함께 넘긴다. 수신자가 격리 환경에서 직접 재현하고 접근 철회·변경 권한을 확인해야 인계를 완료한다. 실측·키 봉인·외부 계정 생성은 운영자 수행 항목이다.

공개 저장소에는 역할·경계·절차·검증 형식이 필요하다. 호스트 IP, mount 실제 값, 개인 계정과 보관 위치는 불필요한 배치 정보다. 기존 공개 이력은 무단 수정하지 않고 비공개 문서로 이동할 대상을 평가하며, 새 문서에 실제 인프라 값을 추가하지 않는다. 노출된 비밀이 확인되면 이력 삭제보다 먼저 폐기·갱신한다.

| 월 운영 비용 항목 | 기간 | 금액·통화 | 근거 참조 | 부담 역할 |
| --- | --- | --- | --- | --- |
| 도메인·외부 사본·메일·전원/장비·감시 | 월 | 운영자 입력 | 비공개 청구 기록 | 역할명 |

15기 종료 방향은 [ADR-0002](../../decisions/ADR-0002-cohort-service-continuity.md)의 미결정 선택지다.
