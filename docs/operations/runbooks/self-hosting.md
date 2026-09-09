---
title: 자체 호스팅 앱 빌드와 실행
type: runbook
status: current
authority: normative
issue: https://github.com/MyKnow/ssartnership/issues/435
---

# 자체 호스팅 앱 빌드와 실행

이 절차는 [자체 호스팅 명세](../../specs/self-hosting/spec.md)의 앱 실행 작업이다. 전체 데이터 이전과 서버 전환의 남은 조건은 [작업 목록](../../specs/self-hosting/tasks.md)을 확인한다. 모든 명령은 저장소 루트에서 실행한다.

## Docker Desktop 로컬 smoke

Docker Desktop이 실행 중인지 확인한 뒤 독립적인 Compose project 이름으로 빌드하고 시작한다. 로컬 덮어쓰기는 상속된 secret 환경 파일을 제거하는 `!reset` 문법을 사용하므로 Docker Compose 2.24.4 이상을 사용한다.

```bash
docker compose -p ssartnership-smoke -f compose.yaml -f compose.local.yaml config --quiet
docker compose -p ssartnership-smoke -f compose.yaml -f compose.local.yaml up --build -d --wait
docker compose -p ssartnership-smoke -f compose.yaml -f compose.local.yaml ps
curl --fail http://127.0.0.1:3100/api/health
curl --fail --output /dev/null http://127.0.0.1:3100/
docker compose -p ssartnership-smoke -f compose.yaml -f compose.local.yaml exec app id
docker compose -p ssartnership-smoke -f compose.yaml -f compose.local.yaml restart app
```

재시작 후 liveness와 공개 페이지를 다시 확인한다. 홈 응답 HTML의 `/_next/static/` 자산 하나도 실제로 가져와서 public/static 복사를 확인한다. 앱은 비root 사용자여야 한다. `/api/health`는 DB 연결을 검사하지 않는 liveness이며, 이 검증의 mock 데이터는 실사용자 인증·DB 복원 증거가 아니다. 모의 인증용 bypass는 활성화하지 않는다.

이름이 지정된 테스트 프로젝트만 중지한다. `down -v`나 전체 Docker 정리는 사용하지 않는다.

```bash
docker compose -p ssartnership-smoke -f compose.yaml -f compose.local.yaml down
```

## 빌드와 실행 설정

`Dockerfile`은 Node 24.18.1 기반 이미지와 저장소 trusted install을 사용한다. Mac에서 Linux arm64 빌드를 성공해도 홈 서버의 Linux amd64 실행 검증은 별도로 필요하다. 운영 호스트 아키텍처를 확인하고 해당 `--platform` 이미지를 만든다.

빌드 공개 설정은 `NEXT_PUBLIC_DATA_SOURCE`, `NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`다. 사용하지 않는 선택 값도 이미지와 런타임이 일치해야 한다. 이 값들은 이미지에 들어가므로 비밀을 넣지 않는다. 실제 데이터 모드의 두 data source는 `supabase`다. 공개 사이트·Supabase URL은 운영에서 HTTPS를 사용하며 로컬 loopback의 HTTP는 로컬 검증 용도다.

```bash
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_DATA_SOURCE=supabase \
  --build-arg NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE=supabase \
  --build-arg NEXT_PUBLIC_SITE_URL=https://app.example.com \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://data.example.com \
  --tag ssartnership:reviewed-sha .
```

`deploy/self-host/runtime.env.example`에서 환경별 비밀 파일 `deploy/self-host/runtime.env`를 준비한다. 파일은 Git에서 제외하고 소유자만 읽도록 권한을 제한한다. 환경 값을 터미널 출력·공유 로그·이미지 build argument에 포함하지 않는다. `docker compose config`는 비밀을 표시할 수 있으므로 검증할 때 `--quiet`를 사용한다.

공개 값은 위 이미지와 동일하게 설정한다. `SUPABASE_URL`은 SDK가 브라우저용 파일 URL을 만들 수 있도록 `NEXT_PUBLIC_SUPABASE_URL`과 같은 공개 origin을 사용한다. 서버 전송은 선택적인 `SUPABASE_INTERNAL_URL`에 Compose 내부 서비스 주소(예: `http://gateway:8000`)를 지정한다. `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, 세션 키와 기능별 외부 연동 비밀은 runtime 파일로만 전달한다. 정확한 필수 설정과 오류 코드는 `deploy/self-host/runtime-env.mjs`가 최종 근거다. `runtime.env.example`의 placeholder 상태로 운영 실행하지 않는다.

실제 공급자 실행에서는 `compose.local.yaml`을 사용하지 않는다. 리뷰한 immutable image digest를 `SELF_HOST_IMAGE`에 지정한다.

```bash
SELF_HOST_IMAGE=registry.example.com/ssartnership@sha256:REVIEWED_DIGEST docker compose -p ssartnership -f compose.yaml config --quiet
SELF_HOST_IMAGE=registry.example.com/ssartnership@sha256:REVIEWED_DIGEST docker compose -p ssartnership -f compose.yaml up -d --wait
```

위 레지스트리 주소와 digest는 예시다. 이미지 게시와 홈 서버 배포는 별도 실행 단계다. 실제 자체 호스팅 Supabase와 연결할 때 앱과 gateway가 같은 명시적 Compose 네트워크에서 통신하도록 통합 구성을 검증한다.

Storage SDK의 signed/public URL과 공개 이미지 프록시는 [데이터 실행 절차](./self-host-database.md)에 따라 검증한다. 공개 origin과 내부 전송 주소를 설정한 것만으로 실제 업로드·다운로드 검증을 완료 처리하지 않는다.

## 공개 edge와 TLS

공개 edge는 별도 Caddy Compose overlay로 고정한다. Caddy는 기존 Preview edge network에서만 `app:3000`과 `gateway:8000`을 향해 프록시하고, Docker socket·관리 API·데이터 network에는 접근하지 않는다. Caddyfile의 `ssartnership-dev.myknow.xyz`와 `ssartnership-api-dev.myknow.xyz`는 실제 DNS가 홈 서버를 가리키고 방화벽 포워딩을 검증한 뒤에만 인증서를 발급한다.

```bash
docker compose -p ssartnership-edge -f deploy/self-host/compose.edge.yaml config --quiet
docker compose -p ssartnership-edge -f deploy/self-host/compose.edge.yaml run --rm --entrypoint caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

`config --quiet`와 Caddy validate는 공개 변경 없이 설정만 검사한다. 공개 전환 전 원본 Preview의 외부 암호화 백업/복구 드릴, 원본 쓰기 중지와 최종 동등성, DNS 수정 권한, 방화벽 전달 경로 및 기존 DNS 복구값을 확보한다. 합성 환경의 백업은 원본 Preview 복구 증거를 대신하지 않는다. 승인된 전환 창에서 edge를 시작하고 두 DNS 레코드를 홈 서버로 연결한 뒤 실제 TLS 발급과 외부 probe를 검증한다. 발급 전에 TLS 성공을 선행 조건으로 요구하지 않는다. 두 origin의 HTTPS redirect, 정상 Host/protocol 전달, `/api/health`, 로그인, Storage 업로드·다운로드를 확인하고 인증서 갱신 상태도 운영 점검에 포함한다. 실패하면 기존 DNS를 복원하고 Caddy를 중지한다. 전환 중 홈 서버에 새 쓰기가 있었다면 원본을 재개하기 전에 데이터 차이를 확인한다.

## Cron 이식

Production 홈 서버 전환에서는 `vercel.json`의 `git.deploymentEnabled.main=false`로 main 커밋의 Vercel 자동 배포를 중지한다. 지정하지 않은 dev와 작업 브랜치는 Preview 배포를 유지한다. 이는 새 앱이 이전 Cloud 스키마에 먼저 배포되는 것을 막는 전환 계약이다. 기존 Vercel 배포는 복구용으로 보존하며 이 설정만으로 기존 요청이나 Cron이 중지되지는 않는다. 최종 데이터 복사 직전에 Vercel 설정에서 Cron을 비활성화하고 기존 Production 요청을 정지한 뒤 진행 중인 쓰기 종료와 원본 쓰기 차단을 확인한다. 신규 Production 검증은 승인된 main SHA의 홈 서버 이미지·DB·실제 공개 흐름을 기준으로 수행한다. 새 서버가 쓰기를 받은 뒤에는 데이터 차이 확인 없이 기존 서비스와 DNS를 재개하지 않는다.

일정과 endpoint는 `vercel.json`이 정본이며 모두 UTC다. 목록 조회는 HTTP 요청을 보내지 않는다.

```bash
node scripts/self-host-cron.mjs --list
```

단발 호출은 운영 쓰기가 생길 수 있다. `SELF_HOST_CRON_BASE_URL`과 `CRON_SECRET`을 보안 환경에서 주입한 상태에서 등록된 한 경로만 지정한다. 정확한 명령은 CLI의 사용법과 맞춰 검증한다. 로컬 smoke에서는 실행하지 않는다.

```bash
node scripts/self-host-cron.mjs --run /api/cron/rss
```

외부 scheduler는 목록의 각 UTC 일정에 대응하는 단발 명령을 실행한다. 같은 job이 겹치지 않게 실행 잠금을 설정하고 종료 코드와 실패 알림을 수집한다. 도구가 timeout으로 끝났다고 서버 작업까지 취소됐다고 가정하지 않는다. 재실행 전에 실행 로그와 실제 데이터 결과를 확인한다.

운영 전환에서는 기존 Vercel Cron을 중지한 다음 새 scheduler 하나만 활성화한다. 전환 직후 job별 마지막 실행 시각, 결과, 중복 여부를 확인한다. 이 앱 Compose는 반복 scheduler를 자동으로 시작하지 않는다.

홈 Production의 `production-cron.mjs`는 이 목록에서 일일 UTC systemd timer를 생성하고, 그 밖의 일정 문법은 설치 전에 거절한다. `ssartnership-production-cron@.service`는 고정 loopback 앱으로만 요청하며 비밀은 root 전용 파일에서 읽는다. 먼저 검증된 버전의 스크립트·공용 Cron 모듈·vercel.json을 `/opt/ssartnership/production-cron/` 아래에 설치하고 `current` 링크와 11개 timer를 준비하되 활성화하지 않는다. 기존 Cron 비활성화·최종 동기화·공개 전환 검증 뒤에만 root 전용 `cron-owner` 파일에 `home-production`을 기록하고 timer를 활성화한다. 파일이 없거나 값이 다르면 실행하지 않는다. timer는 `Persistent=false`라서 중지 중의 과거 작업을 한꺼번에 실행하지 않는다. 단발 호출은 전용 잠금으로 직렬화하고 HTTP timeout 뒤 자동 재시도하지 않는다. 누락/실패는 systemd 결과와 앱의 작업 이력을 확인한 뒤 판단한다.

## 운영·복구 검증

공개 노출 전 TLS reverse proxy, 정상 Host/protocol 전달, 업로드 크기와 요청 제한, HTTPS redirect, cookie와 인증 흐름을 확인한다. 임의 forwarded IP를 신뢰하도록 앱 코드를 완화하지 않는다. 이미지 digest, 원본 SHA, 빌드 공개 설정, 적용 시각을 함께 기록하고 이전 이미지를 보존한다.

단일 앱 인스턴스의 롤백은 이전 digest로 재기동하고 liveness·공개 흐름을 확인하는 방식이다. 데이터 변경 후 롤백은 별도의 DB/Storage 복구 판단이 필요하다. 운영 DB·Storage는 외부 암호화 백업과 깨끗한 환경에서의 복원 시간을 확인해야 한다. 서버 디스크의 백업 파일 존재만으로 재해 복구 완료를 판단하지 않는다.

집중 검증은 다음과 같다. broad runtime 변경이므로 실제 작업 브랜치에서 `npm run verify:release`도 실행한다.

```bash
node --test tests/self-host-runtime.test.mts tests/self-host-cron.test.mts
npm run check:docs
```

설계 근거: [Next.js 환경 변수와 self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Compose 파일 병합](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/).
