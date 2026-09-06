---
title: 자체 호스팅 격리 CI와 배포 및 유지보수
type: runbook
status: current
authority: normative
---

# 격리 CI·배포·유지보수

[데이터 계획](../../specs/self-host-database/plan.md), [관측 운영](./self-host-observability.md), [진행 증거](../../specs/self-host-database/tasks.md)를 함께 따른다. 아래 구현은 기존 GitHub/Vercel/Supabase Production을 중단하지 않는 별도 synthetic Preview용이다. 공개 ingress·실제 데이터 전환·외부 알림/재해 백업을 완료한 것으로 해석하지 않는다.

## 권한과 소스 승인

운영 Docker는 root, 빌드 Docker는 기존 `ci-builder` UID 1001의 rootless engine이다. 프로젝트 도구는 기존 `myknow-ci-exec`의 1 job·30분·15GiB 여유 공간 및 사용자 slice 자원 제한을 바꾸지 않는다. CI container에는 작업 소스 bind만 제공하고 Docker socket·운영 env·백업 키·SSH 키를 제공하지 않는다. container의 UID 0은 rootless namespace에서 호스트의 ci-builder로 매핑되며 호스트 root가 아니다. 외부 사이트 크롤링이나 신뢰되지 않은 PR에는 이 구성을 사용하지 않는다.

운영자는 `prepare.mjs <새 디렉터리> <40자리 SHA> <refs/heads/typed-branch 또는 dev> <linux/amd64 또는 linux/arm64> <site origin> <Supabase origin>`으로 Git archive와 승인 JSON을 만든다. 해당 ref의 실제 commit과 일치해야 하며 symlink/gitlink·경로 이탈을 거절한다. 저장소, ref, SHA, archive SHA256, 플랫폼, 공개 origin, 24시간 미만 승인 만료가 고정된다. 비밀·원격 URL 자격 증명은 입력하지 않는다. `main`·PR refs·다른 저장소는 거절한다.

입력은 `/var/lib/ssartnership-ci/inputs/<승인 ID>/`에 root 소유 0444 파일, 부모 root 0755로 설치한다. 빌더가 소유한 `/srv/ci` 아래에는 승인 정책을 두지 않는다. 빌더는 부모 디렉터리를 교체할 수 있기 때문이다. 제어 코드도 `/opt/ssartnership/`의 root 소유 version 디렉터리에 설치한다. 프로젝트의 고정 Node는 `deploy/self-host-operations/install-node-runtime.sh`로 설치하며 시스템 Node를 바꾸지 않는다.

CI 실행은 root 운영자가 공유 heavy lock을 잡고 기존 runner를 호출한다. `<...>`는 실제 검증된 절대 경로로 치환하며 shell에서 사용자 입력을 eval하지 않는다.

```text
flock --nonblock --conflict-exit-code 75 /var/lib/ssartnership-ci/heavy.lock
  sudo -u ci-builder /usr/local/bin/myknow-ci-exec
  /opt/ssartnership/node24/node <root-owned-controller>/scripts/self-host-ci/runner.mjs
  <root-owned-request.json> <root-owned-source.tar>
  /srv/ci/artifacts/ssartnership/<40자리 SHA>-<12자리 job ID>
```

자동 GitHub runner 등록이나 공개 webhook을 설치하지 않는다. 초기 버전은 **승인된 입력을 받아 실행하는 수동 trigger pipeline**이며 변경 감지/polling이 활성화된 Continuous Delivery는 아니다. 향후 protected dev 이벤트 연결도 같은 승인·stale-ref·공유 잠금 경계를 통과해야 한다. Production 승격은 별도 수동 승인이다.

## 검증과 이미지 전달

고정 Playwright image와 Node 24.18.1/npm 11.16.0으로 trusted install → docs → 전체 Quick → standalone Production build → 전체 E2E를 실행한다. [공식 Docker 안내](https://playwright.dev/docs/docker)의 package/browser 버전 일치를 유지한다. 기본 저장소의 E2E suite·auth fixture·테스트 30초 제한을 유지하며 전용 container config에서 retries 0·첫 실패 종료·영상 off·실패 screenshot/trace 보존을 적용한다. 영상 인코딩 CPU와 개발 서버의 cold compile은 기능 assertion과 분리한다. [webServer/global setup](https://playwright.dev/docs/test-webserver) 이후 검토된 유한한 loopback GET 경로를 리디렉션 없이 한 번씩 준비하고, 별도 mock 관리자 세션으로 관리자 페이지를 컴파일한다. 관리자 GET도 동일 origin·허용 경로에 한정된 최대 6회 redirect, 경로당 총 90초 제한을 적용한다. 각 컴파일 준비 시간을 따로 기록하며 reset POST·업무 데이터 생성·테스트 재실행은 하지 않는다.

Production standalone 산출물은 한 번 빌드하고 `App.Dockerfile`로 그대로 포장한다. E2E의 `.next-e2e`와 Production `.next`는 분리된다. 수용한 공개 origin manifest는 runtime 검증에 그대로 전달하고, 이미지에는 운영 비밀을 넣지 않는다. app·telemetry·pgBackRest DB 이미지가 모두 완성되어야 `result.json`을 게시한다. 실패·만료·부분 artifact는 배포할 수 없다. 로그와 실패 work directory는 유지하며 전체 prune을 하지 않는다.

전용 E2E 개발 서버에만 `NODE_OPTIONS=--max-old-space-size=1536`을 적용한다. 고정 Next 16.2.11 개발 CLI는 명시적 값이 없으면 `os.totalmem()` 절반을 V8 heap 상한으로 사용해 부모 사용자 slice의 더 낮은 MemoryHigh를 넘을 수 있었다. 실제 진단에서 Next RSS 약 2.97GiB·반복적인 memory.high 회수·swap을 확인했다. 이 값은 JavaScript heap 상한이며 전체 프로세스/container 메모리 보장이 아니다. 원래 서버 slice·container 제한·Production build 설정·제품 테스트 제한은 변경하지 않는다. [Next 메모리 운영 안내](https://nextjs.org/docs/app/guides/memory-usage)와 실제 cgroup 압력을 함께 확인한다.

배포 운영자의 `import.mjs <request> <artifact directory> <새 release-stage directory>`는 다음을 검사한다.

- root 소유 승인 및 builder 전용 regular file. pinned directory FD와 NOFOLLOW로 symlink/디렉터리 교체를 방어한다.
- exact source/request SHA256, 전체 archive hash, 예상 세 component와 tag·플랫폼·revision.
- tar header checksum, 크기/개수 상한, 경로·중복·symlink/hardlink/device/PAX 거절, content-addressed blob hash.
- Docker classic config ID와 containerd manifest/index ID를 구분해 같은 config/layer를 가리키는지 확인.
- 원본 OCI index를 버리고 승인한 한 이미지의 manifest/config/layer만 새 tar에 복사. 모든 검사가 끝난 뒤 운영 engine에 적재한다.
- 적재 후 config·layer·플랫폼·revision을 다시 확인하고 실제 운영 engine의 immutable ID를 `images.env`에 기록한다. 재포장으로 바뀐 manifest ID와 원본 ID/config digest 대응은 `loaded.json`에 남는다.

파일 hash는 전송 무결성과 승인된 입력의 연결 증거다. 손상된 빌드 호스트 자체를 신뢰할 수 없게 만드는 독립 서명/재현 빌드 증명은 아니다. 빌더 업데이트와 저장소 검토는 별도 공급망 신뢰 경계다.

## Preview 설치와 rollback

`install-release.mjs`는 승인된 source archive의 hash를 확인하고 새 root 소유 release 디렉터리에만 설치한다. `bootstrap-preview.mjs`는 해당 승인·AMD64·고정 loopback origins를 확인하고 새 `ssartnership-home-preview`의 비밀·볼륨·199개 이상 migration·Storage/RPC smoke·관측 서비스를 준비한다. 기존 env가 있으면 재초기화하지 않는다. 실패한 bootstrap을 무작정 다시 실행하지 말고 생성된 키·볼륨·성공 단계를 보존한 채 미완료 단계만 조사한다.

원본 운영 데이터는 반입하지 않는다. 새 DB에 남은 두 폐기된 기본 banner seed만 비활성화한다. 운영/복원 DB에는 이 seed 조정을 실행하지 않는다. 외부 Mattermost/메일 등 실제 연동은 비활성/미설정이며, synthetic DB를 실서비스 데이터로 오해하지 않는다. 서비스 포트는 loopback에만 공개하고 `compose.server.yaml`로 자원/로그 상한을 적용한다.

앱 교체는 `switchApplication`이 immutable image로 app 서비스만 갱신하고 실제 container 이미지와 health·로그인 GET 200을 검사한다. 실패하면 이전 이미지로 돌아가 다시 검사하며 rollback 실패를 별도 오류로 보고한다. 초기 배포에 이전 이미지가 없으면 앱만 중단한다. 데이터 볼륨·schema는 이 경로에서 삭제/역변환하지 않는다. DB major 또는 비호환 migration rollback은 새 환경의 복구/전환 절차다.

## 유지보수

`maintenance.mjs`의 고정 명령은 전체/증분 백업, 저장소 검사, 새 볼륨 격리 복구, 운영 metric 수집, 읽기 전용 DB 점검, 상태 및 외부 사본 capture/check다. DB 점검은 5초 SQL 제한 아래 DB 크기·최장 transaction·live/dead tuples·deadlock·autovacuum 활성만 집계한다. table/회원/SQL 본문을 metric label에 기록하지 않으며, dead tuple 수를 실제 bloat 측정으로 부르지 않는다. VACUUM FULL·REINDEX·retention 삭제·키 교체는 자동 실행하지 않는다.

`install-maintenance.mjs`는 새 Preview에만 여섯 timer를 설치한다: 매분 metric, 15분 DB 점검, KST 일요일 03시 전체/나머지 요일 03시 증분, 일요일 05시 저장소 검사, 매월 첫 토요일 06시 격리 복구. 무거운 명령은 CI와 같은 heavy lock을 사용하고 충돌은 75로 실패한다. 지표 수집은 가벼운 읽기이므로 빌드 중에도 동작한다. 외부 수신처가 없는 offhost timer와 제품 Cron은 활성화하지 않는다. 생성된 timer가 active인 것과 예정 시각의 실제 성공은 별도 증거다.

운영 체크리스트:

- 매일 서비스·백업 나이·WAL 보관·디스크/메모리·실패 unit을 확인한다. lock 충돌로 놓친 백업도 최근 성공 나이로 드러나야 한다.
- 매주 전체 저장소 읽기 검사 범위와 외부 사본을 확인한다. 현재 내부 Restic check는 10% subset이므로 이를 매번 전체 검사로 표현하지 않는다.
- 매월 새 볼륨 DB/Storage 복원, source 접근 없이 외부 사본 복구, 운영자 수신 알림, 이미지 업데이트 리허설을 확인한다.
- CI work·실패 trace·이전 이미지·drill 볼륨의 크기와 소유 receipt를 조사한다. 정리는 승인된 정확한 job/volume 단위로 하고 active deployment/backup chain·원본 환경을 제외한다. 자동 전체 삭제는 없다.
- 키 교체는 목적별로 분리한다. 세션 키 교체의 로그아웃 영향, DB/JWT·PostgREST·Storage 동시 갱신, Mattermost V1/V2 이행, Restic 새 키 검증과 이전 키 보관을 별도 리허설한다. 암호화 저장소 키를 단순 env 교체로 회전하지 않는다.
- timeout/강제 종료 때에는 Docker daemon 내부 backup process가 systemd unit 종료 후에도 남을 수 있다. 먼저 실제 process·pgBackRest lock·operations receipt를 확인한다. 실행 중 writer가 없는지 확인하기 전 stale operations lock을 지우거나 앱/Storage 쓰기를 재개하지 않는다. 실패 기록을 보존하고 원래 실행 중이던 서비스만 복구한다.
- 설치된 영구 서비스/파일은 bootstrap SSH 계정 만료만으로 제거되지 않는다. 계정 만료·SSH·방화벽·재부팅 정책을 변경하지 않는다.

현재 구현의 남은 공개 전환 게이트: trusted reverse proxy와 실제 요청 지연/오류 수집, 실제 도메인/TLS, 외부 독립 probe, 운영 데이터/파일·실제 인증/메일/push, 독립 백업 목적지와 키 보관, 전원/회선 장애 복구, 지속 trigger 연결 및 서버 자원 한계 검증이다.

## 별도 장치 반출·복구

독립 REST 백업 목적지가 결정되기 전의 장치 고장 대비 경로는 `pull-recovery.mjs <새 .tmp bundle 디렉터리> <별도 새 .tmp 키 디렉터리>`다. 기존 pinned VPN SSH wrapper로 읽기 반출하며 새 listener·포트 전달·SSH 개인키 복사를 하지 않는다. 운영 heavy/operations 잠금 안에서 최신 paired manifest와 암호화된 pgBackRest/Restic 저장소를 고정한다. 키 묶음은 Mac에서 생성한 RSA 4096 공개키에 RSA-OAEP-SHA256/AES-256-GCM으로 봉인한다. 서버에는 수신 공개키만 전달한다.

수신 `.partial`은 SSH 성공·크기 확인 뒤에만 완성 tar로 바뀌고 SHA256 receipt를 남긴다. 실패 사본과 키는 조사용으로 보존한다. Mac 개인키는 0600의 별도 디렉터리에만 저장하지만 동일 디스크의 디렉터리 분리는 독립 키 보관이 아니다. FileVault/오프라인 키 보관·별도 장애 영역 백업은 따로 확인해야 한다. 이 사본과 `.tmp`를 비밀 없는 QA artifact처럼 공개하거나 Git에 추가하지 않는다.

`rehearse-pulled-recovery.mjs <bundle 디렉터리> <Mac private PEM 경로> <승인 DB image의 sha256 ID>`는 전송 receipt/hash, 키 봉인, paired ID, image revision/AMD64를 확인한다. tar는 host 경로가 아닌 새 Docker volume에만 펼치고, 백업 암호 두 개만 새로운 격리 Compose 환경에 전달한다. 원본 앱 비밀·볼륨·경로·외부 연동을 재사용하지 않는다. Mac ARM64에서는 서버와 같은 AMD64 이미지를 사용해 물리 PostgreSQL 복구를 시험하며 이를 native ARM64 물리 복구 지원으로 해석하지 않는다. 네트워크 없는 PITR의 before/after marker와 복원 Storage hash가 모두 맞아야 `restored: true`를 기록한다.

같은 집의 Mac 사본은 서버 디스크 고장에 대한 별도 장치 복구 증거일 뿐, 화재·도난·지역 회선/전원 장애에 대한 geographic DR 또는 정기 외부 백업 성공 증거가 아니다. 실제 외부 목적지와 운영자 알림 채널이 결정되기 전에는 그 전환 게이트를 닫지 않는다.
