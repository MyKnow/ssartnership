---
title: 자체 호스팅 격리 CI와 배포 및 유지보수
type: runbook
status: current
authority: normative
---

# 격리 CI·배포·유지보수

[데이터 계획](../../specs/self-host-database/plan.md), [관측 운영](./self-host-observability.md), [진행 증거](../../specs/self-host-database/tasks.md)를 함께 따른다. Preview는 `dev`, Production은 `main`의 첫 성공 GitHub 실행에서 발행된 exact-SHA 이미지만 각각의 서버 수신기가 적용한다. Production 자동 배포 추가 범위는 [Issue #467](https://github.com/MyKnow/ssartnership/issues/467)이며 DB migration·데이터·DNS·Cron·백업 변경은 포함하지 않는다. 합성 환경의 복구 성공을 원본 환경의 연속 PITR로 해석하지 않는다.

## 권한과 소스 승인

운영 Docker는 root, 빌드 Docker는 기존 `ci-builder` UID 1001의 rootless engine이다. 프로젝트 도구는 기존 `myknow-ci-exec`의 1 job·30분·15GiB 여유 공간 및 사용자 slice 자원 제한을 바꾸지 않는다. CI container에는 작업 소스 bind만 제공하고 Docker socket·운영 env·백업 키·SSH 키를 제공하지 않는다. container의 UID 0은 rootless namespace에서 호스트의 ci-builder로 매핑되며 호스트 root가 아니다. 외부 사이트 크롤링이나 신뢰되지 않은 PR에는 이 구성을 사용하지 않는다.

운영자는 `prepare.mjs <새 디렉터리> <40자리 SHA> <refs/heads/typed-branch 또는 dev> <linux/amd64 또는 linux/arm64> <site origin> <Supabase origin>`으로 Git archive와 승인 JSON을 만든다. 해당 ref의 실제 commit과 일치해야 하며 symlink/gitlink·경로 이탈을 거절한다. 저장소, ref, SHA, archive SHA256, 플랫폼, 공개 origin, 24시간 미만 승인 만료가 고정된다. 비밀·원격 URL 자격 증명은 입력하지 않는다. PR refs·다른 저장소는 거절한다. `main`은 `linux/amd64`, 운영 앱·API origin과 기존 공개 VAPID 키가 모두 일치하는 전용 Production 입력만 허용하며, 자세한 조건과 전환 순서는 [자체 호스팅 운영](./self-hosting.md)을 따른다.

입력은 `/var/lib/ssartnership-ci/inputs/<승인 ID>/`에 root 소유 0444 파일, 부모 root 0755로 설치한다. 빌더가 소유한 `/srv/ci` 아래에는 승인 정책을 두지 않는다. 빌더는 부모 디렉터리를 교체할 수 있기 때문이다. 제어 코드도 `/opt/ssartnership/`의 root 소유 version 디렉터리에 설치한다. 프로젝트의 고정 Node는 `deploy/self-host-operations/install-node-runtime.sh`로 설치하며 시스템 Node를 바꾸지 않는다.

CI 실행은 root 운영자가 공유 heavy lock을 잡고 기존 runner를 호출한다. `<...>`는 실제 검증된 절대 경로로 치환하며 shell에서 사용자 입력을 eval하지 않는다.

```text
flock --nonblock --conflict-exit-code 75 /var/lib/ssartnership-ci/heavy.lock
  sudo -u ci-builder /usr/local/bin/myknow-ci-exec
  /opt/ssartnership/node24/node <root-owned-controller>/scripts/self-host-ci/runner.mjs
  <root-owned-request.json> <root-owned-source.tar>
  /srv/ci/artifacts/ssartnership/<40자리 SHA>-<12자리 job ID>
```

자동 GitHub runner 등록이나 공개 webhook을 설치하지 않는다. 서버는 GitHub API를 polling하는 환경별 timer를 사용한다. Preview 수신기는 현재 `dev`와 `.github/workflows/self-host-preview.yml`, Production 수신기는 현재 `main`과 `.github/workflows/self-host-production.yml`만 허용한다. 두 수신기는 첫 attempt의 성공, artifact digest, `release.json`, 전체 job/step, GHCR immutable digest를 독립 검증한 뒤 app만 교체하고 공유 heavy lock·health·rollback 결과를 기록한다. 서로의 artifact·state·schema 승인·Compose·health endpoint를 재사용하지 않는다.

### GitHub 빌드와 GHCR 게시

`.github/workflows/self-host-preview.yml`은 `dev`, `.github/workflows/self-host-production.yml`은 `main` push만 대상으로 한다. GitHub-hosted Linux AMD64 build job은 exact commit의 검증된 Git archive만 container에 전달한다. 읽기 전용 root·capability 제거·5GiB/2CPU 제한을 적용하고 운영 비밀, SSH, registry 로그인, Docker socket과 원본 checkout 인증 설정을 전달하지 않는다. Production은 GitHub `Production` Environment의 공개 변수 `PRODUCTION_VAPID_PUBLIC_KEY`만 build step에 전달한다. 전체 Quick·실제 standalone build·별도 운영 모드 합성 E2E의 검토된 최소 개수 이상을 retry/skip/error 없이 통과하고 배포 산출물 fingerprint가 유지되어야 app·telemetry·DB 세 이미지를 포장한다. 기존 서버 rootless CI의 설정이나 제한은 바꾸지 않는다.

게시 권한은 새 runner의 별도 job에만 있다. `github-release.mjs publish`는 archive의 크기·hash·경로·config/layer closure·플랫폼·revision을 검사해 승인 내용만 적재하고, 매 게시 직전과 최종 manifest 생성 전에 해당 환경의 live branch SHA를 다시 확인한다. Preview tag는 `dev-<SHA>`, Production tag는 `production-<SHA>`다. 의존성 설치나 이미지 실행은 하지 않는다. registry 자격증명은 게시 단계에서만 사용하고 마지막에 로그아웃한다. 이미지 묶음 artifact는 2일, digest manifest artifact는 30일 보존한다. fixture 이미지는 게시하지 않고 artifact digest 불일치는 오류로 처리한다. 부분 게시에는 최종 manifest가 없어 배포 승인으로 사용할 수 없다.

Preview 공개 빌드 origin은 앱 `https://ssartnership-dev.myknow.xyz`, API `https://ssartnership-api-dev.myknow.xyz`, Production은 앱 `https://ssartnership.myknow.xyz`, API `https://ssartnership-api.myknow.xyz`로 고정한다. 이 설정은 DNS/TLS 전환 또는 데이터 이전 증거가 아니다. 실패 시 complete bundle을 만들지 않고 container 종료 상태와 가능한 gate 로그를 남긴다.

서버 수용 계약 `github-contract.mjs`와 `receive-release.mjs`는 독립 조회한 GitHub run/jobs의 저장소·workflow 경로·현재 환경 branch SHA·첫 실행·성공과 두 job의 필수 단계 및 전체 단계 성공을 요구한다. manifest 자체의 주장은 충분하지 않다. 수신기는 환경별 root 전용 token 파일과 root-owned release/state directory를 사용하고, GHCR에서 세 이미지를 모두 immutable reference로 pull한 뒤 image ID·AMD64·revision·단일 RepoDigest를 확인한다. 이후 환경별 Compose의 app만 `--pull never`로 교체하고 `/api/health`·`/auth/login`을 확인하며 실패 시 이전 app image로 rollback한다. database image는 이 자동 경로에서 실행하거나 DDL을 적용하지 않는다.

### 앱 자동 배포의 DB schema 승인

수신기는 DB DDL을 적용하지 않는다. Preview의 `/etc/myknow/secrets/ssartnership-original-preview/schema-approval.json`과 Production의 `/etc/myknow/secrets/ssartnership-production/schema-approval.json`은 root-owned·0600·단일 regular file이어야 하며 symlink와 4KiB 초과를 거절한다. 버전 1의 정확한 필드는 `version`, `repository`, `environment`, `project`, `migrationTree`, `verifiedSourceSha`, `migrationCount`, `verifiedAt`이다. Preview는 `environment=original-preview`, `project=ssartnership-original-preview-34141078185`, Production은 `environment=production`, `project=ssartnership-production-data`만 허용한다.

운영자는 해당 Preview 또는 Production의 적용 migration 목록/내용과 source 동등성, 현재 백업 및 필요한 새 DDL 적용·회귀 검증을 확인한 뒤에만 승인 파일을 작성한다. `migrationTree`는 해당 source의 `supabase/migrations` Git tree SHA다. git ref 자체나 app SHA를 대신 넣지 않는다. 승인 파일은 비밀을 포함하지 않지만 배포 권한이므로 CI·앱·builder가 쓰지 못해야 한다.

receiver는 [GitHub Trees API](https://docs.github.com/en/rest/git/trees#get-a-tree)의 비재귀 응답을 두 단계 읽어 환경별 exact SHA → supabase → migrations tree를 찾는다. 요청 SHA·완전한 응답·경로/종류/모드·단일 항목을 검증하고 운영 승인 tree와 다르면 manifest 저장·이미지 pull·앱 교체 전에 중단한다. 같은 앱 릴리스가 이미 적용됐어도 schema 검사를 생략하지 않는다. 새 migration의 추가·삭제·수정은 모두 tree를 바꾸므로 운영자 검증 없이 자동 통과하지 않는다.

이는 승인 시점 이후 운영자가 수행한 임의 DDL까지 지속 감지하는 schema drift scanner가 아니다. DB 변경은 별도 운영 절차와 백업/동등성 증거를 남겨야 한다. 승인 파일을 latest dev 값으로 자동 갱신하거나 단순 count 일치만으로 새 migration을 적용한 것으로 간주하지 않는다.

### 스키마 변경을 포함한 배포 완료 순서

사용자가 해당 환경 배포를 승인했다면, 에이전트도 그 요청 범위에서 운영자로서 아래 절차를 끝까지 수행한다. 확인 기록 갱신만 사용자에게 다시 넘기지 않는다. CI·앱·builder·자동 수신기의 DDL/승인 권한은 추가하지 않는다.

1. 환경과 실제 Compose DB project를 확인한다. Production은 `ssartnership-production-data`, Preview는 `ssartnership-original-preview-34141078185`다. 동결된 Cloud DB와 폐기된 `production-migrations.yml`을 사용하지 않는다. 기존 workflow의 과거 revision을 dispatch하지 않는다.
2. 검토한 정확한 source SHA와 `git rev-parse <SHA>:supabase/migrations` 값을 고정하고 해당 source만 root 소유 디렉터리에 설치한다. 현재 백업 성공/시각, DB 식별자, 공유 heavy lock을 확인한다. 새 DDL이 기존 앱과 호환되는지 검토한다.
3. 해당 환경의 기존 private data env 파일을 사용한다. root 운영자와 공유 heavy lock 안에서 `scripts/self-host-database/cli.mjs migrate --env-file <data.env> --project <DB project>`를 실행한다. 복원된 두 DB는 컨테이너 OS 사용자 `postgres`, DB 로그인 역할 `supabase_admin`, Unix socket `/tmp`를 사용하도록 도구에 고정되어 있다. 일반 합성 DB는 기존 연결을 유지한다.
4. 같은 source와 연결로 `cli.mjs verify-schema --env-file <data.env> --project <DB project>`를 실행한다. 읽기 전용 단일 snapshot에서 **전체 파일명과 SHA256**을 비교하며 누락·추가·내용 변경 중 하나라도 있으면 실패한다. 단순 migration 개수나 최신 파일명만으로 승인하지 않는다. 이 검사는 이력 동등성 증거이며, 필요한 권한/RPC 검증과 임의 DDL drift 점검을 대체하지 않는다.
5. 기존 승인 파일을 root 전용 위치에 보존한다. 검증한 SHA/tree/count와 UTC 검증 시각으로 새 파일을 같은 디렉터리에 root 0600으로 생성하고 flush한 뒤 원자적으로 교체한다. 환경별 정확한 profile과 버전 1 필드만 유지한다. 검증과 기록은 같은 운영 잠금 안에서 수행한다.
6. 잠금을 해제한 뒤 해당 환경 수신기 서비스를 실행하고, 실제 container revision과 receiver state가 목표 branch SHA인지 확인한다. 외부 HTTPS `/api/health`·`/auth/login` 응답까지 확인해야 배포 완료다. schema 미승인 로그는 `RECEIVER_SCHEMA_NOT_APPROVED`, 파일/내용 오류는 구분된 고정 코드이며 임의 오류 본문과 비밀은 출력하지 않는다.

`self_host.migration_ledger`가 없는데 `supabase_migrations.schema_migrations`에 기존 이력이 있으면 자동으로 전체 SQL을 재실행하지 않는다. 기존 승인 source의 파일명·checksum과 실제 전체 version 집합, schema 동등성을 대조하고 백업한 뒤 한 번만 baseline 이력을 이관한다. 원래 Supabase 이력은 보존하며 이후 자체 호스팅 적용의 기준은 `self_host.migration_ledger`다. 자동 baseline 작성이나 실패한 migration의 이력 조작은 허용하지 않는다.

## 검증과 이미지 전달

고정 Playwright image와 Node 24.18.1/npm 11.16.0으로 trusted install → docs → 전체 Quick → standalone Production build → 전체 E2E를 실행한다. [공식 Docker 안내](https://playwright.dev/docs/docker)의 package/browser 버전 일치를 유지한다. 기본 저장소의 E2E suite·auth fixture·테스트 30초 제한을 유지하며 전용 container config에서 retries 0·첫 실패 종료·영상 off·실패 screenshot/trace 보존을 적용한다. 영상 인코딩 CPU와 개발 서버의 cold compile은 기능 assertion과 분리한다. [webServer/global setup](https://playwright.dev/docs/test-webserver) 이후 검토된 유한한 loopback GET 경로를 리디렉션 없이 한 번씩 준비하고, 별도 mock 관리자 세션으로 관리자 페이지를 컴파일한다. 관리자 GET도 동일 origin·허용 경로에 한정된 최대 6회 redirect, 경로당 총 90초 제한을 적용한다. 각 컴파일 준비 시간을 따로 기록하며 reset POST·업무 데이터 생성·테스트 재실행은 하지 않는다.

Production standalone 산출물은 한 번 빌드하고 `App.Dockerfile`로 그대로 포장한다. E2E의 `.next-e2e`와 Production `.next`는 분리된다. 수용한 공개 origin manifest는 runtime 검증에 그대로 전달하고, 이미지에는 운영 비밀을 넣지 않는다. app·telemetry·pgBackRest DB 이미지가 모두 완성되어야 `result.json`을 게시한다. 실패·만료·부분 artifact는 배포할 수 없다. 로그와 실패 work directory는 유지하며 전체 prune을 하지 않는다.

전용 E2E 개발 서버에만 `NODE_OPTIONS=--max-old-space-size=2048`을 적용한다. 고정 Next 16.2.11 개발 CLI는 명시적 값이 없으면 `os.totalmem()` 절반을 V8 heap 상한으로 사용해 부모 사용자 slice의 더 낮은 MemoryHigh를 넘을 수 있었다. 실제 진단에서 Next RSS 약 2.97GiB·반복적인 memory.high 회수·swap을 확인했다. 이 값은 JavaScript heap 상한이며 전체 프로세스/container 메모리 보장이 아니다. 원래 서버 slice·container 제한·Production build 설정·제품 테스트 제한은 변경하지 않는다. [Next 메모리 운영 안내](https://nextjs.org/docs/app/guides/memory-usage)와 실제 cgroup 압력을 함께 확인한다.

개발 서버 준비 완료는 `/api/health`로 확인하며 홈페이지는 해당 테스트 묶음에서만 준비한다. 서버 stdout/stderr를 묶음별로 보존하고 자동 재시작·manifest 손상·heap 고갈이 있으면 테스트가 나중에 통과해도 실패한다. [Playwright trace 옵션](https://playwright.dev/docs/api/class-testoptions#test-options-trace)의 연속 화면 촬영만 끄며 실패 screenshot과 DOM snapshot·network·action·source trace는 유지한다. 이 설정은 저사양 서버 검증용이고 GitHub/일반 로컬 설정은 바꾸지 않는다. 네이티브 전체 검증 시간과 성공은 아직 검증 중이며, 30분 job 상한 안에서 완료하지 못하면 현재 pipeline은 배포 산출물을 발행하지 않는다.

개발 페이지 보관 시간을 늘리는 `onDemandEntries` 실험으로도 같은 오류가 발생해 이 설정은 제거했다. 프레임워크 설정을 확정된 해결책으로 남기지 않는다. 실패 기록과 원인 진단은 [작업 증거](../../specs/self-host-database/tasks.md)와 CI 실패 원장에 보존한다.

모든 페이지를 하나의 개발 서버에 누적시키는 초기 준비는 heap 부족으로 실패했다. 전용 CI는 Node 개발 스택 소스맵 캐시를 끄고, 전체 E2E를 16개 Playwright shard로 순차 실행한다. 묶음마다 개발 서버 프로세스는 새로 시작하며 선택된 테스트에 필요한 경로만 준비한다. 첫 진입 화면은 마지막에 준비한다. mock 환경에서는 자체 Web Vitals를 삽입하지 않고 설정 GET도 준비하지 않는다. 실제 Supabase 앱은 기존 runtime 활성화·샘플링 계약으로 수집한다. 디스크의 개발 캐시는 재사용할 수 있지만 이전 프로세스의 mock 세션·heap은 재사용하지 않는다. 전체 목록과 각 shard 목록의 테스트 ID 합집합을 먼저 비교하고, 결과마다 단 한 번의 passed/retry 0을 요구한다. 실행 후 ID 합집합도 다시 비교하므로 누락·중복·skip·재시도·부분 결과는 통과하지 못한다. 새 테스트 파일이나 인증 시나리오는 경로 준비 계획에 등록해야 한다. 각 묶음의 JSON/JUnit/HTML/실패 trace는 별도 디렉터리에 보존하며 전체 통과 전에는 complete receipt를 만들지 않는다.

배포 운영자의 `import.mjs <request> <artifact directory> <새 release-stage directory>`는 다음을 검사한다.

- root 소유 승인 및 builder 전용 regular file. pinned directory FD와 NOFOLLOW로 symlink/디렉터리 교체를 방어한다.
- exact source/request SHA256, 전체 archive hash, 예상 세 component와 tag·플랫폼·revision.
- tar header checksum, 크기/개수 상한, 경로·중복·symlink/hardlink/device/PAX 거절, content-addressed blob hash.
- Docker classic config ID와 containerd manifest/index ID를 구분해 같은 config/layer를 가리키는지 확인.
- 원본 OCI index를 버리고 승인한 한 이미지의 manifest/config/layer만 새 tar에 복사. 모든 검사가 끝난 뒤 운영 engine에 적재한다.
- 적재 후 config·layer·플랫폼·revision을 다시 확인하고 실제 운영 engine의 immutable ID를 `images.env`에 기록한다. 재포장으로 바뀐 manifest ID와 원본 ID/config digest 대응은 `loaded.json`에 남는다.

파일 hash는 전송 무결성과 승인된 입력의 연결 증거다. 손상된 빌드 호스트 자체를 신뢰할 수 없게 만드는 독립 서명/재현 빌드 증명은 아니다. 빌더 업데이트와 저장소 검토는 별도 공급망 신뢰 경계다.

### 승인된 Mac Docker 대체 빌드

서버 네이티브 CI 안정화와 분리하여 운영자가 승인한 경우에만 `scripts/self-host-ci/mac-runner.mjs <request.json> <source.tar> <새 출력 디렉터리>`를 사용한다. 입력/출력은 이 작업 저장소의 canonical `.tmp` 아래에 두며, 입력 hash를 실제 Git commit의 archive와 다시 비교한다. macOS·Docker Desktop·Linux engine·AMD64 대상·최소 7GiB Docker 메모리와 30GiB 디스크 여유를 요구한다. 기존 서버 rootless UID·승인 파일 소유권·자원 제한 검사를 완화하지 않는다.

Mac 검증 container는 AMD64, 6 CPU·5GiB memory/swap 상한, 읽기 전용 root·capability 제거·소스 bind만 사용한다. 실제 운영 비밀·host socket·SSH 경로를 전달하지 않는다. 전체 Quick와 실제 Supabase standalone을 한 번 빌드한 뒤 별도 `.next-e2e`에 운영 모드의 합성 E2E 앱을 빌드한다. Mac 전용 config는 이 테스트 전용 앱을 `next start`로 실행하며 사전 페이지 GET·16 shard·개발 HMR을 사용하지 않는다. 테스트 빌드/서버 heap은 3072MiB다. 기본 config와 프로젝트별 테스트 ID를 먼저 대조하고 모든 assertion 제한·retry 0·실패 trace와 결과 ID/내부 오류 검사를 유지한다. app standalone은 다시 빌드하지 않는다.

기본 fixture 정책은 Production에서 항상 비활성이다. 명시적인 CI·두 mock provider·별도 출력·standalone 비활성 조건에서만 webpack이 정책 모듈을 교체하며, 일반 compiler에 테스트 전용 모듈이 들어오면 실패한다. 테스트 빌드/시작 환경은 허용 목록으로 새로 만들고 dotenv·실제 연결 값은 거절한다. 인증/권한 로직과 Secure 쿠키는 그대로다. 테스트 marker·응답 header·빌드 설정 검증으로 잘못된 실행을 거절한다. 캐러셀 합성 slide도 mock+E2E+fixture 정책을 모두 요구하며 기존 운영 배너를 되살리지 않는다. 배포 runtime은 E2E flag를 거절하고 Docker 포장은 테스트 출력을 포함하지 않는다. 실제 standalone·static·설정·공개 manifest의 파일/권한 fingerprint를 E2E 전후와 이미지 포장 직전에 비교한다. 이는 테스트 앱 자체를 배포 이미지로 검증했다는 뜻이 아니며, 실제 DB/API/이미지 검증을 대체하지 않는다.

성공 증거의 `execution=mac-docker-desktop-amd64`, `nativeServerCi=false`, `e2eRuntime=production-test-only`, `fixtureBuildDeployable=false`와 deployable fingerprint를 보존한다. Mac 도구/게이트 제어 코드의 검토 상태와 앱 source SHA를 별도로 기록한다. 이 경로의 성공은 서버의 1.5 CPU/3GiB slice 안에서 native CI가 통과했다는 뜻이 아니다. 로컬 기본 Release와 fixture QA는 `.next-e2e` 부모를 공유하므로 순차 실행하며, 사용 중인 출력 디렉터리를 이동/정리하지 않는다.

추가 fixture 빌드의 static worker는 고정 버전 Next의 `experimental.cpus=2`로 제한한다. Docker VM의 14-worker 기본값과 빌드 heap이 합쳐져 기존 5GiB cgroup에서 OOM이 발생했기 때문이다. 실제 standalone/native 빌드 설정·메모리 한도는 바꾸지 않는다. runner의 `gate-termination.json`은 컨테이너 제거 전에 running/exitCode/oomKilled만 기록한다. 이 파일은 진단 자료이고 전체 성공 receipt를 대신하지 않는다.

운영자는 성공한 세 image archive와 result/게이트 증거만 기존 고정 SSH로 전달하고 원격 hash를 확인한다. 원격 입력은 root 소유, 전달 artifact는 importer가 요구하는 전용 builder 소유의 새 job 디렉터리에 둔다. 전달 receipt에는 실제 Mac 실행 출처를 기록하며 소유권만으로 서버에서 빌드되었다고 주장하지 않는다. 기존 privileged importer의 archive/config/layer/플랫폼/revision 검사는 그대로 거친다. 이 경로는 별도 synthetic Preview 배포용이며 Production 승격이나 공개 ingress를 승인하지 않는다.

Mac engine은 사용자 소유 Docker Desktop Unix socket에 고정하고 환경 변수의 다른 Docker host/context를 받지 않는다. 브라우저는 동일 버전 Playwright의 ARM64 sidecar로 분리한다. AMD64 gate와 정확히 같은 비공개 network namespace를 사용하고 host port는 공개하지 않는다. trusted install 완료 신호 뒤에만 같은 의존성의 브라우저 server를 실행하며 런타임 추가 설치는 없다. 앱·테스트 runner·배포 이미지는 AMD64이고 실제 브라우저만 ARM64다. [Playwright의 원격 브라우저 연결](https://playwright.dev/docs/docker#remote-connection)과 동일 버전 계약을 따르며 브라우저 image ID/플랫폼을 증거에 따로 남긴다. Docker 로그 전달 명령의 종료 0과 gate container의 실제 종료 상태는 별도로 검증한다.

## Preview 설치와 rollback

자체 호스팅 개발 E2E는 `SELF_HOST_ATOMIC_MANIFESTS=1`을 명시한다. Next 설정은 dev compiler와 이 flag가 모두 참이고 NODE_ENV가 Production이 아닐 때만 webpack manifest 출력 adapter를 설치한다. 같은 디렉터리의 새 임시 파일에 내용을 완성한 뒤 rename하며, 같은 대상의 compiler 쓰기는 순서대로 처리한다. 쓰기/rename 실패는 compiler에 전달되고 독자·JSON 파싱·일반 JS/CSS 출력은 바뀌지 않는다. Production 이미지에 테스트 초기화 예외를 만들지 않는다. 이 경로는 개발 bundler asset의 빈 읽기 방지용이며 Next가 직접 갱신하는 prerender manifest 또는 Windows 파일시스템에서의 동등한 원자성 보장은 별도다. 실패 gate 재시도·오류 숨김·시간 제한 완화 대신 새 SHA의 전체 검증으로 확인한다.

`install-release.mjs`는 승인된 source archive의 hash를 확인하고 새 root 소유 release 디렉터리에만 설치한다. `bootstrap-preview.mjs`는 해당 승인·AMD64·고정 loopback origins를 확인하고 새 `ssartnership-home-preview`의 비밀·볼륨·199개 이상 migration·Storage/RPC smoke·관측 서비스를 준비한다. 기존 env가 있으면 재초기화하지 않는다. 실패한 bootstrap을 무작정 다시 실행하지 말고 생성된 키·볼륨·성공 단계를 보존한 채 미완료 단계만 조사한다.

원본 운영 데이터는 반입하지 않는다. 새 DB에 남은 두 폐기된 기본 banner seed만 비활성화한다. 운영/복원 DB에는 이 seed 조정을 실행하지 않는다. 외부 Mattermost/메일 등 실제 연동은 비활성/미설정이며, synthetic DB를 실서비스 데이터로 오해하지 않는다. 서비스 포트는 loopback에만 공개하고 `compose.server.yaml`로 자원/로그 상한을 적용한다.

앱 교체는 `switchApplication`이 immutable image로 app 서비스만 갱신하고 실제 container 이미지와 health·로그인 GET 200을 검사한다. 원래 Cloud Preview의 DB/REST/Storage/Kong Compose와 volume은 이 overlay에서 재생성하거나 삭제하지 않는다. 실패하면 이전 이미지로 돌아가 다시 검사하며 rollback 실패를 별도 오류로 보고한다. 초기 배포에 이전 이미지가 없으면 앱만 중단한다. 데이터 볼륨·schema는 이 경로에서 삭제/역변환하지 않는다. DB major 또는 비호환 migration rollback은 새 환경의 복구/전환 절차다. overlay의 telemetry·Prometheus·Alertmanager·Grafana·exporter는 app health와 후보 monitoring secret을 확인한 뒤 별도로 기동하며, 모든 서비스에 bounded log·memory·CPU·PID 상한을 적용한다.

## 유지보수

`current`는 versioned controller의 링크이므로 maintenance/export 진입점은 argv를 realpath로 해석한다. controller-only 수정은 앱/DB 이미지 release와 구분하여 새 root 소유 version에 설치하고 이전 링크 대상을 보존한 뒤 원자적으로 교체한다. timer active/exit 0뿐 아니라 JSON receipt, metric 갱신, manifest의 실제 성공 기록을 확인한다. 아무 출력 없이 성공하면 무실행 결함으로 판단하여 해당 타이머를 중지하고 직접/링크 실행 경로부터 검사한다. 데이터·키·이미지는 재초기화하지 않는다.

`maintenance.mjs`의 고정 명령은 전체/증분 백업, 저장소 검사, 새 볼륨 격리 복구, 운영 metric 수집, 읽기 전용 DB 점검, 상태 및 외부 사본 capture/check다. DB 점검은 5초 SQL 제한 아래 DB 크기·최장 transaction·live/dead tuples·deadlock·autovacuum 활성만 집계한다. table/회원/SQL 본문을 metric label에 기록하지 않으며, dead tuple 수를 실제 bloat 측정으로 부르지 않는다. 기존 백업 작업은 pgBackRest 전체 백업 2개 보존 정책과 만료된 DB 체인에만 연결된 Storage snapshot 정리를 수행한다. 그 밖의 임의 retention 삭제·VACUUM FULL·REINDEX·키 교체는 자동 실행하지 않는다.

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

### 원래 Cloud 환경 반출 도구(폐기)

원래 Cloud Preview·Production을 홈 서버로 옮길 때 쓴 읽기 전용 수집·age 암호화 전송 도구(`scripts/self-host-migration/`, `deploy/self-host-migration/`)와 GitHub export workflow 2개는 이전 완료 뒤 RF-04(#537)에서 삭제했다. PVE 자체 호스팅이 유일한 운영 정본이며 Cloud 반출·재export 경로는 유지하지 않는다. 당시 절차와 검증 근거는 삭제 직전 커밋 `b2a212f4`의 이 절과 [데이터 작업 목록](../../specs/self-host-database/tasks.md)에 남아 있다. 이 workflow들이 쓰던 Cloud 저장소 비밀의 삭제와 Cloud 프로젝트 키 폐기·해지는 저장소 밖 운영자 조치다.

### 장치 고장 대비 반출

독립 REST 백업 목적지가 결정되기 전의 장치 고장 대비 경로는 `pull-recovery.mjs <새 .tmp bundle 디렉터리> <별도 새 .tmp 키 디렉터리>`다. 기존 pinned VPN SSH wrapper로 읽기 반출하며 새 listener·포트 전달·SSH 개인키 복사를 하지 않는다. 운영 heavy/operations 잠금 안에서 최신 paired manifest와 암호화된 pgBackRest/Restic 저장소를 고정한다. 키 묶음은 Mac에서 생성한 RSA 4096 공개키에 RSA-OAEP-SHA256/AES-256-GCM으로 봉인한다. 서버에는 수신 공개키만 전달한다.

수신 `.partial`은 SSH 성공·크기 확인 뒤에만 완성 tar로 바뀌고 SHA256 receipt를 남긴다. 실패 사본과 키는 조사용으로 보존한다. Mac 개인키는 [Apple Keychain Services](https://developer.apple.com/documentation/security/adding-a-password-to-the-keychain)의 login Keychain에 저장한다. Swift Security helper에 stdin으로만 전달하고 읽기도 메모리 pipe로만 받는다. 인수·환경 변수·평문 PEM·로그에 개인키를 넣지 않으며 저장 후 공개키 fingerprint readback을 확인한다. 같은 item 덮어쓰기와 실제 복구 item 삭제는 helper가 허용하지 않는다. 자동 keychain unlock·공유 ACL·iCloud 동기화 설정을 추가하지 않으며, macOS 접근 승인이 필요하면 운영자가 직접 승인해야 한다.

별도 키 디렉터리에는 `recipient-public.pem`과 공개 메타데이터 `recipient-keychain.json`만 보존한다. helper 실행 파일은 사용자 Library의 Application Support 아래 private 프로젝트 디렉터리에 source hash별로 보존한다. helper 변경 후에는 OS 접근 승인이 다시 필요할 수 있다. Keychain은 Mac 전체 분실/손상에 대한 독립 키 escrow가 아니다. FileVault·오프라인 키 escrow·별도 장애 영역 백업은 별도 게이트다. 이 사본과 `.tmp`를 비밀 없는 QA artifact처럼 공개하거나 Git에 추가하지 않으며 키 식별 메타데이터도 임의 정리하지 않는다.

`rehearse-pulled-recovery.mjs <bundle 디렉터리> <recipient-keychain.json 경로> <승인 DB image의 sha256 ID>`는 전송 receipt/hash, Keychain recipient fingerprint, 키 봉인, paired ID, image revision/AMD64를 확인한다. private PEM 경로는 더 이상 받지 않는다. tar는 host 경로가 아닌 새 Docker volume에만 펼치고, 백업 암호 두 개만 새로운 격리 Compose 환경에 전달한다. 원본 앱 비밀·볼륨·경로·외부 연동을 재사용하지 않는다. Mac ARM64에서는 서버와 같은 AMD64 이미지를 사용해 물리 PostgreSQL 복구를 시험하며 이를 native ARM64 물리 복구 지원으로 해석하지 않는다. 네트워크 없는 PITR의 before/after marker와 복원 Storage hash가 모두 맞아야 `restored: true`를 기록한다.

같은 집의 Mac 사본은 서버 디스크 고장에 대한 별도 장치 복구 증거일 뿐, 화재·도난·지역 회선/전원 장애에 대한 geographic DR 또는 정기 외부 백업 성공 증거가 아니다. 실제 외부 목적지와 운영자 알림 채널이 결정되기 전에는 그 전환 게이트를 닫지 않는다.

Mac 반출 복원에서는 복호화한 pgBackRest/Restic 암호도 `runtimeKeysOnly`로 전달한다. 복원 설정 파일에는 비밀이 아닌 표시값만 남기며 실제 두 암호는 해당 복원 subprocess 환경에만 제공한다. 종료 시 새 drill의 DB container를 제거해 정지된 container 설정에 암호를 장기 보존하지 않는다. 복구된 volume과 검증 기록은 유지한다. 이는 정상 수명주기의 보관 최소화이며 실행 중 메모리·Docker 저장장치의 포렌식 삭제 또는 전체 디스크 암호화 보장은 아니다. 실제 회원 데이터 반입에는 별도 장치/데이터 보관 정책과 암호화 검증이 필요하다.

## 공개 인증 리디렉션

Next standalone의 route-handler `request.url`은 외부 HTTPS 요청에서도 컨테이너의 `0.0.0.0:3000`을 가리킬 수 있다. 실제 원본 Preview의 `/admin/session`에서 이를 확인했다. `buildTrustedRedirectUrl`은 real-mode에서 검증된 `NEXT_PUBLIC_SITE_URL`만 절대 redirect의 origin으로 사용한다. proxy의 관리자/파트너 분기와 회원 필수 단계, 관리자 세션 bridge, 파트너 로그아웃은 같은 helper를 사용한다. real 모드가 아닌 로컬 실행은 기존 request origin을 유지한다.

목적지는 안전한 절대 경로만 허용하며 query와 sanitized returnTo는 유지한다. 외부 URL·프로토콜 상대 URL·역슬래시·제어 문자는 거절한다. Host/forwarded header를 운영 설정의 대용으로 사용하지 않으며 real-mode 설정 누락/오염 시 내부 주소로 되돌아가지 않는다. 필수 회원 단계 순서와 같은 출처 검사, Secure/HttpOnly/SameSite 쿠키는 변경하지 않는다. 기본 합성 E2E 외에 실제 공개 origin의 로그인·관리자 bridge·로그아웃 Location을 별도로 검증해야 한다.

## Production 수신기 설치와 일상 확인

코드를 검토해 root 소유 version directory에 설치하고 `/opt/ssartnership/control/current`를 그 버전으로 원자적으로 바꾼 뒤 진행한다. Production runtime env, GitHub read/package token, 현재 운영 DB와 대조한 schema approval이 먼저 있어야 한다. 설치기는 이 셋과 control version·고정 Node·Compose를 검증한 뒤 unit 두 개를 설치하고 timer만 활성화한다. 즉시 service를 실행하거나 DB migration을 적용하지 않는다.

```bash
sudo /opt/ssartnership/node24/node /opt/ssartnership/control/current/deploy/self-host-ci/install-production-receiver.mjs
sudo systemctl status ssartnership-production-receiver.timer --no-pager
sudo systemctl list-timers --all ssartnership-production-receiver.timer --no-pager
```

정상 운영 확인은 timer active와 실제 service 결과를 구분한다. `pending`은 현재 main의 첫 성공 릴리스가 아직 없는 상태, `unchanged`는 같은 승인 릴리스, `deployed`는 새 app 적용과 health 검사 및 state 기록까지 완료한 상태다.

```bash
sudo systemctl show ssartnership-production-receiver.service -p Result -p ExecMainStatus -p ExecMainStartTimestamp
sudo journalctl -u ssartnership-production-receiver.service -n 20 --no-pager
sudo cat /var/lib/ssartnership-ci/production/receiver-state.json
curl --fail --silent --show-error https://ssartnership.myknow.xyz/api/health
```

중지할 때는 `sudo systemctl disable --now ssartnership-production-receiver.timer`로 새 자동 적용만 멈춘다. 현재 app·DB·Cron은 중지하지 않는다. 수동 확인은 `sudo systemctl start ssartnership-production-receiver.service`를 사용하며 같은 검증을 우회하지 않는다. 실패 시 새 state는 기록하지 않고 이전 app image로 복귀한다. rollback 자체도 실패하면 service는 `DEPLOY_ROLLBACK_FAILED`로 실패하며 운영자가 Compose와 공개 health를 직접 확인해야 한다.

## 공개 Preview의 일상 확인

현재 공개 Preview의 최신 SHA·실검증·잔여 단계는 [작업 인수인계](../../specs/self-host-database/tasks.md#공개-preview-인수인계--2026-09-08)가 기준이다. 아래 명령은 홈 서버의 신뢰된 운영자 셸에서 실행한다. 만료된 bootstrap 계정을 자동 재활성화하거나 SSH 키를 복사하는 절차가 아니다.

```bash
sudo systemctl status ssartnership-preview-receiver.timer --no-pager
sudo systemctl list-timers --all ssartnership-preview-receiver.timer --no-pager
sudo systemctl show ssartnership-preview-receiver.service -p Result -p ExecMainStatus -p ExecMainStartTimestamp
sudo journalctl -u ssartnership-preview-receiver.service -n 12 --no-pager
curl --fail --silent --show-error https://ssartnership-dev.myknow.xyz/api/health
```

timer는 `OnUnitActiveSec=5min`과 최대 60초 분산 지연으로 동작한다. `pending`은 현재 dev의 첫 승인 이미지 발행이 아직 없는 상태, `unchanged`는 저장된 승인 릴리스와 같은 상태, `deployed`는 새 이미지의 실제 적용·health 검사 후 상태 기록까지 완료한 결과다. timer active만으로 배포 성공을 주장하지 않는다. 수동 즉시 확인이 필요하면 `sudo systemctl start ssartnership-preview-receiver.service`를 사용하며 같은 heavy lock과 schema/first-attempt/digest 검사를 그대로 거친다. 반복 `docker compose up`으로 승인 검사나 실패 복귀를 우회하지 않는다.

스키마 tree가 달라지면 앱 수신은 차단된다. legacy Cloud Preview writer였던 `preview-migrations.yml`과 `preview-sync.yml`은 [Issue #484](https://github.com/MyKnow/ssartnership/issues/484)에서 삭제했으므로 migration이 포함된 `dev` push는 Cloud Preview에 DDL을 쓰지 않고 Supabase 앱 검사도 기대하지 않는다. 다음 SQL 변경은 백업·새 후보 복구·실제 migration 검증을 거쳐 운영자가 home 승인 baseline을 갱신해야 한다. 승인 JSON의 hash만 바꾸거나 기존 migration 파일을 수정하는 방식은 허용하지 않는다. Preview와 Production의 승인 파일은 서로 대체할 수 없다.

원본 Cloud는 더 이상 복구 경로로 유지하지 않는다. 홈 서버 쓰기 이후 Cloud로 되돌리는 절차는 없으며 CONNECT grant와 DNS만 되돌리는 방식을 rollback으로 사용하지 않는다. 원본의 수동 외부 cold backup/복원 성공은 상시 WAL/PITR·정기 외부 사본·독립 지역 복구의 완료 근거가 아니다. 운영 이미지 정리도 별도 보존 정책이 필요한 단계이며 `docker system prune` 또는 volume 삭제를 자동 수신기에 추가하지 않는다.

## 테스트 정리와 수신기 호환성

Issue #474는 비핵심 검사를 삭제하고 `github-contract.mjs`의 최소 개수를 76개로 조정한다. 실제 발견된 테스트 ID 전체와 결과의 일치, retry/skip/error 0 조건은 그대로 유지한다. 개수만으로 전체 실행을 증명하지 않는다. 기존 103개 기준의 운영 수신기는 새 manifest를 거부하므로 dev/main 통합 전 검증한 제어 소스 버전으로 교체한다. 이전 root-owned 제어 디렉터리와 symlink 대상을 보존하며 DB·비밀·schema 승인·Compose 설정을 변경하지 않는다.
