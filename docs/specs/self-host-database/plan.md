---
title: 자체 호스팅 데이터와 운영 복구 기술 계획
type: implementation-plan
status: active
authority: normative
---

# 데이터와 운영 복구 기술 계획

## 구성과 책임

### 원래 Cloud Preview의 전체 이전

Production→Preview 정제 복사와 별도로 원래 Cloud Preview 자체를 읽기 전용 export한다. 기존 GitHub Secrets의 Preview 연결 정보는 export 작업에서만 사용하고 운영자 채팅·명령 인수·Mac 평문 파일로 반출하지 않는다. 서버가 소유하는 별도 age 수신 키의 공개 recipient만 export 환경에 제공한다. 표준 age 도구로 전체 export를 암호화하고 hash/정확한 source SHA/실행 ID를 검증한 뒤 서버의 새 private staging에서만 복호화한다. 자체 암호 알고리즘을 만들지 않으며, age의 성공 종료와 전체 파일 hash 확인 전에는 부분 복호화 결과를 복원 입력으로 공개하지 않는다.

원본 DB dump와 migration/schema/권한/자동 RLS 기능, 모든 Storage bucket·object의 metadata 및 실제 바이트 hash를 보존한다. 일부 bucket만 복사하거나 비밀번호를 정제하는 기존 sync 도구를 이 경로에 재사용하지 않는다. 새 대상에 복원하고 원본/대상 내용을 대조한 뒤에만 전환을 허용한다. DB snapshot과 Storage의 관측 구간을 기록하고 원본 쓰기 경합을 검사하며, 최종 쓰기 정지·증분 확인·DNS/TLS·실제 인증/업로드/읽기 및 실패 복귀 검증 전에는 원래 Preview의 대체 완료로 표시하지 않는다. 원본 cloud 프로젝트·실행 Preview·기존 백업과 복구 키는 이 export에서 변경하지 않는다.

### 상시 두 환경과 후보 기반 데이터 복사

`scripts/self-host-environments/`는 기존 Compose·마이그레이션·짝 백업 복원 도구를 조합한다. 환경 설정은 새 private directory에만 생성하며 중복 초기화, symlink, 파일/descriptor drift, 공유 백업 볼륨, DB system identifier 불일치를 거부한다. 환경별 immutable 앱 이미지의 public build 설정을 각각 맞춘다. 로컬 브라우저 검증도 Production 역할은 `127.0.0.1`, Preview 역할은 `localhost`로 분리한다. 실제 서비스의 두 HTTPS 도메인·ingress는 별도 전환 단계다.

복사는 기존 paired backup을 읽기 전용으로 복원한다. source migration checksum-prefix와 재생한 스키마 catalog를 대조하고, 검토한 public table/민감 column 정책을 적용한다. 회원 비밀번호는 NULL, 필수 파트너 비밀번호는 공개하지 않는 난수 sentinel, 이메일은 동일 복사 안에서 일관된 `preview.invalid` 주소가 된다. 새 DB는 원본 migration prefix → 데이터 → dev suffix 순서로 복원하고 FK 무결성을 확인한다. Storage는 공개 bucket과 private `member-profile-images`의 ledger 참조 파일만 read-only snapshot에서 새 볼륨으로 복사하고 SHA256을 검증한다. 공개 Storage URL은 후보 환경 주소로 치환한다.

초기 명령은 `prepare-copy`까지 제공하며 후보 DB/API/Storage 검증과 기존 Preview 보존을 우선한다. 후보 앱의 동일 public-origin 빌드, 고정 ingress의 교체/실패 복귀, 두 환경의 실제 홈 서버 상시 배포, 부하·쿠키·권한의 운영 검증이 끝나기 전에는 전체 데이터 동기화 기능을 완료로 표시하지 않는다. GitHub Actions/GHCR 자동 연결과 실제 운영 데이터 이전은 이 로컬 단계에 포함된 완료 사실이 아니다.

데이터 구성은 `compose.supabase.yaml`의 `db`, `rest`, `storage`, `gateway`다. 환경마다 Compose 프로젝트·포트·비밀·볼륨을 분리한다. gateway만 loopback으로 공개하며 DB와 관리 도구는 내부망에 둔다. 기존 앱은 서버 SDK의 공개 origin/내부 transport 분리를 통해 연결한다.

Supabase `self-hosted/v0.8.0`의 고정 commit `241bb11c0627f2981746d37033f57dbfa81d29b0`을 구성 호환성 기준으로 삼는다. PostgreSQL 17, PostgREST, 파일 backend의 Storage와 gateway를 사용한다. 현재 앱이 직접 구현한 인증을 GoTrue로 교체하지 않으며 사용 근거가 없는 Realtime·Studio·상시 analytics 서비스를 추가하지 않는다. 이미지 tag와 digest는 Compose가 실행 원본이다.

운영 overlay는 pgBackRest가 포함된 동일 PostgreSQL 기반 이미지, 암호화 백업 저장소, Restic 일회성 도구를 추가한다. 운영 script는 shell 문자열로 비밀을 조합하지 않고 제한된 인자·입력·환경 파일을 사용한다. 서비스 사용자와 운영 CLI 권한은 분리하며 Docker 제어권은 신뢰된 호스트 운영자에게만 둔다.

## 초기화와 복구

1. 환경 이름과 포트 검증 후 난수 비밀 파일을 만든다. 기존 파일은 덮어쓰지 않는다.
2. DB와 Storage의 자체 schema 초기화를 확인한다.
3. 불변 migration 파일을 잠금·transaction·checksum ledger 아래 순차 적용한다. 실패한 transaction은 ledger에 성공으로 기록하지 않는다.
4. 대표 API·RPC·Storage·권한 검증을 실행하고 재시작 후 저장 상태를 확인한다.
5. 백업은 DB 복구 지점·WAL과 파일 스냅샷 ID를 manifest로 연결한다. 복구는 새 볼륨에서 검증한다.

전체 백업에 필요한 WAL부터 복구 목표까지 아카이브가 연속적으로 존재해야 PITR이 가능하다. 증분 백업은 앞선 백업 chain에 의존한다. DB와 파일의 일관된 복구를 위해 짝지은 백업 동안 앱·Storage 쓰기를 일시 중단하거나 동등한 쓰기 정지를 검증해야 한다. [pgBackRest 공식 가이드](https://pgbackrest.org/user-guide.html)를 따른다.

## 운영 환경 준비

장기 기본안은 Next.js 유지와 최소 Supabase 자체 호스팅이다. 앱 프레임워크 교체는 배포 독립성에 필수적이지 않으며, 순수 PostgreSQL만 남기려면 현재 사용 중인 REST/RPC·RLS·Storage와 공개/서명 URL 계약을 다시 구현·검증해야 한다. 이번에는 운영 주체를 옮기고, 이후 실제 유지보수 부담을 측정하여 Repository/Storage adapter 단위로 교체 여부를 판단한다.

서버 접근 후 다음 순서로 서비스와 자동화를 구현한다. 아래 항목은 **계획이며 아직 설치되지 않았다**.

1. 외부 암호화 백업: 다른 장애 영역의 사용자 소유 SFTP/S3 호환 저장소에 pgBackRest/Restic을 연결하고 복구 키를 서버 밖에 보관한다. 같은 집·디스크의 추가 컨테이너는 외부 백업으로 인정하지 않는다. 빈 장치의 실제 복구, 접근 실패, 용량 부족, 보존 chain 만료를 시험한다.
2. 인프라 감시: Prometheus + node_exporter/postgres_exporter + Alertmanager, 관리망 전용 Grafana를 기본안으로 한다. backup manifest를 textfile metric으로 내보내고 디스크·메모리·DB 연결·WAL 보관·백업/복구 나이·HTTP 오류를 수집한다. 낮은 cardinality와 제한된 보존 기간으로 시작해 8GB 자원 예산을 실측한다. 알림은 [Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/), 호스트/DB 수집은 [node_exporter](https://github.com/prometheus/node_exporter)와 [postgres_exporter](https://github.com/prometheus-community/postgres_exporter), 대시보드는 [Grafana Docker](https://grafana.com/docs/grafana/latest/setup-grafana/installation/docker/)를 따른다.
3. 외부 장애 탐지: 홈 서버 밖의 독립 장치에서 HTTPS probe와 heartbeat 누락을 감시한다. 같은 서버의 Alertmanager만으로 서버 전원·회선 장애 알림을 보장하지 않는다. 외부 webhook/메일의 실제 수신까지 확인한다.
4. Vercel 성능 기능 대체: 기존 제품 이벤트/SQL 지표를 유지하고 [web-vitals](https://github.com/GoogleChrome/web-vitals) 기반 LCP/INP/CLS를 자체 수집 endpoint·제한된 집계 저장소·Grafana에 연결한다. 입력 검증, 요청 크기/빈도 제한, 샘플링, URL query·회원 식별자 제거, 보존/삭제 계약과 실제 브라우저 성능 회귀 검증이 필요하다. Umami 같은 별도 제품 분석 서비스는 기존 지표와 중복될 수 있어 기본 구성에 추가하지 않는다. 요청 지연·오류 및 개인정보를 제거한 회전 로그도 함께 다룬다.
5. CI/CD: 기존 GitHub 저장소/검토 정책은 유지하고 홈 서버의 격리된 rootless CI runner를 연결한다. 자체 OCI registry는 [CNCF Distribution](https://distribution.github.io/distribution/about/)을 후보로 TLS·인증·보존/GC·백업까지 검증한다. runner에는 운영 Docker 소켓·DB/백업 비밀을 주지 않는다. 신뢰되지 않은 PR을 운영망 runner에서 실행하지 않는다. source SHA·플랫폼·공개 빌드 설정별 immutable digest를 만들고 별도 제한된 배포 주체가 dev 검증→수동 승인→운영 적용·health→이전 digest rollback을 수행한다. workflow 활성화와 registry 게시·배포는 별도 승인된 실행이다.
6. 유지보수: 월간 격리 restore, 이미지 보안 업데이트와 업그레이드 리허설, DB autovacuum/장기 transaction·용량 추세, 로그·registry·테스트 환경 수명주기, 비밀 rotation과 감사 기록을 운영 목록으로 묶는다. 관리 CLI는 신뢰된 SSH 운영자 전용이며 HTTP Management API 전체 복제나 Kubernetes 도입은 현재 필요하지 않다.

서버 문서의 8GB 메모리와 별도 CI 자원을 고려하여 백업·빌드·복구를 동시에 실행하지 않는다. 초기 RPO/RTO 후보는 DB 5분, 파일 24시간, 전체 복구 2시간이지만 아직 측정된 보장이 아니다. 운영 데이터 크기·WAL 생성량·외부 저장소 속도·복구 실습을 바탕으로 전환 전에 확정한다.

Preview는 운영 데이터가 없는 독립 환경부터 제공한다. 데이터 복제 기능을 추가할 때 기존 sanitizer의 비밀번호 제거·Storage 개인정보 경계를 그대로 검증한다. 외부 branch service의 자동 생성/삭제 이벤트 연결, 홈 CI runner 및 이미지 registry·승격 권한 연결은 서버 접근 후 구현·검증할 배포 단계다.

## 검증·전환

### 운영 런타임의 격리 E2E 빌드

2026-09-07 사용자가 별도 운영 빌드용 E2E 환경 설계를 승인했다. Issue #435의 기존 범위 안에서 AMD64 Mac 대체 gate를 다음 순서로 변경한다. 실패한 개발 서버 gate의 결과는 그대로 보존하며 native 서버 CI의 자원 제한이나 실행 방식을 변경하지 않는다.

1. 기본 fixture 정책은 기존 `NODE_ENV !== production` 조건을 유지한다. 회원·관리자 mock 인증, E2E 변경/초기화, 제품 이벤트의 테스트 no-op만 이 정책을 공유한다. 인증 토큰·권한·Secure 쿠키·필수 회원 gate는 변경하지 않는다.
2. 명시적인 CI 전용 빌드에서만 webpack이 이 작은 정책 모듈을 합성 fixture 모듈로 교체한다. `NODE_ENV=production`, 두 데이터 소스 `mock`, 별도 출력 `.next-e2e`, standalone 비활성화를 모두 요구한다. 배포 빌드와 동시 flag 설정, 개발 compiler, 실제 연결 비밀 및 dotenv 파일은 거절한다. 일반 compiler는 테스트 전용 모듈이 module graph에 들어오면 실패한다. 런타임 환경 변수만으로 일반 배포 이미지의 정책을 교체할 수 없다.
3. 실제 Supabase standalone 결과는 `.next`에 한 번 만들고 별도 fixture 결과는 `.next-e2e`에 만든다. 테스트 시작 시 전용 marker와 loopback origin을 검증한다. 배포 패키지는 `.next/standalone`·`.next/static`만 포함하고, 실제 빌드 설정/공개 manifest/테스트 marker 부재를 다시 검사한다. 테스트 결과를 배포 이미지라고 부르거나 fixture 빌드를 배포 archive에 넣지 않는다.
4. 같은 103개 프로젝트별 테스트 ID·fixture·assertion·초기화·deadline·retry 0을 유지하여 `next start`로 전체 suite를 실행한다. 기존 전체 로그 오류 방어도 유지한다. 실제 Supabase/RLS/RPC/Storage 및 최종 immutable 이미지 검증은 별도 필수 계층으로 남는다. Secure 쿠키의 loopback Chromium 동작은 실제 인증 흐름에서 검증하고 문제가 있으면 TLS 테스트 환경을 설계하며 쿠키 보안을 낮추지 않는다.
5. 먼저 정책·잘못된 빌드 조합·실제 webpack 교체/격리·패키지 경계의 회귀 테스트를 작성한다. 호스트 전체 Release와 별도 운영 fixture suite 이후 새 SHA의 전체 AMD64 gate를 실행한다. 하나라도 실패하면 성공 receipt·배포를 차단하고 원본 증거와 원인을 기록한다.

이는 개발 HMR의 모든 이전 실패 원인을 확정한 수정이 아니라, 요청 시 compiler가 실행되지 않는 [Next production 실행 방식](https://nextjs.org/docs/app/api-reference/cli/next)을 사용하는 검증 체계 변경이다. [webpack 확장](https://nextjs.org/docs/app/api-reference/config/next-config-js/webpack)과 [Playwright webServer](https://playwright.dev/docs/test-webserver)의 고정 버전 동작을 실제 빌드와 브라우저로 검증한다.

운영 CSS 검증에서 발견한 좁은 회귀도 같은 작업에 포함한다. 사용자와 단일 행동은 제휴 링크 복사 후 완료 확인이며, 표면은 기존 Toast와 같은 glass 선언을 쓰는 모바일 탐색이다. 디자인·토큰·레이아웃은 그대로 두고 vendor 선언을 표준 선언보다 먼저 배치해 실제 Tailwind 운영 optimizer에서 표준 backdrop-filter가 사라지지 않게 한다. 새로운 glass 표현을 추가하지 않는다. 설치된 optimizer의 축소 재현, 원래 103개 assertion, 360/820/1366px 라이트·다크 화면과 닫기·넘침 검증을 요구한다.

추가 브라우저 검증에서 기본 배너 제거 커밋 뒤 남은 정적 catalog의 삭제 SVG 참조 2개를 확인했다. 기존 삭제 의도를 유지해 해당 정적 항목만 제거하고 파일 존재 검사를 추가한다. 현재 DB의 운영 배너나 기존 migration은 변경하지 않는다.

삭제 후 전체 suite는 캐러셀 배치 시나리오의 합성 데이터 부재로 실패했다. 만료된 이벤트나 폐기된 기본 배너를 재활성화하지 않고, 명시적인 mock E2E에만 기존 배포 이미지 자산을 쓰는 합성 slide를 제공한다. 기본 Production 정책·실제 provider·E2E 비활성 환경에서는 빈 배열을 반환한다. 기존 103개 ID와 캐러셀의 세 viewport assertion은 유지한다.

첫 새 AMD64 gate는 별도 fixture 빌드의 페이지 수집 단계에서 14개 worker와 함께 5GiB cgroup OOM으로 종료됐다. 설치된 Next 16.2.11의 `getNumberOfWorkers`에서 명시적 `experimental.cpus`가 worker 수를 결정하는 것을 확인했다. 추가 fixture 빌드에만 2개를 명시하고 실제/native 빌드·heap·컨테이너·테스트 한도는 유지한다. 이는 [Next 빌드 메모리 운영](https://nextjs.org/docs/app/guides/memory-usage)의 병렬 실행/메모리 경계를 반영하는 제한이며 전체 빌드 성공은 새 SHA로 다시 검증한다. Mac runner는 terminal container 정리 전에 구조화된 exit/OOM 상태를 남긴다.

### 개발 manifest 경합의 제한된 수정 검증

2026-09-07 재개 시 서버의 실제 접근 창은 22:00 KST까지로 확인했다. Issue #435 범위에서 먼저 기존 103개 개발 E2E와 Production 인증 경계를 그대로 유지하는 수정안을 검증한다. [webpack의 outputFileSystem 확장점](https://webpack.js.org/api/node/#custom-file-systems)을 사용해 명시적으로 활성화한 자체 호스팅 CI의 개발 빌드 manifest만 같은 디렉터리의 임시 파일에 완성한 뒤 rename한다. 읽기/JSON.parse·manifest 내용·node_modules는 변경하지 않고, 쓰기/rename 실패는 원래 compiler callback에 전달한다. 비-manifest 출력과 Production 빌드는 그대로 둔다. 동일 경로의 쓰기는 순서대로 처리하며 부분 실패가 다음 작업의 큐를 영구 차단하지 않게 한다.

변경 범위는 개발 전용 webpack helper, next.config의 dev+명시 flag 조건, 자체 호스팅 E2E 환경 flag와 집중 회귀 테스트다. 출력 경로 경계·동시 쓰기 중 이전 완성본 유지·쓰기/rename 실패·임시 파일 정리·일반 파일 전달·Production 비활성화를 먼저 검증한다. 이후 AMD64 실제 전체 gate에서 manifest/HTTP/브라우저 오류가 없고 103개가 retry 0으로 통과해야 이미지를 승인한다. 이 수정은 [upstream #97594](https://github.com/vercel/next.js/issues/97594)의 bundler asset 쓰기 경합을 대상으로 한 검증안이며 Next가 직접 갱신하는 prerender manifest의 read-modify-write를 해결한다고 주장하지 않는다. 효과를 입증하지 못하면 실패 결과를 보존하고 런타임 E2E 재설계 후보와 별도로 판단한다. 테스트 우회·제한 연장·부분 결과 승인은 하지 않는다.

### 2026-09-07 실행 추가 범위

사용자가 기반 커밋 이후 위 여섯 운영 항목의 Docker 구현·시험과 서버 배포를 승인했다. [Issue #435 추가 계획](https://github.com/MyKnow/ssartnership/issues/435#issuecomment-5561917265)을 따른다. 기존 클라우드의 중단·Production 데이터 전환은 도메인과 전환 선택이 확정되기 전 실행하지 않는다.

- 외부 사본은 pgBackRest와 Storage Restic의 **암호화된 저장소 및 짝지은 manifest**를 별도 암호화 Restic 저장소로 운반한다. 같은 operations 잠금 아래 보존/삭제와 경쟁하지 않게 한다. 사본의 보장 시점은 선택 manifest의 DB 복구 지점과 Storage snapshot이며, 실시간 외부 WAL 복제로 표현하지 않는다. 복구 키는 사본 안에 넣지 않는다. 원격 REST HTTPS 수신과 인증·append-only, 새 대상 복원·오류 탐지를 시험한다. 외부 목적지 미정 시 Docker 모의 수신과 서버 밖 장치의 사본을 구분한다.
- 관측 구성은 별도 Compose overlay와 관리망으로 나눈다. Prometheus 7일/2GB 보존, Grafana 익명/회원가입 차단과 provisioned dashboard, PostgreSQL의 pg_monitor 전용 계정, node_exporter textfile 지표를 사용한다. DB superuser와 Docker socket을 exporter에 제공하지 않는다. Alertmanager 수신 adapter는 고정 수신처와 제한된 메시지만 전달하고 인증/전송 실패를 숨기지 않는다.
- Web Vitals는 앱 경계에서 LCP/INP/CLS의 유효한 수치와 유한한 route 분류만 수용한다. 원본 URL·회원/IP 식별자·metric ID·브라우저 entries를 저장하지 않는다. origin·크기·빈도 제한 후 내부 collector가 histogram으로 집계하고 Prometheus가 보관한다. 기존 제품 이벤트와 분리한다.
- CI는 기존 ci-builder rootless Docker 및 1 job/30분/자원 제한을 유지한다. 검토된 SHA의 고정 source bundle을 실행하고 결과 image/archive manifest를 운영 비밀과 분리한다. 운영 배포는 별도 신뢰 주체가 exact SHA·digest·platform·health를 검증한다. 잘못된 repo/ref·실패 job·불완전 artifact·동시 실행을 거절하고 이전 앱 digest rollback을 시험한다.
- 단일 호스트의 초기 artifact 전달은 checksum과 이미지 digest가 검증된 Docker image archive로 구현한다. 앞의 registry는 후보였으며 이번 기본 구성에는 설치하지 않는다. 별도 registry의 인증·GC·백업 운영을 추가하지 않아도 빌더/배포 권한 분리는 가능하다. 여러 배포 호스트로 확장할 때 동일 manifest 검증 뒤 registry transport를 추가한다. 압축 파일이나 mutable tag만으로 배포를 승인하지 않는다.
- 서비스 장애·백업/점검 실패·노후 지표·만료 전 접근 상태를 관찰하며 실제 실행 증거를 작업 목록과 runbook에 갱신한다. 전체 release gate와 서버 AMD64 검증은 로컬 ARM64 증거와 별개다.

Node 집중 테스트는 파싱·권한·명령 조합·drift·복구 대상 방어를 검사한다. 실제 Docker 검증은 초기화·API·파일·지속성·백업·PITR을 검사한다. `check:docs`, 타입 검사, lint 및 저장소 Release gate는 실제 worktree에서 실행한다. 원격 provider CI, 홈 서버 부하, 외부 백업과 재설치 복구는 로컬 테스트로 대체하지 않는다.

업그레이드는 image digest 변경→격리 환경 초기화/복원→회귀 검증→백업→단일 운영 적용 순서다. 앱 rollback은 이전 이미지로 가능하지만 PostgreSQL major downgrade와 적용된 schema의 자동 역변환은 금지한다. 호환되지 않는 변경의 되돌리기는 검증한 백업을 새 환경에 복원하여 전환한다.

[명세](./spec.md)와 [작업 목록](./tasks.md)에 완료 증거와 미완료 게이트를 기록한다.

### 유지보수 진입점의 링크 경로 검증

서버의 versioned controller를 `current` 링크로 실행하는 실제 경로도 검증한다. Node의 물리 module URL과 argv 링크를 비교하여 명령이 생략되는 문제는 maintenance/export 두 진입점에서 argv를 realpath로 해석하여 고친다. root/승인/잠금/비밀 처리 경계는 그대로 유지한다. 직접·링크 subprocess를 모두 실행하되 테스트에서는 UID를 비특권으로 고정하여 실제 운영 상태에 접근하지 않는다. 로컬 전체 gate와 Linux 회귀 뒤 controller만 새 version으로 교체하며, 이미 검증된 앱·DB·telemetry 이미지와 데이터 release는 `5b807483`에 유지한다. 실행 receipt·metric 파일·실제 백업과 복구를 확인한 뒤 중지한 여섯 타이머를 재개한다. 타이머 active/프로세스 exit 0만으로 수용하지 않는다.

### 초기화 로그 보호와 합성 자격증명 교체

2026-09-07 사용자가 로그 보호 수정, 합성 DB 비밀번호 교체, 유지보수 적용 및 백업·복구 후속 검증을 승인했다. [PostgreSQL 17 로그 설정](https://www.postgresql.org/docs/17/runtime-config-logging.html)에 따라 `log_statement=none`만으로 실패한 SQL 본문은 차단되지 않는다. `log_statement=none`, `log_min_error_statement=panic`, `log_error_verbosity=terse`, `log_parameter_max_length_on_error=0`을 실제 entrypoint가 시작하는 임시 초기화 서버부터 전달한다. 오류 심각도와 명령 실패는 유지한다. 이 설정도 오류 메시지 자체나 다른 출력 경로의 모든 민감 값을 지운다는 보장은 아니다.

기본 data Compose와 operations overlay의 DB command 재정의, 새 초기화와 복구 실행 경계를 함께 검사한다. 먼저 합성 canary로 성공한 초기화 DDL과 실패 SQL의 값 미노출, ERROR 유지·비정상 종료, 정상 bootstrap·인증·Storage·백업을 회귀 검증한다. 이후 운영 잠금과 쓰기 중지 아래 실제 역할/소비자 목록을 대조하여 기존 합성 Preview DB 비밀번호와 대응 비밀 파일을 교체하고 재연결·RPC/RLS·Storage·health를 확인한다. 실제로 같은 비밀번호를 쓰는 네 역할만 허용하며 변경 SQL은 평문 대신 salt가 다른 SCRAM verifier를 stdin으로 전달한다. 로컬 loopback의 trust 인증은 교체 증거가 아니므로 별도 private network client에서 네 역할의 신규 인증 성공과 이전 비밀번호 거절을 모두 확인한다. 기존 데이터 볼륨과 별도 암호화 키는 보존한다. 기존 로그의 접근 통제와 잔존 범위를 확인하되 원본 증거를 임의 삭제하지 않는다.

교체 후 신규 DB/Storage 짝지은 백업과 로그 재감사를 완료해야 복구 자료 반출을 재개한다. controller 링크 수정의 실제 receipt/metric 및 복구 검증과 구분해 타이머 재개를 판단한다. Production 데이터 반입·DNS/공개 ingress·클라우드 변경·접근 계정 수명 변경은 이 제안의 범위 밖이다.
