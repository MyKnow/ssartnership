---
title: 자체 호스팅 기술 계획
type: implementation-plan
status: active
authority: normative
issue: https://github.com/MyKnow/ssartnership/issues/435
---

# 자체 호스팅 기술 계획

## 앱 배포 단위

`Dockerfile`은 trusted dependency 설치, production build, 비root standalone 실행을 분리한다. `SELF_HOST_BUILD=1`일 때만 Next.js standalone 출력을 활성화한다. `public`과 `.next/static`도 배포 산출물에 포함한다. 이미지를 만드는 머신과 운영 호스트의 아키텍처가 다르면 각 대상 플랫폼 이미지 빌드를 별도로 검증한다.

`compose.yaml`은 앱 이미지 실행 계약이고 `compose.local.yaml`은 Docker Desktop의 loopback mock smoke용 덮어쓰기다. 운영 설정은 환경별 공개 값을 넣어 빌드한 이미지와 별도의 서버 비밀값으로 구성한다. `NEXT_PUBLIC_*`는 이미지 빌드 시 고정되므로 URL 또는 데이터 공급자를 바꾸면 재빌드한다. `SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_URL`은 같은 공개 origin이며, 선택적인 `SUPABASE_INTERNAL_URL`만 동일 네트워크의 gateway 주소를 사용한다.

앱은 한 replica를 초기 기준으로 한다. 프로세스가 여러 개가 되면 캐시 무효화, Server Action key, 오래 열린 브라우저와의 배포 버전 호환을 추가 설계해야 한다. 재시작으로 잃어도 되는 이미지 최적화 캐시와 영속 DB/Storage volume을 혼동하지 않는다.

## 공개 경로와 데이터 경계

로컬 앱 포트는 loopback에만 연다. 운영에서는 TLS reverse proxy가 정상 Host와 protocol을 전달하고 입력 크기·요청 제한을 적용한다. 현재 앱의 비Vercel client IP 처리를 우회하여 외부에서 보낸 forwarded 헤더를 신뢰하지 않는다. 홈 서버 ingress 구성과 신뢰 경계 검증은 실제 호스트 접근 후 진행한다.

데이터 서비스 작업은 앱 이미지와 독립적으로 진행한다. 기존 Supabase API에 대한 강한 의존 때문에 SQL만 옮겨도 Storage, PostgREST, RPC, RLS 계약이 자동 대체되지 않는다. 최종 서비스 선택과 복원 시험 결과를 확인한 뒤 앱과 연결한다. managed Supabase를 유지하는 중간 실행은 전체 자체 호스팅 완료 조건을 충족하지 않는다.

서버 transport는 SDK가 생성한 공개 URL의 요청만 내부 gateway로 전달한다. SDK가 반환하는 signed/public URL과 공용 이미지 프록시의 공개 Storage 경로는 [데이터 통합 계획](../self-host-database/plan.md)에 따라 실제 파일로 검증한다. URL 환경 변수 두 개를 설정한 것만으로 이 검증을 완료 처리하지 않는다.

cloud 기능은 사용처와 운영 목적을 조사하여 자체 운영 대체를 구현한다. Backup/PITR는 스케줄·retention·복원 지점과 복원 검증을 포함하고, Preview branching은 운영과 분리된 데이터 환경의 생성·초기화·폐기 수명주기를 포함한다. 현재 확인된 운영 경로는 Supabase CLI의 DB URL 기반 migration, GitHub app의 Preview migration 상태 확인, `pg_dump`·sanitizer·Storage SDK 기반 Preview sync다. 직접적인 Supabase Management API 호출은 확인되지 않았으므로 플랫폼 API 전체를 복제하지 않고 필요한 DB/Storage 관리 명령으로 운영 목적을 충족한다. 업그레이드·migration·vacuum/용량/로그 관리도 실행 가능한 운영 단위로 남긴다. 실제 기능 목록과 검증 결과는 데이터·운영 작업에서 확정한다.

## Cron과 배포

`vercel.json`의 UTC 일정을 이식 도구가 읽는다. 도구는 등록된 endpoint에만 Bearer 인증 GET을 보내고 redirect, timeout, non-2xx 응답을 실패로 처리한다. 반복 스케줄러 자체는 로컬 smoke에서 시작하지 않는다. 운영 전환 시 Vercel Cron 비활성화와 새 scheduler 활성화를 한 절차로 수행하며 중복 실행 여부를 로그로 검증한다.

CI의 산출물은 source SHA와 연결된 OCI image다. 운영 CD는 이미지를 pull하고 liveness 확인 후 결과를 기록한다. 앱 롤백은 이전 digest 재적용으로 수행한다. 새 DB에 쓰기가 생겼다면 앱 이미지/DNS만 되돌리는 방식은 데이터 롤백이 아니며 별도 복구 절차가 필요하다.

## 검증 순서

1. 환경·Cron 실패 경계 Node 테스트와 문서 검증.
2. 실제 작업 브랜치에서 `npm run verify:release` 및 standalone 이미지 빌드.
3. Docker Desktop Compose 기동·liveness·공개 응답·정적 자산·비root·재시작 smoke.
4. 자체 호스팅 데이터 복원과 API/Storage 호환성 검증.
5. 서버 접근 후 ingress, 외부 암호화 백업/깨끗한 호스트 복원, 실제 연동, 자원 동시 부하와 전환 리허설.

현재 증거는 [tasks.md](./tasks.md), 재실행 명령은 [runbook](../../operations/runbooks/self-hosting.md)에 기록한다. 참고: [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Compose 파일 병합](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/).
