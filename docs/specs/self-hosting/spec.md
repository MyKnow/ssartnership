---
title: 자체 호스팅 마이그레이션 명세
type: feature-spec
status: active
authority: normative
issue: https://github.com/MyKnow/ssartnership/issues/435
---

# 자체 호스팅 마이그레이션

## 결과와 범위

장기 운영을 위해 Next.js 앱과 Supabase 의존 서비스를 사용자가 소유한 서버에서 운영할 수 있게 한다. 서버에 접속할 수 없는 동안 최신 `dev` 기반으로 로컬 Docker Desktop에서 배포 산출물과 데이터 서비스 이전 경로를 검증한다. 단기 MVP의 기존 공급자 선택보다 이 마이그레이션의 장기 운영 요구를 우선한다.

앱 선행 작업은 재현 가능한 standalone 이미지, Compose 실행, 비밀값과 공개 빌드 설정의 경계, liveness, Cron 호출 이식 도구와 운영 절차다. 데이터 작업은 자체 호스팅 Supabase 또는 호환 PostgreSQL 기반 서비스와 스키마·Storage 이전을 포함한다. 현재 사용 중이거나 운영에 필수인 관리형 backup/PITR, Preview branching, 플랫폼 Management API, 유지보수 기능의 자체 운영 대체도 필수 범위다. 앱 컨테이너만 성공했다고 전체 마이그레이션을 완료 처리하지 않는다.

Next.js와 기존 Repository/API 계약은 유지한다. 기존 Vercel 배포와 Cron은 실제 전환 전까지 현행 경로다. 프레임워크 재작성, 운영 데이터의 즉시 복제, 원격 배포, DNS 전환은 이 로컬 선행 작업의 완료 조건이 아니다.

## 불변조건

- 빌드 컨텍스트와 이미지에 서버 비밀값, 환경 파일, 인증서, DB dump를 넣지 않는다. 기존 trusted dependency install 정책을 동일하게 적용한다.
- production 실행은 누락된 필수 설정과 이미지/런타임 공개 설정 불일치를 안전하게 거절한다. mock은 명시적인 로컬 smoke에 한정한다.
- 내부 Supabase 주소와 브라우저 공개 주소를 분리한다. 내부 컨테이너 HTTP와 로컬 loopback HTTP를 지원하며 공개 운영 주소는 HTTPS를 사용한다.
- liveness 성공은 프로세스 응답의 증거다. DB·Storage 복원, 로그인, 외부 메시지 전달 성공을 뜻하지 않는다.
- Cron 일정은 `vercel.json`을 단일 원본으로 유지한다. 운영 쓰기를 수행하는 Cron은 전환 시 한 스케줄러만 활성화한다.
- CI는 이미지를 만들고 CD는 검증된 이미지 digest를 적용한다. 호스트 Docker 소켓이나 운영 DB 비밀을 앱·CI 컨테이너에 전달하지 않는다.

## 수용 기준

1. Node 24.18.1 trusted install과 standalone production 이미지 빌드가 Docker Desktop에서 성공한다.
2. 로컬 Compose 앱의 liveness, 공개 페이지 및 정적 자산을 확인하고 비root 사용자 실행과 재시작 후 응답을 확인한다.
3. 잘못된 실행 설정, 비밀 누락, 빌드 설정 불일치와 위험한 Cron 호출의 회귀 테스트가 통과한다.
4. 자체 호스팅 데이터 서비스에 스키마/RPC/RLS/Storage 호환성을 확인하고 외부 네트워크 없이 확인 가능한 증거를 별도로 기록한다.
5. 실제 cloud 기능 사용처를 조사하여 백업/PITR 복원, Preview 분리·초기화, Management API 대체와 유지보수를 실행 가능한 명령과 검증으로 제공한다.
6. 운영 복원·백업·성능·외부 연동과 원격 전환의 미검증 부분을 [작업 목록](./tasks.md)에 남긴다.

[기술 계획](./plan.md)과 [실행 절차](../../operations/runbooks/self-hosting.md)를 함께 따른다.

데이터 서비스와 관리형 기능의 대체 계약은 [자체 호스팅 데이터와 운영 복구](../self-host-database/spec.md)에 둔다.
