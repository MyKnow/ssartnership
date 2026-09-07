---
title: 자체 호스팅 데이터와 운영 복구 작업 목록
type: task-list
status: active
authority: normative
---

# 데이터와 운영 복구 작업 목록

상위 작업은 [Issue #435](https://github.com/MyKnow/ssartnership/issues/435)와 [마이그레이션 작업 목록](../self-hosting/tasks.md)이다. 코드 준비와 실제 실행 완료를 구분한다.

## 2026-09-07 23시 전후 GitHub 이미지 게시 준비

두 환경 격리와 사본 준비를 `a6fecd5a`에 커밋했다. Issue #435에 GHCR 이미지 게시와 원래 Cloud Preview 전체 이전의 분리 계획을 기록했다. Production 데이터를 정제하는 `prepare-copy`는 원래 Cloud Preview의 완전 이전 도구가 아니므로 혼용하지 않는다.

Cloud Preview의 13:42 UTC 읽기 전용 집계는 PostgreSQL 17.6, DB 104,418,451바이트, public table 101개, migration 199개, Storage bucket 7개/객체 823개/metadata 기준 39,851,100바이트, auth.users 0개였다. 파일 hash와 전체 schema/data 동등성은 아직 미검증이다. 개인정보를 Mac으로 평문 내려받지 않았다.

22:56 KST에 pinned SSH와 비대화형 root 권한을 다시 확인했다. 접근 창은 다음 날 22:55 KST까지 활성이고 계정 수명주기는 직접 바꾸지 않았다. 합성 Preview/관측 11개 container는 실행 중, root filesystem은 약 78GiB 여유였다. 공개 Preview DNS는 여전히 Vercel이고 별도 API 레코드는 조회되지 않았다. 이 확인에서 서버 구성·데이터는 변경하지 않았다.

- [x] 격리 GitHub AMD64 build와 별도 GHCR publication job, exact dev/첫 실행/세 이미지 archive 및 digest 검증 코드 작성.
- [x] run-level success 외 필수 job/step 성공을 요구하는 서버 수용 계약과 집중 회귀 테스트 5개 통과.
- [x] 새 코드의 로컬 전체 Release 검증.
- [ ] exact GitHub SHA 첫 실행과 이미지 게시 검증.
- [ ] 서버 manifest 수신·공유 잠금·이미지 교체·실패 복귀·polling 연결.
- [ ] 원래 Cloud Preview 전체 DB/Storage 이전과 공개 HTTPS 전환·실제 브라우저/데이터 동등성 확인.

단계별 경계는 [CI runbook](../../operations/runbooks/self-host-ci-maintenance.md)에 유지한다. 코드·집중 테스트는 GHCR 게시 또는 서버 자동 배포 증거가 아니다.

로컬 전체 Release는 종료 0, Node 1,819 통과/기존 skip 8, unit 133, build, E2E 103/retry 0(2.6분)이었다. 전체 209,248바이트·2,373줄의 진단은 기존 합성 rollback 4건과 관리자 테스트 사이 Fast Refresh 2회다. 자체 호스팅 집중 테스트 118개와 workflow YAML 해석도 통과했다. 원래 worktree의 사용자 인증 변경은 보존했다.

읽기 대조에서 양쪽 public table 101개·policy 0개·sequence 0개가 일치했다. Cloud Preview의 public 함수 146개 중 서버의 145개 함수 서명은 모두 일치하며, 차이는 `rls_auto_enable()` 하나다. Cloud의 활성 `ensure_rls` event trigger는 CREATE TABLE/CREATE TABLE AS/SELECT INTO 때 public RLS를 자동 활성화한다. 함수 본문/테이블/trigger/권한 전체 동등성은 이 개수·서명 비교만으로 입증되지 않으며, 해당 자동 RLS 운영 기능도 이전 검증에 포함한다.

## 로컬 선행 작업

- [x] 최신 `dev` 기준 DB·Storage·Cloud 운영 기능 사용처 확인과 [계약](./spec.md) 작성.
- [x] 공식 PostgreSQL/Storage에서 199개 기존 migration 사전 재생 확인. 순서상 Storage 초기화가 app migration보다 먼저 필요하다.
- [x] 데이터 Compose, 난수 비밀 생성, checksum migration ledger, schema-first Preview CLI 구현과 집중 테스트 7개 통과.
- [x] 공개 URL/내부 SDK transport 10개 및 fail-closed runtime·앱 전용 비밀·컨테이너 구조 13개 집중 테스트 통과.
- [x] pgBackRest/WAL·Restic·paired manifest·상태·격리 복구 도구 구현과 집중 테스트 15개 통과. DB 7개·Cron 7개를 합쳐 자체 호스팅 집중 테스트 총 52개다.
- [x] 실제 worktree에서 빈 볼륨 초기화, migration 재실행·checksum drift 거절, RPC·권한·Storage 파일·DB 재생성 후 지속성 확인.
- [x] 전체/증분 백업과 새 대상 named/time PITR 복원, 전후 marker와 복원 파일 hash 검증. 실패/노후 상태·현재 archive 설정·부분 stop·보존 정책은 집중 테스트로 확인.
- [x] 앱과 DB의 통합 Docker 실행, 이미지·서명 URL, 저장소 Release gate 검증.
- [x] 별도 `ssartnership-preview`에 199개 migration과 smoke 적용 후 종료; `ssartnership-local` 앱 health 200 유지.

2026-09-06 Docker Desktop의 synthetic 실행 증거: 전체 backup `20260906-091109F`, 증분 backup `20260906-091109F_20260906-092131I`, 짝지은 Restic snapshot `fd4ae51b4ac65f64c53724e04704cb1cda7e20e214dc5359c43ec9808af33a9d`. named 복구와 앞선 증분의 `2026-09-06 09:13:11+00:00` 시간 복구를 새 no-network 볼륨에서 검증했다. 복원 DB에는 before marker만 존재하고 after marker는 없으며 복원 Storage hash가 일치했다. 전체/증분 백업·복구 audit는 로컬의 Git 제외 `operations-state/backup-manifest.jsonl`에 남긴다. 원본 회원 데이터는 반입하지 않았다.

첫 시간 복구의 ISO `T...Z` 설정 오류를 PostgreSQL 설정용 UTC 형식으로 고쳤고 실패 기록도 보존했다. 현재 실제 `status`는 archive 설정·최근 백업·검사·복구 모두 정상으로 보고했다. 이는 실행 당시의 로컬 상태이며 운영 서비스 보장이 아니다.

## 2026-09-07 추가 구현과 관측 증거

- [x] 기반 56개 파일을 `b95c894b`에 커밋. 원본 worktree의 별도 인증 작업은 보존했다.
- [x] operations 잠금을 async 작업 종료까지 유지하도록 수정하고 경쟁 실행 거절 회귀 테스트 추가.
- [x] TLS·인증·append-only REST 백업 수신 fixture, 별도 암호화 외부 사본, 전체 읽기 검사와 새 볼륨 복구 구현. 인증 거절·신뢰되지 않은 CA·삭제 거절·용량 초과를 실제 Docker로 시험했다.
- [x] 외부 사본 `f6ba89b6075798b69e10614508a7d570cb0c7eba4772e4523ef34919bcd21dc7`에서 DB/Storage 저장소를 새 볼륨으로 되살리고 격리 PITR/파일 hash 재검증. 같은 Docker 장치의 fixture이며 독립 장애 영역의 백업 증거는 아니다.
- [x] Prometheus·Alertmanager·Grafana와 5개 scrape target, pg_monitor 최소 권한 계정, 운영 textfile 지표·12개 알림 규칙 구현. Grafana 익명 API 401, provisioned dashboard 10개 panel 확인. TLS 알림 fixture에서 firing/resolved 수신 확인; 실제 외부 운영자 수신은 미완료.
- [x] 자체 Web Vitals의 origin·크기·빈도·유한 route 분류·DNT·샘플링 및 식별자 없는 histogram 구현. 실제 Docker 앱의 360/820/1366px 로그인 화면에서 LCP/INP/CLS 수신, 콘솔 오류 0, 가로 넘침 없음 확인. Next prefetch 취소 4/4/3건과 수신 입증 후 종료 beacon 취소 각 2건은 별도 계수했다.
- [x] standalone의 내부 origin 때문에 기존 제품 이벤트가 403이 된 문제를 고정 공개 origin 검증으로 수정. 전달된 Host/forwarded header를 신뢰하지 않는 회귀 테스트 포함.
- [x] 추가 코드의 로컬 Release 실행 종료 코드 0, E2E 103/103·retry 0. 출력 일부가 도구에서 잘려 전체 로그 감사 증거로 사용하지 않는다. 기존 between-test Fast Refresh 외 시작 시 1회 추가 신호를 보존하고 다음 CI 검증에서 재관찰한다.
- [x] 서버 접근 창과 rootless CI 제약을 읽기 확인하고 프로젝트 전용 Node 24.18.1 바이너리만 설치. 아직 서버 앱 배포 증거는 없다.

추가 집중 검증은 `tests/self-host-*.test.mts` 53/53 및 Web Vitals route 단위 4/4다. 기존 provider transport의 별도 테스트는 이 glob 개수에 포함하지 않는다. 빈 DB 초기 seed가 가리키는 기존 banner SVG 2개가 현재 저장소에 없어 홈페이지의 해당 이미지는 별도 해결/데이터 전환 게이트다. 적용된 migration을 수정하거나 운영 데이터를 반입하여 숨기지 않았다.

## 남은 전환 게이트

추가 격리 CI 준비(2026-09-07): 관측·백업을 `fd77cc07`에 커밋하고 root 소유 승인 archive를 서버 CI 입력으로 설치했다. 원격 `dev`는 다시 조회한 `2074e22d`이며 Production 전환은 하지 않았다. 새 CI 제어 코드는 이 source commit과 별도로 검증 중이다.

- 로컬 자체 호스팅·lint 격리 집중 테스트 70/70, 타입 검사 통과. 실제 Docker의 실패 health 503을 거절하고 이전 immutable app 이미지로 rollback 후 200 복구를 확인했다.
- 실제 Docker archive를 제한된 단일 이미지 tar로 재포장·적재하고 config/layer/revision 일치를 확인했다. 원본 containerd index ID와 적재 후 ID가 달라지는 경우도 구분한다.
- 서버 CI 첫 준비 실행은 빌더 HOME 오설정으로 실패했다. 실제 `/srv/ci`로 교정했다. 이후 영상 인코딩 포함 실행은 1.5 CPU 제약 아래 E2E 시간 초과로 실패했고, 다음 실행은 별도 Playwright 설정의 상대 경로 문제로 테스트 시작 전 실패했다. 모두 로그·작업 디렉터리를 보존하고 성공 artifact를 게시하지 않았다.
- 제어 코드 v4는 영상만 끄고 두 초기 module을 별도 GET으로 준비하며 테스트 제한·자원·retry 0은 유지했다. 최초 사례 집중 진단 1/1은 통과했지만 전체 실행 `202609070704`는 1 통과·1 실패·101 미실행으로 끝났다. partner 경로 cold compile 21.794초와 미완료 문서 요청을 확인했으며 성공 artifact는 없다. 후속 제어 코드는 검토된 유한한 읽기 전용 경로와 mock 관리자 화면을 별도 컴파일하며, 준비 시간·same-origin redirect 경계를 기록한다. 전체 서버 통과는 아직 미확인이다.
- 로컬 전체 Release 로그를 `.tmp/self-host/verify-release-20260907-ci.log`에 온전히 보존했다. 종료 0, E2E 103/103·retry 0이며 전체 로그 감사는 별도다. 시작 시 Fast Refresh는 독립 fresh-server 진단에서 화면 이동 중 HMR manifest `ERR_ABORTED` → `client-full-reload`로 재현했다. WebSocket payload의 `hadRuntimeError=false`, 브라우저 오류 0, 새 cache에서도 같은 원인임을 확인했다. generic 경고 문구만 보고 제품 컴포넌트를 재작성하지 않는다.
- 운영 유지보수 timer·DB 읽기 점검·서버 밖 키 암호화/SSH 반출·격리 복구 도구를 추가했다. 단위 검증은 실제 timer 설치·서버 사본 반출·다른 장치 복구 완료를 의미하지 않는다.
- 백업 반출 도구 포함 첫 로컬 Release는 개인 홈 절대 경로에 대한 cross-platform 정책으로 중단됐다. runtime 홈 경로 계산으로 고치고 원본 실패 로그를 보존했다. Docker 반출/복구 준비에서는 numeric UID/GID를 보존해야 PostgreSQL이 0600 저장소 파일을 읽을 수 있음을 확인하고, 새 볼륨에 복원한 synthetic 파일을 UID 105:106으로 읽는 실제 시험을 통과했다.
- 로컬 후속 Release의 generated QA lint 충돌은 `.tmp/**`만 lint에서 제외하고 실제 ESLint API로 소스 검사를 유지함을 검증했다. 기본 3100 포트 충돌은 기존 Compose 앱을 유지하고 별도 3150 테스트 포트로 해결했다. 최종 로그 `verify-release-20260907-ci-v6-final.log`는 종료 0, Node 1769 통과/8 기존 skip, unit 133 통과, E2E 103 통과/retry 0이다. 204,352바이트 전체 로그의 시그니처 검사 결과는 이미 진단한 Fast Refresh 안내뿐이다.
- 서버 v5 빈 캐시 진단은 19개 경로를 준비한 뒤 parent cgroup의 3GiB MemoryHigh 부근에서 메모리 회수·swap 때문에 정체되었다. Next 개발 CLI의 호스트 RAM 기반 기본 heap 크기를 확인했다. 진단은 9m52.255s timeout으로 끝나며 보존했고, 후속 CI 설정은 개발 서버 heap만 1536MiB로 명시한다. 서버/컨테이너 제한이나 테스트 시간을 늘리지 않았다.

절차와 잔여 권한 경계는 [격리 CI·유지보수 runbook](../../operations/runbooks/self-host-ci-maintenance.md)을 따른다.

추가 상태(2026-09-07): 격리 CI·유지보수·반출 도구 41개 파일을 `6c16ca6a`에 로컬 커밋했다. 원격 push/PR/Production 전환은 하지 않았다. 이후의 CI 묶음 실행·개발 서버 조정은 아직 별도 작업 변경으로 검증 중이다. 서버 v7/v8은 준비 단계의 timeout/heap 고갈, v9~v14는 첫 묶음의 페이지 로딩 timeout 또는 JSON/manifest 오류로 실패했다. 16개 shard·health 준비·2048MiB heap·연속 trace 촬영 제외·개발 페이지 보관 설정만으로 네이티브 통과가 확보되지는 않았다. 원본 실패 로그를 보존하며 부분 결과로 이미지를 승인하지 않았다. 마지막 두 조정의 효과를 입증하지 못했으므로 이를 확정된 장애 해결로 해석하지 않는다.

별도 장치 반출 전 점검에서 현재 정책을 충족하는 복구 키 보관 수단을 확보하지 못했다. 0600 private PEM과 같은 디스크의 디렉터리 분리만으로 안전한 독립 키 보관을 충족하지 않는다. 보관 방식이 결정되기 전에는 복구 개인키 생성·서버 키 묶음 반출을 실행하지 않았다. 홈서버 CI 제약을 유지한 네이티브 전체 통과, 또는 승인된 다른 빌드 호스트로의 배포 경로 선택이 남아 있다. 서버 앱·DB·관측 stack 및 유지보수 timer는 아직 설치 완료가 아니다.

v16의 내용 비출력 진단으로 로그인 준비 중 Next `build-manifest.json`을 0바이트로 읽고 JSON 파싱이 실패함을 확인했다. 원본 제품 데이터 JSON 오류로 분류하지 않는다. 효과 없는 페이지 보관 설정은 제거했다. 별도로 mock에서도 자체 Web Vitals가 삽입되어 설정 GET이 발생하던 결함을 수정했다. 비-Vercel Supabase 빌드만 컴포넌트를 삽입하고 실제 runtime 활성화·샘플링은 유지한다. 이 수정의 네이티브 오류 해결 여부는 별도 검증 중이다. 직전 로컬 Release는 Node 1773 통과/8 기존 skip, unit 133, E2E 103/retry 0, 전체 로그 시그니처는 기존 Fast Refresh 3회뿐이었다. Web Vitals 수정 후 새 Release 결과는 이 이전 기록으로 대체하지 않는다.

v17은 mock Web Vitals 요청을 제거한 상태에서도 첫 묶음의 제휴 상세 진입 30초 제한으로 실패했다(1 통과·1 실패·5 미실행). 홈서버 네이티브 전체 검증과 배포는 계속 미완료다. 같은 수정 후 로컬 Release는 102 통과·1 실패였으며, 유일한 실패는 파트너 로그인 리디렉션 중 테스트가 두 번째 이동을 시작한 ERR_ABORTED였다. 최종 회사 pathname을 기다리도록 고쳐 별도 fresh-server 집중 실행 1/1 통과(15.6초)를 확인했다. 집중 실행의 NO_COLOR/FORCE_COLOR 충돌 안내는 보존했으며 기능 실패와 구분한다. 전체 수정 후 Release는 별도 재검증한다.

후속 로컬 Release `verify-release-20260907-ci-guards-final.log`는 종료 0, Node 1773 통과/8 기존 skip, unit 133, E2E 103/retry 0(3.1분)이다. 204,595바이트·2,328줄 전체 로그 시그니처 검사는 통과한 테스트 사이의 기존 Fast Refresh 2회만 검출했다. 마지막 CI 준비 경로 정합성 수정은 별도 집중 테스트 5/5와 lint로 추가 검증했다. 문서 93개와 canonical lockfile 검사도 통과했다. 이 증거는 로컬 수정 검증이며 실패한 네이티브 CI의 성공, 서버 배포, 외부 키 보관 또는 Production 전환을 의미하지 않는다.

2026-09-07 후속 승인: 네이티브 CI 안정화는 미완료로 유지하고 Mac Docker AMD64 전체 검증 후 별도 synthetic Preview 배포를 진행한다. 복구 개인키 보관은 macOS login Keychain으로 승인받았다. Mac 대체 runner는 기존 server rootless 검사를 수정하지 않으며, 별도 출처 증거를 남긴다. 앱 소스는 로컬 commit `ed93c05ab271c59a055665ca5cd7cc5c3cc3fcc6`의 승인 archive이며 배포 gate 실행 중이다. 새로운 operator 도구는 별도 변경으로 검증한다.

Keychain 실제 시험: private PEM 파일 없이 임시 시험용 item의 저장/읽기·중복 거부·정확한 시험 item 삭제를 확인했다. 별도 RSA 4096 개인키로 Keychain readback과 봉인 묶음 복호화까지 통과했다. 시험용 item은 삭제했고 실제 복구 item/서버 백업 반출은 아직 실행하지 않았다. Mac operator/복구 집중 테스트 6/6 통과. Keychain 보관 성공은 Mac 분실에 대한 오프라인 키 escrow 또는 지리적으로 분리된 DR 증거가 아니다.

Mac 후속 검증: 세 차례 AMD64 gate의 실패를 모두 보존했다. 준비 GET을 사용하는 첫 실행은 manifest 오류, 단일 서버의 두 번째 실행은 signup 이동 제한과 React 경고, ARM64 브라우저를 분리한 세 번째 실행은 즉시 뒤로가기의 잘못된 history 결과로 실패했다. 부분 이미지나 성공 receipt는 발행하지 않았다. 마지막 trace에서 signup URL 확인 직후 약 4ms 만에 뒤로가기를 호출함을 확인했다. 로그인/회원가입 탭의 실제 상태 변경을 확인하도록 같은 테스트를 강화한 별도 fresh-server 집중 진단은 1/1 통과(16.4초)했다. 기존 제한·뒤로가기·returnTo·데모 로그인 assertion을 유지하며, 새 소스 전체 검증은 별도로 필요하다.

복원 중 백업 암호 파일 잔존도 보강했다. 기존 로컬 TLS receiver에서 받은 암호화 bundle로 실제 Docker 복원을 수행해 PITR marker·Storage 검증을 통과했다. 설정/증거 파일 3개에 실제 백업 암호가 없음을 메모리 비교로 확인했으며 해당 새 drill container는 0개, 복원 volume은 보존했다. 이것은 로컬 fixture의 보관 최소화 검증이며 아직 홈서버에서 Mac으로 반출한 사본의 검증은 아니다. 새 도구 포함 직전 macOS 전체 Release는 E2E 103/retry 0(4.9분)이었으며 마지막 인증 readiness 변경 이후에는 새 전체 검증이 필요하다.

2026-09-07 13:55 KST 판정: Mac operator·Keychain·암호 잔존 방지·인증 readiness를 `76b6d963`에 로컬 커밋했다. 같은 SHA의 macOS 전체 Release는 Node 1,779 통과/기존 skip 8, unit 133, E2E 103/retry 0(8.7분)으로 통과했다. 전체 205,796바이트·2,334줄 로그 감사는 기존 Fast Refresh 2회만 검출했다. 자체 호스팅 집중 테스트 78/78과 문서 93개 검사도 통과했다.

그러나 새 AMD64 전체 gate는 Quick와 standalone 빌드까지 통과한 뒤, 두 번째 테스트의 첫 로그인 준비 GET에서 JSON 파싱 오류와 HTTP 500으로 중단됐다. 1 통과·1 실패·101 미실행·테스트 밖 오류 1건이며 readiness assertion 전에 실패했다. 이 실행만으로 오류 입력이 앞서 진단한 빈 manifest와 같다고 확정하지 않는다. `CI_E2E_SERVER_UNSTABLE` 방어가 작동했으며 성공 receipt·3개 배포 image archive는 생성하지 않았다. 원본 `.tmp/self-host/76b6-mac-amd64-release`의 로그·trace·소스는 보존했다. Mac 기본 전체 통과나 AMD64 빌드 성공만으로 배포를 승인하지 않았다.

서버의 13:51 KST 읽기 점검에서는 root 소유 승인 입력·controller·release 소스만 준비된 상태였다. 승인 source SHA256은 `326acb107fd221970f7b36dadd76655a4cd7558693b5b1446bad529a4c2c62e6`이며 public 기반 이미지 10개를 내려받았다. rootful 실행 container는 없고 Preview 비밀 디렉터리·maintenance current 링크·heavy lock은 아직 없다. 기존 CI 1.5 CPU/MemoryHigh 3GiB/MemoryMax 4GiB/swap 1GiB/Tasks 2048은 유지했다. 앱·DB·관측 stack·timer 설치, 서버 백업의 Keychain 수신자 반출과 Mac 복구는 미완료다. 승인된 접근 창은 14:00 KST까지이며 만료 정책을 바꾸지 않았다. 이후 서버 작업에는 유효한 새 접근 창이 필요하고, 네이티브/AMD64 전체 검증 해결 또는 검토된 검증 체계 변경 없이는 배포하지 않는다. 원본 worktree의 별도 인증 변경, 원격 branch, Vercel/Supabase/DNS는 그대로다.

2026-09-07 14:00 KST 후속 읽기 진단: 실패 work의 `build-manifest.json`(617바이트), `prerender-manifest.json`(354바이트), `server/next-font-manifest.json`(77바이트)은 종료 후 모두 정상 JSON이었다. 이는 영구 손상을 입증하지 못하며 요청 시점의 빈 읽기와도 양립한다. 설치된 Next 16.2.11의 `load-manifest.external.js`는 디스크 읽기 직후 JSON.parse를 호출하고, webpack build manifest plugin은 manifest를 bundler asset으로 방출한다. 공식 [Issue #97594](https://github.com/vercel/next.js/issues/97594)는 같은 build/font manifest의 개발 중 빈 읽기와 두 오류 형식을 보고한다. 이 보고는 이전 자체 진단과 부합하는 upstream 근거지만 이번 실패 시점의 입력을 새로 계측한 증거는 아니다. 연결된 [PR #97593](https://github.com/vercel/next.js/pull/97593)은 조회 시 open이며 선택적인 client-reference manifest만 다루고 JSON 오류는 범위 밖이라고 명시한다. 따라서 이 부분 패치를 배포 가능한 해결책으로 간주하지 않는다. `prerender-manifest`의 read-modify-write 경합을 다루는 [Issue #96664](https://github.com/vercel/next.js/issues/96664)는 쓰기 경로가 다른 문제로 구분한다.

런타임 E2E 재설계 후보는 아직 채택하지 않았다. 현재 `src/lib/e2e-mutation-mode.ts`는 Production에서 초기화/변경 flag를 무조건 무시하므로 단순히 `next dev`를 `next start`로 바꾸거나 `NODE_ENV`를 위장할 수 없다. 검토 시 전체 103개 테스트의 동등한 fixture·인증·초기화 경로, 배포 이미지에서 테스트 우회 기능의 부재, 실제 Supabase/Storage를 사용하는 immutable 배포 이미지 검증, 원래 assertion/deadline/retry 0·오류 거절 유지가 먼저 필요하다. 원본 실패 gate의 성공 판정을 바꾸지 않는다. 14:00 이후 승인된 서버 작업 창은 종료됐으며 후속 서버 명령은 실행하지 않았다. 실제 자동 계정 회수 성공은 별도 운영 검증 항목이다.

2026-09-07 재개: 사용자의 접속 재개 요청 후 실제 SSH와 sudo가 성공했고 서버 수명주기 검증이 active, 만료 `2026-09-07T13:00:00Z`(22:00 KST)를 반환했다. 인수인계 문서의 이전 14:00 표기와 구분하며 작업 계정으로 수명주기를 변경하지 않았다. 원격 `dev`는 여전히 `2074e22d`, Issue #435는 open이다. rootful 서비스는 아직 없었다.

기존 E2E/Production 보안 계약을 유지하기 위해 먼저 [개발 manifest 쓰기 수정 계획](./plan.md#개발-manifest-경합의-제한된-수정-검증)을 구현했다. 대상은 명시적으로 활성화한 dev webpack의 manifest 출력뿐이다. 최초 테스트는 helper 부재로 실패했고, 수정 후 파일시스템/Next config/실제 webpack 집중 검증 8개가 통과했다. 초기 타입 진단의 Next ProcessEnv 추론 충돌은 helper 입력을 두 개의 선택적 환경 필드로 명시해 고쳤다. 그 전 6개 버전의 전체 자체 호스팅 집중 검증은 84/84와 타입 검사·lint를 통과했고 추가 2개 큐/충돌 테스트도 통과했다. 실제 Mac fresh-server에서 실패 순서와 같은 첫 인증 2개를 연속 실행해 2/2, retry 0(21.6초)을 확인했다. 직접 실행의 NO_COLOR/FORCE_COLOR 안내는 기록했으며 기능 오류와 구분한다. 이는 새 AMD64 전체 gate나 서버 배포 완료 증거가 아니다. 새로운 전체 검증 결과를 기다린다.

`ecc04568`의 macOS 전체 Release는 Node 1,787/기존 skip 8, unit 133, E2E 103/retry 0(7.0분)으로 통과했다. 전체 206,173바이트·2,342줄 감사는 기존 between-test Fast Refresh 2회 외 manifest/연결/uncaught 오류를 발견하지 않았다. 반면 같은 SHA의 AMD64 gate는 Quick와 standalone 빌드 후 회원가입 이동에서 실패했다(1 통과·1 실패·101 미실행). RSC 응답과 page chunk가 약 1.4초 안에 끝났지만 HMR 갱신이 겹친 뒤 로그인 URL에 머물렀다. manifest 오류는 이번 실행에 없었으며 성공 receipt·image archive도 만들지 않았다.

사전 컴파일을 적용한 별도 진단에서도 뒤로가기 실패가 남아 이 방식만으로 해결되지 않음을 확인했다. 실제 source와 브라우저 이력 관측에서는 첫 구형 제휴 URL의 streamed 정규화 이동이 별도 document 교체를 만들었다. 원래 테스트의 링크 표시/fonts만으로는 그 이동 완료를 보장하지 않았다. 제품 코드는 바꾸지 않고 정규 URL의 문서 load를 5초 안에 기다리는 새 검증을 기존 readiness 앞에 추가했다. 관련 순서 회귀는 수정 전 실패·수정 후 통과했다. 사전 컴파일이나 관측 코드를 쓰지 않은 두 독립 Docker fresh-server 집중 실행에서 원래 인증 2개가 각각 2/2·retry 0으로 통과했다(41.8초, 41.9초; canonical 흐름 15.0초, 14.8초). 원래 실패 기록은 보존한다. 이것은 집중 검증이며 새 commit 전체 gate와 실제 서버 배포는 아직 필요하다.

최종 재검증(2026-09-07 15시대 KST): 위 변경을 `fbd7ccca`로 커밋했다. 같은 SHA의 Mac 전체 Release는 E2E 103/retry 0(5.6분), Node 1,787/기존 skip 8, unit 133으로 통과했다. 전체 206,240바이트·2,342줄 감사는 기존 관리자 전환 경고 2회뿐이었다. 그러나 새 AMD64 전체 gate는 Quick/standalone 빌드 후 뒤로가기에서 다시 실패했다(1 통과·1 실패·101 미실행, 전체 53.5초). 새 canonical 대기와 signup 상호작용을 통과했지만 로그인 대신 제휴 상세로 돌아갔다. 따라서 두 집중 성공을 충분한 해결 증거로 채택하지 않는다. 성공적인 GET 반복은 남고 manifest/연결/React before-mount 오류는 이번 로그에 없다. 원인 전체를 대기 부족 또는 HMR로 확정하지 않는다.

서버에는 `fbd7ccca`의 root 소유 승인 입력·controller·release 소스만 설치했다(source SHA256 `06cecd07a97dfd8c847b31779ce06c29c58b10b6621a1356b879c0c812bda6c8`). 실패한 gate는 성공 receipt·3개 image archive를 만들지 않았고 앱/DB/관측/유지보수의 실행 배포는 계속 차단했다. 원본·진단 로그는 보존했고 작업 전용 진단 container만 제거했다. 추가 대기나 반복 실행으로 통과를 만들지 않는다. 운영 빌드용 별도 E2E 환경은 앞서 명시한 fixture·인증·초기화·이미지 격리 동등성 검토가 필요한 미채택 대안이며, Production 보안 guard는 그대로다. 실제 서버 백업과 Keychain 수신자 반출·Mac 복구도 아직 미완료다.

### 격리 운영 런타임 E2E 구현

2026-09-07 16시대 KST: 사용자가 별도 운영 런타임 E2E 설계를 승인하여 [계획](./plan.md#운영-런타임의-격리-e2e-빌드)을 구현했다. 일반 Production guard는 그대로 두고 명시적 mock CI compiler에서만 작은 fixture 정책을 교체한다. 배포 standalone과 테스트 빌드는 출력·marker·모듈 경계로 분리하고 배포 파일 fingerprint를 테스트 전후/포장 전에 비교한다. 실제 NODE_ENV=production의 Secure/HttpOnly 쿠키를 확인했다. 기존 네이티브 CI·103개 테스트 ID·assertion·retry 0은 유지한다.

초기 nested config cwd, Next의 resolved module 교체, 보고서 경로, env 타입 추론 실패를 각각 회귀 테스트와 함께 수정했다. 운영 CSS optimizer가 표준 backdrop-filter를 제거하는 문제는 실제 optimizer의 실패 재현 후 두 glass 규칙의 선언 순서만 고쳤다. 기존에 삭제된 SVG 두 개를 참조하던 정적 banner도 제거했다. 이 제거 후 캐러셀 시나리오가 사라져 전체 E2E는 14 통과/1 실패/88 미실행으로 중단됐다. 실제 운영 배너/만료 이벤트를 복원하지 않고 명시적인 mock E2E에만 합성 slide를 제공했으며, Production·실제 provider에서는 비활성임을 추가 테스트로 확인했다.

최종 합성 slide 소스의 운영 fixture suite는 103/103·retry 0(1.2분), 기본 suite와 exact ID 일치, 전체 16,882바이트 로그의 오류/경고 신호 0이다. 별도의 최종 화면 검증은 360/820/1366px×라이트/다크 12장과 키보드 닫기·24px blur·가로 넘침·Secure/HttpOnly 쿠키를 확인했다. 화면별 console/page/HTTP/일반 요청 실패는 없었으나, 성공 HTTP 200 RSC의 speculative prefetch 취소는 각각 4/6/6/4/6/6회 관찰되어 별도로 보존했다. 취소 대상의 실제 document GET과 전체 body는 정상이고 정확한 취소 원인/성능 영향은 미확정이다. 이것을 모든 네트워크 이벤트 0으로 표현하지 않는다.

운영자 순서 오류도 보존했다. 진단 Release 실행 중 출력 디렉터리를 이동하여 manifest 오류를 유발한 실행은 중단했고, 전체 E2E 종료 전 시작한 화면 검증도 EADDRINUSE/연결 거부로 실패했다. 두 실행은 수용 증거에서 제외했다. 이후 프로세스 종료와 포트 선점 확인을 거친 독립 화면 검증은 통과했다. 최종 기본 Release도 모든 fixture/화면 프로세스 종료 뒤 순차 실행하여 Node 1,797 통과/기존 skip 8, unit 133, Production build, E2E 103/retry 0(3.4분)으로 완료했다. 전체 207,156바이트·2,352줄 감사에는 기존 관리자 테스트 전환의 Fast Refresh 2회만 있고 다른 오류 신호는 없다. 자체 호스팅 집중 96/96, 문서 93개, canonical lockfile 검사도 통과했다. 앞선 103개 성공이나 운영 fixture 빌드만으로 AMD64 image·서버 배포를 승인하지 않는다. 새 commit의 전체 AMD64 gate·실제 Preview 배포·서버 백업 반출/복구는 아직 남아 있다.

구현은 `4e61ce3f`로 로컬 커밋했다. 해당 SHA의 새 AMD64 gate도 trusted install, Node 1,797/기존 skip 8·unit 133의 Quick, 실제 standalone 빌드까지 통과했으나 추가 fixture 빌드의 페이지 수집에서 종료됐다. Docker Desktop 커널의 16:41 KST 로그는 정확한 gate cgroup의 5GiB 메모리 초과와 빌드 프로세스 OOM 종료를 명시한다. 당시 worker 14개와 종료된 프로세스 약 3.21GiB anonymous RSS를 확인했다. E2E·성공 receipt·세 image archive는 없으며 서버 배포를 하지 않았다. 원래 runner가 terminal container 상태를 별도 저장하지 않았으므로 과거 exit code는 추정하지 않는다. 실패 archive·로그·최소 커널 진단을 보존했다.

후속 수정은 추가 fixture의 static worker만 2개로 제한하고 runner가 terminal 정리 전에 exit/OOM 상태를 보존하도록 한다. 두 회귀 테스트는 수정 전 실패했다. 실제/native 빌드 설정·컨테이너/heap 한도·테스트 제한은 그대로다. 새 호스트 fixture 빌드에서 실제 worker 2개를 확인했고, 운영 E2E 103/retry 0(41.8초)·exact ID·전체 로그 16,885바이트의 오류 신호 0을 확인했다. 이어 순차 실행한 기본 Release도 Node 1,799/기존 skip 8·unit 133·build·E2E 103/retry 0(4.4분)으로 통과했다. 207,315바이트·2,354줄에는 기존 관리자 전환 Fast Refresh 2회만 남았다. 집중 자체 호스팅 98/98, 문서 93개, 타입·lint·canonical lockfile도 통과했다. 새 SHA AMD64 gate는 여전히 별도 필수다. 원격 `dev`는 다시 조회한 `2074e22d`, 서버 SSH/sudo·22:00 KST 만료 창은 정상이고 rootful 실행 서비스와 Preview 초기화는 아직 없다.

### 첫 서버 Preview와 보안 중단 지점

2026-09-07 17시대 KST: `5b807483`의 새 Mac Docker AMD64 gate가 정상 종료했다(exit 0, OOM false). Node 1,799/기존 skip 8, unit 133, 실제 standalone 및 별도 fixture 빌드, E2E 103/retry 0(1.1분), 배포 fingerprint 불변과 3개 archive hash를 확인했다. 전체 247,032바이트·3,089줄을 감사했고 패키징 경고와 의도된 negative unit 진단은 실패 이력에 별도 기록했다. source hash는 `66a7b605917a384b177915097c21b1ddbdb0e3d051e218893c1e8887d327efb5`다. 이는 Mac에서 검증한 AMD64 산출물이며 native 서버 CI 성공은 아니다.

서버의 root 소유 source/controller/release 설치와 importer의 세 archive 검증을 통과한 뒤 새 synthetic Preview를 배포했다. 실제 PostgreSQL 17.6/마이그레이션 199개, RPC/RLS/Storage smoke, 서비스 11개, home/login/health 200, 테스트 reset 404와 test header 부재를 확인했다. 공개된 포트는 모두 서버 loopback이다. Prometheus target 5개 UP, alert rule 12개, Grafana 익명 접근 401/인증 dashboard 10개 panel, Web Vitals enable도 확인했다. 외부 알림 발송 성공은 아니며 Alertmanager 전달 오류 등 관측 초기화 진단은 후속 점검 대상이다.

설치한 여섯 유지보수 타이머는 `current` 링크를 통한 Node 진입점 비교 문제로 실제 명령 없이 exit 0을 반환했다. 모두 중지·비활성화했다. 직접 physical controller 경로에서 실행한 첫 전체 DB/Storage 백업은 실제 성공했다. 유지보수/export 두 진입점 수정의 회귀는 수정 전 2개 실패, 이후 Mac/Linux AMD64에서 각각 2/2를 통과했다. 최종 로컬 Release도 Node 1,801/기존 skip 8, unit 133, build, E2E 103/retry 0(3.5분)으로 통과했다. 전체 207,583바이트·2,356줄에는 기존 between-admin Fast Refresh 2회만 있다. 이 controller 수정은 아직 서버에 적용하지 않았다.

추가 보안 감사에서 초기 DDL 로깅이 새 DB 비밀번호를 3회 기록한 것을 값 출력 없이 확인했다. 현재 세션의 log_statement=none만으로 초기화 안전성을 증명할 수 없다. 앱은 계속 내부 합성 Preview이며 운영 데이터·공개 ingress·클라우드·접근 계정 수명은 변경하지 않았다. 로그 내용 보호와 관련 자격증명 교체의 검토/승인 전에는 타이머 재개와 복구 키 반출을 보류한다. 백업의 실제 PITR/Storage 복원, Keychain 반출과 Mac 복구는 아직 미실행이다.

2026-09-07 17시대 KST 승인 대기 진단: 동일 AMD64 DB 이미지의 새 임시 DB 세 개에서 무작위 합성 canary만 사용했다. 기본 설정은 초기화 비밀번호 3회·실패 SQL 비밀번호 1회를 기록했고, `log_statement=none`만 적용하면 각각 0회·1회였다. [로그 보호 후보](./plan.md#초기화-로그-보호와-합성-자격증명-교체)는 각각 0회·0회였으며 세 경우 모두 ERROR와 명령의 실패 종료를 유지했다. network none·포트 미공개·tmpfs PGDATA·영구 볼륨 없음으로 격리했고 작업 전용 임시 container는 모두 정리했다. 원본 로그와 canary는 저장하지 않고 구조화된 계수만 Git 제외 진단 receipt에 남겼다. 이는 두 재현 경로의 증거이며 모든 오류 채널의 비밀 보호나 서버 수정 완료를 뜻하지 않는다.

같은 시점의 서버 읽기 재검증은 접근 창 22:00 KST, `5b807483` Preview, 백업 1건/명령 20개 성공, 복구 성공·외부 반출 0건, 여섯 타이머 inactive/disabled를 확인했다. 서버 설정·자격증명·타이머는 변경하지 않았다. 로컬 controller 수정 `943dc7ad`도 아직 서버에 적용하지 않았다.

2026-09-07 후속 승인: 사용자가 보안 수정·합성 Preview DB 자격증명 교체·유지보수 적용과 백업/복구 검증을 승인했다. 기본/운영/복구 DB command에 초기 로그 보호를 추가하며, 네 역할의 SCRAM 교체와 실제 private-network 신규/이전 비밀번호 인증을 검증한다. 승인 자체를 서버 적용 완료로 기록하지 않는다.

승인 후 로컬 검증: Compose 초기화/복구 경계 3개 테스트가 변경 전 실패·변경 후 통과했다. SCRAM/역할 목록/SQL 경계 3개와 전체 자체 호스팅 집중 106개도 통과했다. 실제 AMD64 Docker의 새 합성 DB에서 네 역할 모두 새 비밀번호 접속 성공·이전 비밀번호 거절, 초기화/실패 SQL/교체 verifier의 로그 미노출, ERROR 유지까지 확인했다. 포트 미공개 private network와 tmpfs DB만 사용하고 새 시험 container/network는 정리했다. 기존 로컬 서비스는 보존했다.

첫 Release의 테스트용 YAML 타입 선언 오류와 다음 실행의 점유 포트 3100 오류, 별도 집중 실행의 alias loader 누락을 원장에 보존했다. 수정 후 비점유 3189 포트에서 전체 Release가 종료 0으로 끝났다: Node 1,807 통과/기존 skip 8, unit 133, build, E2E 103/retry 0(3.6분). 전체 로그의 특이 신호는 기존 관리자 테스트 전환 Fast Refresh 2회뿐이다. 새 SHA의 AMD64 전체 gate와 실제 서버 교체/백업/복구는 별도 수용 단계다.

2026-09-07 18시대 KST: `30184759` AMD64 gate는 Quick·실제 standalone·추가 fixture build를 통과했으나 검색 초기화에서 종료 1로 멈췄다(25 pass/1 fail/77 unrun/retry 0/OOM false). 전체 220,552바이트·2,777줄과 trace를 보존했다. 검색과 초기화 RSC는 모두 200이었지만 이전 query와 중복 fragment가 남았다. 성공 이미지/result는 생성하지 않았고 서버에는 hash 검증된 source/controller만 설치했다. 실행 Preview·자격증명·타이머는 아직 이전 상태다.

후속 UI micro brief: 공개 사용자의 검색 제출·초기화가 대상이며 기존 홈 필터와 URL을 단일 기준으로 유지한다. 디자인·컴포넌트·문구를 바꾸지 않고 동일 목록의 검색을 [Next가 지원하는 native history push](https://nextjs.org/docs/app/getting-started/linking-and-navigating#native-history-api)로 처리한다. 다른 필터의 replace 및 상세 페이지 이동은 그대로다. 기존 화면에 새 패턴을 추가하지 않는다. 새 no-search-RSC 회귀는 기존 router.push 구현에서 실패했고 최소 수정 뒤 통과했다. 추가 assertion을 포함한 production-fixture 전체 103개도 retry 0으로 통과했다(40.5초). 360/820/1366px에서 정확한 fragment·키보드 제출·뒤로가기/앞으로가기·overflow 부재를 확인하고 전후 screenshot 6개를 Git 제외 QA 폴더에 남겼다. 첫 QA의 미분류 fetch 취소는 보존했고, 새 QA에서는 기존의 엄격한 HTTP 200 RSC prefetch 취소 분류에 해당하는 3/5/4건만 별도 기록했다. 해당 목적지의 실제 문서 본문 200을 확인했고 다른 요청 실패·콘솔 오류·검색 RSC는 0이었다. 일반 Release와 새 SHA AMD64 gate는 별도 필수다.

검색 수정의 일반 Release도 종료 0으로 통과했다: Node 1,807/기존 skip 8, unit 133, 실제 build, E2E 103/retry 0(5.2분). 전체 208,259바이트·2,362줄의 특이 신호는 기존 관리자 전환 Fast Refresh 2회뿐이다. lint·타입·문서 93개·diff 검증도 통과했다. 이는 새 SHA의 AMD64 gate 또는 서버 적용을 대신하지 않는다.

2026-09-07 18:36 이후 최신 적용: `2f60c1855755a4b362b51962db3a75e3b048c6e0`의 AMD64 전체 gate가 종료 0/OOM false로 통과했다(Node 1,807/기존 skip 8, unit 133, E2E 103/retry 0, 1.4분). 전체 235,324바이트·2,941줄에서 의도된 Storage 미지원 503 단위 테스트 진단과 정상 registry metadata/서버 준비 메시지를 구분했으며 실패 신호는 없었다. 동일 커밋의 세 image archive를 빌더 권한으로 전송하고 root importer가 archive/config/layer/revision/AMD64를 검사했다. Mac 실행 출처와 `nativeServerCi=false`를 함께 보존한다. 서버 source SHA256은 `4fc8c1ee049f62ce6da881a63919ede79d5ea968e25e1d7f84ec5f72ff9260f6`이다.

서버의 기존 합성 DB 볼륨과 백업/JWT/세션 키를 보존한 채 네 공유 DB 역할을 새 SCRAM 자격증명으로 교체했다. 실제 private-network 접속에서 새 비밀번호 4/4 성공·이전 비밀번호 4/4 거절을 확인했다. 초기화/운영/복구 command의 로그 보호와 새 DB의 실제 설정, 현재 자격증명 로그 일치 0건을 확인했다. 이전 설정·노출 로그는 서버 root 0700 journal 안에 0600 파일로 보존했고 Mac으로 평문 반출하지 않았다. 교체 절차의 prepared→completed 기록은 56.663초이며 실사용 트래픽의 무중단/SLA 측정은 아니다. 독립 점검은 새 revision의 11개 서비스, home/login/health 200, reset 404, test header 부재, migration 199개, RPC/RLS/Storage smoke, Prometheus 5 target UP/12 rule, Grafana 익명 401/10 panel 및 자체 Vitals 활성화를 확인했다.

새 전체 paired backup은 18:40:44–18:41:33 KST에 19개 명령 모두 성공했다(48.826초). 저장소 검사 2개 명령과 최신 backup의 새 볼륨 PITR/Storage 복구 6개 명령도 모두 성공했다(복구 20.2초). before/after marker와 파일 hash 검증이 포함되며 합성 데이터 규모의 측정이므로 운영 RPO/RTO로 확정하지 않는다. `current` 링크 진입점이 실제 JSON receipt·manifest·DB/운영 metric을 갱신하는 것을 확인했다.

서버의 암호화 pgBackRest/Restic 사본 12,727,808바이트를 기존 pinned VPN SSH로 Mac에 반출했다. 수신 SHA256은 `d2450e2bdf8aa1fd00c5fbfd7035fe3348ae8690fb82fa756f1b605ad4ae7f6a`이며 수신자 개인키는 Mac login Keychain에만 보관했다. 새 Docker volume과 동일 AMD64 DB 이미지에서 서버 접근 없이 PITR marker/Storage hash 복구가 18:44:35 KST에 성공했다. 실행 시 백업 암호 두 개만 전달하고 종료 후 키를 가진 drill container는 제거했으며 복구 volume과 암호화 사본/receipt는 보존했다. 별도 장치 복구 증거이고 같은 집의 재해·Mac 분실 시 키 escrow·정기 외부 백업 증거는 아니다.

암호화 tar·전송/복구 receipt·공개 수신자 참조의 독립 사본을 Mac의 `Library/Application Support/ssartnership-recovery/bundles/20260907-2f60c185`에 보관했다. 디렉터리 0700/파일 0600과 복사본 hash를 검증했고 개인키 파일은 만들지 않았다. 원래 QA 사본도 보존했다. 현재 복구 CLI는 canonical `.tmp` 입력만 허용하므로 보관본 재검증은 새 private 작업 폴더로 복사하고 전송 receipt 이름을 `receipt.json`으로 두어 hash를 다시 검사하는 경로다. `fdesetup status`는 FileVault Off를 반환했다. 지금 복원한 것은 합성 데이터뿐이며, 실제 개인정보의 Mac 복구에는 호스트 디스크 암호화와 독립 키 보관 검증이 선행되어야 한다. 시스템 전체 FileVault 설정/복구 키 정책은 이 앱 배포에서 임의로 변경하지 않았다.

18:45 KST에 여섯 timer를 enabled/active로 재개하고 systemd collect/db-check의 실제 JSON receipt·종료 0을 확인했다. 18:46의 다음 1분 주기 자동 수집도 성공해 metric mtime이 갱신됐다. 다음 증분 백업은 9월 8일 03:00, 전체/저장소 검사는 9월 13일 03:00/05:00, 정기 복구는 10월 3일 06:00 KST다. 이 예정 시각의 미래 실행 성공은 아직 검증되지 않았다. 실제 외부 알림 채널은 미설정이고 Alertmanager 전달 오류 및 일부 관측 초기화 진단은 남아 있다. native 서버 CI와 지속 trigger, 공개 ingress, 운영 데이터/외부 연동 및 Production 전환도 완료하지 않았다.

- [x] 초기화 SQL/비밀번호 로그 경계 수정, 기존 합성 Preview DB 자격증명 교체, 신규 백업과 로그 재감사.
- [x] 검증한 maintenance/export 진입점 controller 적용과 실제 receipt/metric 확인 후 여섯 타이머 재개.
- [x] 합성 Preview의 서버→Mac 암호화 반출, Keychain 수신자와 네트워크 없는 새 볼륨 PITR/Storage 복구.
- [ ] 운영 DB 크기·확장·권한·Storage 객체 수와 hash 목록 조사, 운영 데이터 반입 범위 확정.
- [ ] 운영 전 DB 이미지 최소화: Alpine pgBackRest의 부가 PostgreSQL 18 패키지 제거 방안과 SBOM/취약점 검증. 현재 실행 서버·pg_dump는 원래 Nix PostgreSQL 17.6이며 패키징 경고를 별도 기록했다.
- [ ] 독립 장애 영역의 암호화 백업 저장소 연결, 보관·삭제 정책·잔여 용량 및 쓰기 실패 검증.
- [ ] 서버 밖의 복구 키 보관과 새 장치에서 키를 가져오는 복구 실습.
- [ ] scheduler 설치, 백업 실패/나이/WAL 지연·디스크/서비스 장애 알림의 외부 수신 확인.
- [ ] Vercel Analytics·SpeedInsights 대체: 자체 RUM/Web Vitals·요청 지연·오류·가용성 수집과 대시보드/외부 알림 검증. 기존 내부 제품 이벤트/SQL 지표와 backup-status만으로 완료하지 않는다.
- [ ] 8GB 서버의 runtime·빌드·백업·복원 자원 측정과 동시 실행 제한; RPO/RTO 확정.
- [ ] 별도 rootless CI, 검증된 image archive/digest 승격·rollback, Preview lifecycle와 배포 권한 연결. 상시 registry는 현재 기본 구성에서 제외한다.
- [ ] 운영 데이터와 파일을 새 환경에 복원하고 회원/관리자/파트너 인증·업로드·실제 연동 검증.
- [ ] DNS/HTTPS·신뢰 proxy·Cron 단일 소유권을 전환하고 되돌리기 기준 확인.

홈 서버 접근과 프로젝트 Node 설치는 확인했지만 운영 provider·도메인·데이터 전환 및 외부 운영자 알림은 실행하지 않았다. 전환 게이트가 남아 있는 동안 자체 운영 마이그레이션 완료로 표시하지 않는다.

## 2026-09-07 Production/Preview 동시 운영과 명령형 사본 준비

Issue #435에 두 환경 격리와 단방향 사본 준비 계획을 먼저 기록했다. origin/dev를 fetch해 작업 브랜치가 최신 dev를 포함하는지 확인했고, 원래 루트의 사용자 변경은 보존했다. [두 환경 runbook](../../operations/runbooks/self-host-environments.md)에 실행 명령과 아직 수행하지 않는 전환 경계를 기록한다.

- [x] 새 private directory에서 환경별 프로젝트·DB/JWT/세션 키·볼륨·포트·자원 제한 생성, 공유/변조/중복 초기화 거부.
- [x] 로컬 Docker에서 별도 public-origin 앱 이미지 빌드와 Production/Preview 역할 앱·DB·API·Storage 동시 실행.
- [x] 두 앱의 home/login/health 200, Preview 앱의 단일 internal network와 DB 포트 미공개, 자체 DB 접속 성공·Production DB IP/외부 IP 접속 거절 확인.
- [x] 기존 짝 백업을 격리 복원해 비밀번호/발송 토큰 제거·이메일 마스킹·source migration prefix 검증 후 새 후보에 로드하는 `prepare-copy` 구현.
- [x] 공개 Storage 객체의 파일 metadata 보존과 실제 API SHA256 검증, 후보 DB 행/파일 삭제 후 원본 유지, 상대 환경 service key 거절을 합성 데이터로 확인.
- [x] 비공개 프로필 이미지/ledger 복사·공개 접근 거절·Preview 전용 비밀번호 seed의 실제 해시 검증과 원본 회원 불변 확인.
- [x] 최종 로컬 Release 통과와 전체 로그 진단 기록.
- [ ] 후보 앱 인증/권한 QA, 고정 Preview ingress의 교체·실패 복귀·원본 URL 제거 검증.
- [ ] 홈 서버에 두 환경 상시 적용, TLS/서브도메인, 실제 운영 데이터 반입, GHCR/GitHub Actions 배포 연결 및 전체 자원 부하 검증.

집중 테스트 7개, 타입 검사와 문서 94개 검증을 통과했다. 공개 파일 복사 실습은 22:11 KST에 성공했으며 migration 199개와 6객체/162바이트의 파일 및 API hash를 확인했다. 합성 규모이며 실데이터의 복원 시간/저장 공간 보장이 아니다. 로컬 Docker 이미지는 ARM64이므로 홈 서버 AMD64 배포 검증과 구분한다. UI 소스 변경은 없고 이 단계의 격리 실측은 HTTP/TCP 검사이며 실제 사용자 로그인/쿠키의 브라우저 검증으로 대체하지 않는다.

22:16 KST 최종 합성 복사 시험은 migration 199개, 공개/비공개 8객체·245바이트의 파일 및 API hash를 통과했다. private `member-profile-images` 객체와 public ledger가 유지되고 공개 경로 접근은 거절됐다. 운영 비밀번호 제거 후 후보의 특정 회원 한 명만 새 Preview 비밀번호로 seed하고 실제 PBKDF2 결과를 확인했다. 후보 DB 행/공개 파일 삭제와 회원 비밀번호 변경 뒤 원본은 유지됐으며 후보 키로 원본 API 접근도 거절됐다. source backup은 22:12 KST의 성공한 짝 백업이므로 명령 실행 시점의 live snapshot이라고 부르지 않는다. 모든 receipt의 `activated:false`를 유지하며 기존 Preview 교체는 수행하지 않았다.

개발 중 실패 증거는 Git 제외 작업 폴더에 보존했다. sanitizer의 CHECK 제약(분리 UPDATE)과 정수 배열 cast 오류를 수정하고 회귀 테스트를 추가했다. 고정 helper 이미지가 BuildKit 캐시에만 있던 문제는 실행 전 engine image 검사로 차단한다. internal network 직접 publish 대신 비밀 없는 고정 upstream ingress를 분리했다. 파일 바이트만 복사하면 Storage API가 ENODATA로 실패한 문제는 확장 속성 보존과 모든 객체의 API hash 검증으로 수정했다. 실패 후보 컨테이너는 정확한 이름으로 중지하고 볼륨/실패 receipt를 보존했으며 사용자 서비스와 기존 Preview를 삭제하지 않았다.

첫 Release는 신규 테스트의 JS 추론 타입 오류, 다음 실행은 기존 앱이 사용하는 3100 포트 충돌로 실패했다. 두 로그를 보존하고 타입 수정 및 별도 3199 포트로 재검증해 종료 0을 확인했다: Node 1,814 통과/기존 skip 8, unit 133, build, E2E 103 통과/재시도 없음(6.6분). 전체 208,931바이트·2,368줄에는 기존 실패 경로 단위 테스트의 합성 rollback 진단 4건과 관리자 테스트 사이 Fast Refresh 2회가 있었으며 테스트 실패는 없다. 마지막 CLI 입력 경계 및 비공개 파일 fixture 변경 후 집중 lint·7개 테스트·타입 검사를 다시 통과했고 최종 문서 94개도 확인했다. 이 로컬 단계에서 commit/push/원격 CI trigger/서버 변경/실제 Production 전환은 수행하지 않았다.
