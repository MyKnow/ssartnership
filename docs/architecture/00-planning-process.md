# 00. 서비스 기획 문서화 순서

작성 기준일: 2026-07-09

## 통상적인 서비스 기획 순서

서비스를 새로 만들거나 큰 리팩토링/마이그레이션을 준비할 때는 보통 아래 순서로 문서를 만든다.

1. 문제 정의와 목적
   - 해결하려는 문제, 고객/사용자, 성공 기준, 제약을 먼저 정한다.
   - 산출물: 서비스 개요, 비전, KPI 초안, 제약 조건.

2. 사용자와 이해관계자 정의
   - 실제 사용자군, 운영자, 제휴사, 외부 시스템, 의사결정자를 나눈다.
   - 산출물: persona, stakeholder map, 권한/책임 구분.

3. 요구사항 정리
   - 기능 요구사항과 비기능 요구사항을 분리한다.
   - 산출물: 기능 목록, 우선순위, 보안/성능/운영/SEO/접근성 요구사항.

4. 정보 구조 설계
   - 사용자가 어떤 경로로 어떤 정보를 만나는지 정의한다.
   - 산출물: IA, route map, navigation map, sitemap, protected route map.

5. 핵심 사용자 흐름 설계
   - 가입, 로그인, 조회, 신청, 결제, 관리, 알림처럼 목표가 있는 흐름을 단계별로 적는다.
   - 산출물: user flow, state transition, 실패/복구 흐름.

6. 화면/기능 명세
   - 화면마다 표시 데이터, 입력, 액션, 권한, 빈 상태, 오류 상태를 정의한다.
   - 산출물: page spec, component responsibility, form validation spec.

7. 데이터 모델과 API 설계
   - 저장할 데이터, 관계, 상태값, API 입출력, 외부 연동을 정의한다.
   - 산출물: ERD, table inventory, API contract, external integration contract.

8. 시스템 아키텍처 설계
   - 프론트엔드, 서버, DB, 외부 서비스, 캐시, 인증 경계를 연결한다.
   - 산출물: architecture diagram, layer boundary, repository/service policy, security boundary.

9. 비기능 요구사항과 운영 기준
   - 성능, 보안, 개인정보, 접근성, SEO, 로깅, 모니터링, 배포, 백업을 정한다.
   - 산출물: NFR baseline, runbook, threat model, performance budget.

10. 검증 계획과 출시 계획
    - 어떤 테스트와 QA를 통과해야 출시 가능한지 정한다.
    - 산출물: test strategy, acceptance criteria, rollout plan, rollback plan.

11. 개선 백로그와 의사결정 기록
    - 지금 하지 않을 일, 위험, 기술 부채, 다음 wave를 남긴다.
    - 산출물: refactor backlog, migration readiness, ADR.

## 이 프로젝트에 적용한 문서 체계

SSARTNERSHIP는 이미 운영 중인 Next.js/Supabase/Vercel 서비스다. 따라서 새 서비스 기획서가 아니라 "현행 구현 기준선"을 먼저 문서화한다.

| 일반 기획 산출물 | 이 디렉터리의 문서 |
| --- | --- |
| 문제 정의, 목적, 사용자 | `01-current-service-overview.md` |
| 정보 구조, 라우트, 보호 경로 | `02-information-architecture.md` |
| 핵심 사용자 흐름 | `03-user-flows.md` |
| 화면 계약 | `docs/product/screen-specs/` |
| 기능 명세 | `04-feature-inventory.md` |
| 시스템 계층과 구현 경계 | `05-system-architecture.md` |
| 데이터 모델 | `06-data-model.md` |
| API와 외부 연동 | `07-api-and-integrations.md` |
| UI/UX 기준 | `08-ui-ux-baseline.md` |
| 성능/보안/SEO/운영/테스트 | `09-non-functional-baseline.md` |
| 리팩토링/마이그레이션 보존 기준 | `10-refactor-migration-readiness.md` |

## 문서 작성 원칙

- 현재 구현을 기준으로 쓴다. 희망 사항은 `10-refactor-migration-readiness.md`의 백로그나 위험으로 분리한다.
- 기능 이름은 사용자 언어와 코드 도메인 언어를 함께 남긴다.
- route, table, env, script, test 이름은 실제 식별자를 사용한다.
- 인증/권한/개인정보/결제/운영 알림은 별도 신뢰 경계로 기록한다.
- mock/Supabase 전환 지점은 마이그레이션 비용을 좌우하므로 빠짐없이 남긴다.
- 모호한 항목은 짐작으로 쓰지 않고, 근거 파일을 확인한 뒤 현재 구현 상태로 확정해 적는다.
