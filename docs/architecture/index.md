# Architecture Documentation Index

작성 기준일: 2026-07-09

이 디렉터리는 성능 개선, UI/UX 리팩토링, 기술 스택 마이그레이션 전에 현재 SSARTNERSHIP 사이트의 정보 구조와 구현 기준선을 보존하기 위한 문서 묶음이다. 코드보다 먼저 읽는 현행 시스템 명세로 사용한다.

## 읽는 순서

1. [00. 서비스 기획 문서화 순서](./00-planning-process.md)
2. [01. 현행 서비스 개요](./01-current-service-overview.md)
3. [02. 정보 구조와 라우트 맵](./02-information-architecture.md)
4. [03. 사용자 흐름](./03-user-flows.md)
5. [04. 기능 인벤토리](./04-feature-inventory.md)
6. [05. 시스템 아키텍처](./05-system-architecture.md)
7. [06. 데이터 모델](./06-data-model.md)
8. [07. API와 외부 연동](./07-api-and-integrations.md)
9. [08. UI/UX 기준선](./08-ui-ux-baseline.md)
10. [09. 비기능 기준선](./09-non-functional-baseline.md)
11. [10. 리팩토링/마이그레이션 준비도](./10-refactor-migration-readiness.md)

## 기존 관련 문서

- [이벤트 로깅 기준](./event-logging.md)
- [SSAFY Verify 외부 API 위임](./ssafy-verify-external-api-delegation.md)
- [수료생 증명서·프로필 사진 인증 v1](./graduate-verification-v1.md)
- [디자인 시스템](../design-system/README.md)
- [성능 문서](../performance/README.md)
- [보안 문서](../security/security_2026-05-13_01.md)
- [Storybook/테스트 문서](../testing/storybook.md)
- [화면 계약과 제품 용어](../product/screen-specs/index.md)

## 소스 우선순위

문서와 코드가 다를 때는 아래 순서로 사실 여부를 판단한다.

1. `src/app/**`: 실제 라우트, 레이아웃, route handler, server action
2. `src/lib/**`: 도메인 규칙, 인증, repository, adapter, validation
3. `supabase/schema.sql`와 `supabase/migrations/**`: 데이터 모델과 RLS 기준
4. `tests/**`: 보존해야 하는 동작과 리다이렉트 기대값
5. `package.json`, `.env.example`, `.github/workflows/**`: 실행, 배포, 운영 기준
6. `docs/**`: 의도와 운영 정책

## 업데이트 원칙

- 기능, DB, 라우트, 인증/권한, 운영 플로우가 바뀌면 이 디렉터리의 관련 문서를 함께 갱신한다.
- 단순 README성 소개가 아니라 마이그레이션 담당자가 현행 동작을 복원할 수 있는 수준의 기준선을 남긴다.
- 제품 정책 변경과 구현상 제약은 분리해서 쓴다. 정책은 `01`, `03`, `04`에, 구현 제약은 `05` 이후에 둔다.
