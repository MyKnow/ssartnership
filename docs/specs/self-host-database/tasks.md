---
title: 자체 호스팅 데이터와 운영 복구 작업 목록
type: task-list
status: active
authority: normative
---

# 데이터와 운영 복구 작업 목록

상위 작업은 [Issue #435](https://github.com/MyKnow/ssartnership/issues/435)와 [마이그레이션 작업 목록](../self-hosting/tasks.md)이다. 코드 준비와 실제 실행 완료를 구분한다.

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

- [ ] 운영 DB 크기·확장·권한·Storage 객체 수와 hash 목록 조사, 운영 데이터 반입 범위 확정.
- [ ] 독립 장애 영역의 암호화 백업 저장소 연결, 보관·삭제 정책·잔여 용량 및 쓰기 실패 검증.
- [ ] 서버 밖의 복구 키 보관과 새 장치에서 키를 가져오는 복구 실습.
- [ ] scheduler 설치, 백업 실패/나이/WAL 지연·디스크/서비스 장애 알림의 외부 수신 확인.
- [ ] Vercel Analytics·SpeedInsights 대체: 자체 RUM/Web Vitals·요청 지연·오류·가용성 수집과 대시보드/외부 알림 검증. 기존 내부 제품 이벤트/SQL 지표와 backup-status만으로 완료하지 않는다.
- [ ] 8GB 서버의 runtime·빌드·백업·복원 자원 측정과 동시 실행 제한; RPO/RTO 확정.
- [ ] 별도 rootless CI, 검증된 image archive/digest 승격·rollback, Preview lifecycle와 배포 권한 연결. 상시 registry는 현재 기본 구성에서 제외한다.
- [ ] 운영 데이터와 파일을 새 환경에 복원하고 회원/관리자/파트너 인증·업로드·실제 연동 검증.
- [ ] DNS/HTTPS·신뢰 proxy·Cron 단일 소유권을 전환하고 되돌리기 기준 확인.

홈 서버 접근과 프로젝트 Node 설치는 확인했지만 운영 provider·도메인·데이터 전환 및 외부 운영자 알림은 실행하지 않았다. 전환 게이트가 남아 있는 동안 자체 운영 마이그레이션 완료로 표시하지 않는다.
