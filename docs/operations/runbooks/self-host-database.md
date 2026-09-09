---
title: 자체 호스팅 DB Storage Preview 운영
type: runbook
status: current
authority: normative
---

# 자체 호스팅 DB·Storage·Preview

[데이터 계약](../../specs/self-host-database/spec.md)의 로컬 선행 절차다. 원본 데이터 없이 새 환경을 만들며, 실제 홈 서버 전환 상태는 [작업 목록](../../specs/self-host-database/tasks.md)에서 확인한다. Node와 Docker Compose 버전은 프로젝트 개발환경 계약을 따른다.

## 환경 생성과 검증

프로젝트 이름은 `ssartnership-`으로 시작하는 명시적인 환경 이름을 사용한다. 비밀 파일은 Git이 무시하는 경로에 환경별로 만들고 출력·공유하지 않는다. 아래 파일은 운영 provider의 환경 파일을 복사하여 만들지 않는다.

```bash
npm run self-host:database -- init --env-file .tmp/self-host/data.env --project ssartnership-local --port 58000
npm run self-host:database -- up --env-file .tmp/self-host/data.env
npm run self-host:database -- migrate --env-file .tmp/self-host/data.env
npm run self-host:database -- status --env-file .tmp/self-host/data.env
npm run self-host:database -- smoke --env-file .tmp/self-host/data.env
```

`up`의 성공, migration 적용 수, smoke의 대표 RPC·권한·파일 결과를 각각 기록한다. `migrate`를 다시 실행했을 때 기존 파일의 checksum을 확인하고 중복 적용하지 않아야 한다. 실패한 파일을 건너뛰거나 과거 migration을 수정하지 않는다. 컨테이너 재시작 후 같은 데이터·파일이 남아 있는지도 확인한다.

이 `up`은 백업 overlay를 아직 도입하지 않은 초기 환경 전용이다. 백업을 활성화한 뒤에는 [운영 overlay의 canonical 시작 명령](./self-host-operations.md)을 사용하여 기본 DB 이미지로 재생성하거나 WAL 설정을 제거하지 않는다.

마이그레이션을 적용하는 주체는 이 CLI 하나로 고정한다. 별도 `supabase db push`나 수동 SQL 적용과 custom ledger를 함께 쓰지 않는다. 기존 migration ledger가 있는 DB를 반입할 때에는 적용 이력과 파일 checksum을 검증한 후 명시적으로 이관해야 하며, 빈 환경용 초기화 명령으로 운영 DB 이력을 추측하지 않는다.

앱에는 별도 runtime 파일을 만든다. DB 환경 파일 전체를 앱에 전달하면 PostgreSQL 관리자 비밀까지 노출되므로 금지한다.

```bash
node -- deploy/self-host/write-local-runtime-env.mjs --data-env-file .tmp/self-host/data.env --output .tmp/self-host/app.env
```

이 생성기는 앱에 필요한 Supabase key와 공개/내부 URL만 선택하고 앱 session/HMAC 비밀을 새로 만든다. Mattermost는 로컬 검증용 `.test` 주소이며 실제 연동이 설정된 것이 아니다. 실제 이미지 빌드는 [앱 빌드 절차](./self-hosting.md)를 따른다. 공개 build 값은 앱 runtime 파일의 `NEXT_PUBLIC_*`와 같아야 하며 비밀은 build 인자로 넘기지 않는다. `compose.yaml`과 `compose.supabase.yaml`을 같은 프로젝트로 병합하고 `SELF_HOST_RUNTIME_ENV_FILE=.tmp/self-host/app.env`를 명시한다. 이미지의 public URL과 runtime URL이 다르면 재빌드한다.

서버 SDK는 `SUPABASE_URL`을 공개 origin으로 사용한다. `SUPABASE_INTERNAL_URL=http://gateway:8000`은 서버 전송에만 쓰인다. 파일을 브라우저에서 열 수 있는지, `/api/image`로 공개 파일을 읽을 수 있는지, 비공개 파일이 서명 없이 거절되는지 확인한다. 일반 외부 이미지의 SSRF 차단과 크기/MIME 제한은 계속 적용한다.

## Preview와 임시 환경

현재 클라우드에는 별도 운영 프로젝트와 지속형 Preview 프로젝트가 있다. 두 환경의 분리를 그대로 유지하는 것이 우선이며, 임시 테스트 환경은 필요할 때 별도 Compose 프로젝트로 생성한다.

```bash
npm run self-host:database -- init --env-file .tmp/self-host/preview.env --project ssartnership-preview --port 58001
npm run self-host:database -- up --env-file .tmp/self-host/preview.env
npm run self-host:database -- migrate --env-file .tmp/self-host/preview.env
npm run self-host:database -- down --env-file .tmp/self-host/preview.env
```

독립 포트·난수 비밀·named volume을 사용하므로 종료 후에도 해당 환경의 데이터가 남는다. 기본 명령은 볼륨을 삭제하지 않는다. 불필요한 테스트 볼륨 정리는 정확한 환경과 복구 필요성을 확인한 별도 작업이다. 운영 자료 복제가 필요하면 기존 `sync:preview` sanitizer의 회원 비밀번호 hash/salt 제거 계약과 Storage 개인정보 범위를 적용한다. 현재 CLI는 운영 데이터를 자동 복사하지 않는다.

## 관리와 전환

환경 생성·마이그레이션·상태·백업은 신뢰된 로컬 사용자 또는 SSH 운영자가 실행한다. 공개 Management API나 Docker 소켓을 제공하지 않는다. CI는 운영 비밀 없이 이미지를 만들고, 배포 운영자는 검증한 digest와 해당 환경 비밀을 적용한다. 서버 runner·registry·배포 이벤트 연결은 실제 서버 접근 후 검증한다.

홈 서버 ingress 전환 전에는 신뢰 proxy와 client IP 전달 계약을 반드시 구현·검증한다. 현재 `src/lib/client-ip.ts`는 Vercel 밖에서 IP를 알 수 없으므로 일부 제한이 공통 `unknown` 대상으로 묶인다. 임의 `X-Forwarded-For`를 믿거나 `VERCEL=1`로 위장하여 해결하지 않는다.

로컬 데이터 Compose의 기본 network는 `internal: true`다. DB·REST·Storage는 이 내부망만 사용하고, loopback 포트 연결이 필요한 앱·gateway에만 별도 `edge` network를 연결한다. `edge`는 외부 송신이 가능하므로 운영에서는 방화벽·egress 정책과 SMTP·Mattermost·push 목적지를 별도로 검증한다. 로컬 앱 파일의 `.test` 연동 값은 실제 발송 성공의 근거가 아니다.

업그레이드는 고정 이미지와 migration을 격리 환경에서 먼저 검증한 다음 [백업·복구 절차](./self-host-operations.md)의 복구 지점을 남기고 적용한다. schema 변경 후 앱 이미지 rollback의 호환성도 확인한다. 운영 데이터를 실제로 가져오는 작업과 DNS·Cron 전환은 로컬 smoke 완료 이후의 별도 전환 단계다.
