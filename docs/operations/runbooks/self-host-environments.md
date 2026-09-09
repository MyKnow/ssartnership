---
title: 자체 호스팅 Production Preview 격리와 데이터 복사
type: runbook
status: current
authority: normative
---

# Production/Preview 격리와 데이터 복사

상위 계약은 [데이터 자체 호스팅 명세](../../specs/self-host-database/spec.md)다. 현재 명령은 **로컬/비공개 환경 초기화와 새 Preview 후보 준비 단계**다. 실제 운영 트래픽 전환이나 기존 Preview의 자동 교체를 수행하지 않는다. Production 역할로 만든 합성 환경을 실제 Production 마이그레이션 완료로 부르지 않는다.

## 환경 초기화와 실행

기존 디렉터리/프로젝트/볼륨은 재초기화하지 않는다. operator가 소유하는 0700 상위 디렉터리 아래에서 실행한다. 설정 파일은 0600이며 앱·DB·백업 자격증명을 출력하거나 Git/build context에 넣지 않는다.

```sh
install -d -m 0700 .tmp/environments
node scripts/self-host-environments/cli.mjs init .tmp/environments/pair
node scripts/self-host-environments/cli.mjs up-data .tmp/environments/pair production
node scripts/self-host-environments/cli.mjs up-data .tmp/environments/pair preview
node scripts/self-host-environments/cli.mjs status .tmp/environments/pair
```

기본 포트는 Production 역할 앱 3210/API 58110, Preview 앱 3220/API 58120이다. 다른 포트나 프로젝트 prefix는 `init`의 선택적 private JSON 입력으로 지정한다. 앱 origin은 Production `http://127.0.0.1:3210`, Preview `http://localhost:3220`이며 포트만 바꿔 쿠키를 격리했다고 주장하지 않는다. 실제 ingress는 별도 hostname/TLS/접근 제어가 필요하다.

`up-data`는 기존 pgBackRest DB 이미지와 고정 Node helper 이미지를 미리 준비한 환경에서 `--no-build`로 실행한다. 각 앱은 해당 profile의 공개 build 설정으로 빌드하고 `up-app <pair-directory> <production|preview> <sha256:image-id>`로 실행한다. 이미지 내부 runtime/build 계약 검사를 우회하지 않는다. Preview 앱·gateway·DB는 internal network만 사용하며 외부 메일·푸시·Mattermost 직접 통신을 차단한다. 비밀 없는 `preview-ingress`만 외부 bridge에 연결하고 고정된 app/gateway로 들어오는 요청을 전달한다. Docker Compose의 `!override`/`!reset` 지원이 필요하다. 임의 upstream·CONNECT·WebSocket proxy를 제공하지 않는다. 테스트 수신처를 허용하는 egress proxy는 아직 없으며 환경 변수의 outbound 표시는 방화벽 대신 사용하지 않는다.

기본 Preview 자원 상한은 앱 512MiB, DB 768MiB, REST 128MiB, Storage 384MiB, gateway 256MiB 및 서비스별 CPU 0.5다. 상한은 동시 운영 성능 보장이 아니다. 관측 서비스 공유 여부, 8GB 호스트의 전체 메모리/디스크 예산과 실제 부하는 별도로 검증한다.

## 명령형 사본 준비

`prepare-copy`는 최신 **성공한 기존 짝 백업**을 사용한다. 최신 운영 시점이 필요하면 [백업 runbook](./self-host-ci-maintenance.md)에 따라 먼저 새 백업을 만든다. 백업 생성은 write-quiesce 창이 필요한 별도 작업이며 복사 명령 자체는 live Production을 중지하거나 변경하지 않는다. 원본은 항상 pair의 production이며 target 인수는 받지 않는다.

```sh
docker pull node:24.18.1-bookworm-slim@sha256:235600a8101ab264e117b1768e925532262668dc9b581ef1dd7d96ced463b8e7
node scripts/self-host-environments/cli.mjs prepare-copy .tmp/environments/pair
```

사전 조건: 두 환경의 DB identity 검증, source backup keys 및 paired manifest, 고정 helper 이미지, 작업 디렉터리 기준 최소 15GiB 여유. 실제 데이터 크기에 따른 추가 공간 산정은 운영 전 필수다. 서버에서는 CI·백업·복구와 같은 heavy-job 잠금을 공유하는 wrapper로 실행해야 한다. 현재 CLI의 pair lock과 source operations lock만으로 다른 독립 호스트 작업까지 직렬화된다고 가정하지 않는다.

사본 준비 순서:

1. 읽기 전용 백업 저장소에서 네트워크 없는 새 볼륨으로 PITR/Storage 복원과 기존 marker 검증.
2. 원본 ledger가 검토된 dev prefix인지 확인. 원본 migration 199개를 넘으면 copy-policy 검토 전 거부. 원본 catalog와 해당 migration을 재생한 새 DB catalog도 비교.
3. 격리 복원본에서 회원 비밀번호·avatar_base64 제거, 필수 password column 난수 교체, 이메일 마스킹, 인증/발송/Wallet 자격증명·로그 테이블 비우기. 원본 DB 계정·세션·backup key는 새 DB로 dump하지 않음.
4. 새로운 Preview DB에 public 데이터와 허용 Storage metadata를 transaction으로 로드하고 FK 검증. dev 후속 마이그레이션 적용.
5. 공개 bucket과 private `member-profile-images`만 복사. 사진은 익명화되지 않으므로 이 사본도 개인정보로 보호. 다른 private bucket은 정책상 제외하며 완전한 모든 파일 복제라고 부르지 않음.
6. ledger가 참조하는 file-backend 객체를 새 Storage 볼륨에 복사하고 각 SHA256 확인. 파일의 확장 속성도 보존한다. 파일 내용만 같아도 Storage HTTP metadata가 없으면 API 조회가 실패하므로 바이트 비교만으로 성공 처리하지 않는다. symlink·경로 이탈·중복 파일은 거부.
7. 후보 DB/API/Storage 실행 후 모든 복사 객체를 인증된 Storage API로 다시 읽고 SHA256을 대조한다. 원본/기존 Preview identity 재확인 후 receipt에 backup ID·시점·파일 개수와 `activated:false` 기록.

후보는 Preview 기본 포트보다 100 높은 임시 포트와 새 프로젝트/키/볼륨을 사용한다. 충돌하면 실패하며 다른 서비스를 중지하지 않는다. 실패해도 기존 Preview는 그대로다. 실패 후보/격리 복원 볼륨은 조사 대상으로 남기며 명시적인 정확한 대상 정리 외에 자동 prune을 하지 않는다. 복원 컨테이너는 제거하지만 데이터 볼륨에는 민감한 원본 복원본이 있을 수 있다. 따라서 실데이터 실행은 암호화된 승인 호스트에서만 허용한다. FileVault가 꺼진 Mac에서는 합성 데이터 실습만 한다.

새 사본의 운영 비밀번호는 사용할 수 없다. `seed-preview-member <pair-directory> <private-credential.json>` 명령에 `memberId`, `password`만 가진 0600 JSON을 전달하면 정확한 Preview 회원 한 명의 테스트 비밀번호를 설정한다. Production role 인수를 받지 않으며 원본 비밀번호를 되살리지 않는다. 자격증명 파일·값을 채팅/로그/명령 인수로 노출하지 않는다.

## 아직 완료가 아닌 경계

- 후보 앱 빌드/인증·권한 QA와 고정 Preview ingress의 원자적 교체·실패 복귀.
- 홈 서버의 두 환경 상시 운영, 외부 hostname/TLS, 실제 source 데이터 이전.
- 테스트 SMTP/푸시 sink를 허용하는 제한된 외부 연동 경로.
- 모든 추가/변경 column과 민감 파일의 정책 검토 및 실제 데이터량의 복원 시간·여유 공간 산정.
- GitHub Actions/GHCR 자동 이미지 게시와 보호된 dev 배포 연결.

애플리케이션 이미지 레이어는 공유할 수 있지만 실행 컨테이너·DB/파일 볼륨은 공유하지 않는다. DB 이미지를 되돌리는 것으로 schema나 데이터를 rollback하지 않는다.
