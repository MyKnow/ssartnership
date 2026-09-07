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
