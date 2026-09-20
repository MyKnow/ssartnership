---
title: 문서 이관 장부
type: report
status: active
authority: descriptive
---

# 문서 이관 장부

기준선은 [계획](./plan.md)의 SHA다. 파일 목록 전체와 실제 변경 절의 처리를 구분한다. 유지 문서의 내용이 모두 재검증됐다는 뜻은 아니다.

## 변경한 내용

| 원본/절 | 처리·목적지 | 근거·충돌 |
| --- | --- | --- |
| product/overview: 목적·사용자 | 개요에 유지 | 기존 제품 계약 |
| product/overview: 기술 버전·실행·운영 잔존 상태 | 원문 history 보존, 시스템/운영 정본 연결 | 오래된 수치를 현행으로 승격하지 않음 |
| product/user-flows: 모든 흐름 | 사용자 과업·복구 중심으로 정리 | 내부 API/테이블·옛 수치는 history 원문 보존 |
| overview의 mock fallback | architecture의 실제 unavailable 규칙으로 교정 | runtime-data-access 구현·테스트 |
| user-flows의 인증 코드 10분 | 원문 보존, 현행 수치 중복 서술 제거 | 현재 화면 5분과 충돌; 수명 결정은 인증 구현 정본 |
| README ci:local | bootstrap + verify:change로 교정 | package scripts |
| superseded_by 설명 | 현재 문서 기준 상대 경로로 명확화 | 검사기의 기존 동작 유지 |
| self-host-ci-maintenance의 고정 개수 | 검토한 최소 개수와 전체 inventory 일치 검사를 구분, controller 교체 절차 연결 | Issue #474의 76개 목록 및 새 회귀 검사 |
| screen-specs | 마커/ID/내용 유지, 공통 추적 규칙 추가 | 평면 수집기 호환 |

## 기준선 전수 목록

| 문서 | 처분 |
| --- | --- |
| `docs/SECURITY.md` | 기존 정본/시점 기록 유지 |
| `docs/architecture/api-and-integrations.md` | 기존 정본/시점 기록 유지 |
| `docs/architecture/data-model.md` | 기존 정본/시점 기록 유지 |
| `docs/architecture/event-logging.md` | 기존 정본/시점 기록 유지 |
| `docs/architecture/index.md` | 기존 정본/시점 기록 유지 |
| `docs/architecture/system-overview.md` | 기존 정본/시점 기록 유지 |
| `docs/decisions/ADR-0001-direct-mattermost-integration.md` | 기존 정본/시점 기록 유지 |
| `docs/decisions/index.md` | 기존 정본/시점 기록 유지 |
| `docs/design-system/components.md` | 기존 정본/시점 기록 유지 |
| `docs/design-system/elements.md` | 기존 정본/시점 기록 유지 |
| `docs/design-system/foundations.md` | 기존 정본/시점 기록 유지 |
| `docs/design-system/index.md` | 기존 정본/시점 기록 유지 |
| `docs/design-system/layout-and-motion.md` | 기존 정본/시점 기록 유지 |
| `docs/design-system/ui-ux-baseline.md` | 기존 정본/시점 기록 유지 |
| `docs/history/architecture/ssafy-verify-external-api-delegation.md` | 기존 정본/시점 기록 유지 |
| `docs/history/index.md` | 책임 분리·참조 보강 (위 표 및 diff) |
| `docs/history/operations/2026-07-14-dev-main-promotion-checklist.md` | 기존 정본/시점 기록 유지 |
| `docs/history/product/todo-2026-08-13.md` | 기존 정본/시점 기록 유지 |
| `docs/index.md` | 기존 정본/시점 기록 유지 |
| `docs/operations/audits/2026-06-24-maintenance.md` | 기존 정본/시점 기록 유지 |
| `docs/operations/audits/2026-06-24-project-completeness.md` | 기존 정본/시점 기록 유지 |
| `docs/operations/documentation-lifecycle.md` | 책임 분리·참조 보강 (위 표 및 diff) |
| `docs/operations/index.md` | 책임 분리·참조 보강 (위 표 및 diff) |
| `docs/operations/runbooks/cross-platform-development.md` | 기존 정본/시점 기록 유지 |
| `docs/operations/runbooks/self-host-ci-maintenance.md` | 검사 수·controller 호환 절차 보강 |
| `docs/operations/runbooks/self-host-database.md` | 기존 정본/시점 기록 유지 |
| `docs/operations/runbooks/self-host-environments.md` | 기존 정본/시점 기록 유지 |
| `docs/operations/runbooks/self-host-observability.md` | 기존 정본/시점 기록 유지 |
| `docs/operations/runbooks/self-host-operations.md` | 기존 정본/시점 기록 유지 |
| `docs/operations/runbooks/self-hosting.md` | 기존 정본/시점 기록 유지 |
| `docs/operations/runbooks/storybook-visual-workflow.md` | 기존 정본/시점 기록 유지 |
| `docs/operations/runbooks/vercel-account-routing.md` | 기존 정본/시점 기록 유지 |
| `docs/performance/audits/2026-04-10-project-wide.md` | 기존 정본/시점 기록 유지 |
| `docs/performance/audits/2026-07-21-schema-api-async-ci.md` | 기존 정본/시점 기록 유지 |
| `docs/performance/audits/2026-07-29-issue-181-final.md` | 기존 정본/시점 기록 유지 |
| `docs/performance/baselines/2026-04-03-speed-insights.md` | 기존 정본/시점 기록 유지 |
| `docs/performance/baselines/admin-console.md` | 기존 정본/시점 기록 유지 |
| `docs/performance/index.md` | 기존 정본/시점 기록 유지 |
| `docs/performance/measurements/speed-insights.md` | 기존 정본/시점 기록 유지 |
| `docs/performance/reports/db-query-optimization.md` | 기존 정본/시점 기록 유지 |
| `docs/plans/active/ssafy-verify-legacy-removal.md` | 기존 정본/시점 기록 유지 |
| `docs/plans/completed/15-form-validation-benefit-visibility.md` | 기존 정본/시점 기록 유지 |
| `docs/plans/completed/2026-04-server-error-ux-recovery.md` | 기존 정본/시점 기록 유지 |
| `docs/plans/completed/205-admin-console-refactor.md` | 기존 정본/시점 기록 유지 |
| `docs/plans/completed/310-main-dev-reconciliation.md` | 기존 정본/시점 기록 유지 |
| `docs/plans/completed/admin-dashboard-refactor-summary.md` | 기존 정본/시점 기록 유지 |
| `docs/plans/completed/db-schema-service-refactor.md` | 기존 정본/시점 기록 유지 |
| `docs/plans/completed/global-optimization-program.md` | 기존 정본/시점 기록 유지 |
| `docs/plans/completed/partner-portal-activity-logs.md` | 기존 정본/시점 기록 유지 |
| `docs/plans/completed/partner-portal-dashboard-refactor.md` | 기존 정본/시점 기록 유지 |
| `docs/plans/completed/refactor-batches.md` | 기존 정본/시점 기록 유지 |
| `docs/plans/index.md` | 기존 정본/시점 기록 유지 |
| `docs/plans/tech-debt.md` | 기존 정본/시점 기록 유지 |
| `docs/product/feature-inventory.md` | 기존 정본/시점 기록 유지 |
| `docs/product/feature-scoring.md` | 기존 정본/시점 기록 유지 |
| `docs/product/glossary.md` | 기존 정본/시점 기록 유지 |
| `docs/product/guides/cafe-ssafy-pin-demo-filming.md` | 기존 정본/시점 기록 유지 |
| `docs/product/guides/partner-coupon-operations.md` | 기존 정본/시점 기록 유지 |
| `docs/product/index.md` | 책임 분리·참조 보강 (위 표 및 diff) |
| `docs/product/information-architecture.md` | 기존 정본/시점 기록 유지 |
| `docs/product/overview.md` | 책임 분리·참조 보강 (위 표 및 diff) |
| `docs/product/screen-specs/admin.md` | 기존 정본/시점 기록 유지 |
| `docs/product/screen-specs/auth.md` | 기존 정본/시점 기록 유지 |
| `docs/product/screen-specs/graduate-verification.md` | 기존 정본/시점 기록 유지 |
| `docs/product/screen-specs/index.md` | 책임 분리·참조 보강 (위 표 및 diff) |
| `docs/product/screen-specs/partner.md` | 기존 정본/시점 기록 유지 |
| `docs/product/screen-specs/public-and-member.md` | 기존 정본/시점 기록 유지 |
| `docs/product/user-flows.md` | 책임 분리·참조 보강 (위 표 및 diff) |
| `docs/requirements/compatibility-and-migration.md` | 기존 정본/시점 기록 유지 |
| `docs/requirements/error-recovery.md` | 기존 정본/시점 기록 유지 |
| `docs/requirements/index.md` | 기존 정본/시점 기록 유지 |
| `docs/requirements/non-functional.md` | 기존 정본/시점 기록 유지 |
| `docs/security/admin-access-control.md` | 기존 정본/시점 기록 유지 |
| `docs/security/admin-login-hardening.md` | 기존 정본/시점 기록 유지 |
| `docs/security/audits/security_2026-04-24_01.md` | 기존 정본/시점 기록 유지 |
| `docs/security/audits/security_2026-05-13_01.md` | 기존 정본/시점 기록 유지 |
| `docs/security/index.md` | 책임 분리·참조 보강 (위 표 및 diff) |
| `docs/security/service-role-boundary.md` | 기존 정본/시점 기록 유지 |
| `docs/specs/205-admin-console/acceptance.md` | 기존 정본/시점 기록 유지 |
| `docs/specs/205-admin-console/spec.md` | 기존 정본/시점 기록 유지 |
| `docs/specs/301-apple-wallet-member-pass/plan.md` | 기존 정본/시점 기록 유지 |
| `docs/specs/301-apple-wallet-member-pass/spec.md` | 기존 정본/시점 기록 유지 |
| `docs/specs/301-apple-wallet-member-pass/tasks.md` | 기존 정본/시점 기록 유지 |
| `docs/specs/graduate-verification/plan-432.md` | 기존 정본/시점 기록 유지 |
| `docs/specs/graduate-verification/spec.md` | 기존 정본/시점 기록 유지 |
| `docs/specs/index.md` | 기존 정본/시점 기록 유지 |
| `docs/specs/self-host-database/plan.md` | 기존 정본/시점 기록 유지 |
| `docs/specs/self-host-database/spec.md` | 기존 정본/시점 기록 유지 |
| `docs/specs/self-host-database/tasks.md` | 기존 정본/시점 기록 유지 |
| `docs/specs/self-hosting/plan.md` | 기존 정본/시점 기록 유지 |
| `docs/specs/self-hosting/spec.md` | 기존 정본/시점 기록 유지 |
| `docs/specs/self-hosting/tasks.md` | 기존 정본/시점 기록 유지 |
| `docs/testing/index.md` | 책임 분리·참조 보강 (위 표 및 diff) |
| `docs/testing/storybook.md` | 기존 정본/시점 기록 유지 |
