---
title: SSARTNERSHIP Repository Knowledge Map
type: index
status: current
authority: normative
last_verified: 2026-08-29
---

# SSARTNERSHIP Repository Knowledge Map

이 문서는 사람과 Agent가 프로젝트 지식을 찾는 첫 진입점이다. `AGENTS.md`는 작업 규칙과 이 지도로 가는 링크만 제공하고, 상세한 제품·기술·운영 지식은 `docs/`에서 관리한다.

## Source of Truth

| 질문 | 먼저 읽을 곳 | 최종 근거 |
| --- | --- | --- |
| 무엇을 왜 제공하는가 | [제품 지식](./product/index.md), [요구사항](./requirements/index.md), [기능 명세](./specs/index.md) | 승인된 제품 문서와 관련 Issue |
| 시스템은 어떻게 구성되는가 | [아키텍처](./architecture/index.md), [의사결정](./decisions/index.md) | 아키텍처 문서와 ADR |
| 실제로 지금 무엇이 구현되어 있는가 | 관련 architecture 문서 | `src/**`, `supabase/schema.sql`, migrations, tests |
| 지금 무엇을 진행하고 있는가 | [실행 계획](./plans/index.md) | active plan, GitHub Issue/PR, Git, CI |
| 어떻게 개발·배포·복구하는가 | [운영 문서](./operations/index.md) | runbook과 저장소 실행 스크립트 |
| 품질 기준과 검증 결과는 무엇인가 | [보안](./security/index.md), [성능](./performance/index.md), [테스트](./testing/index.md), [디자인 시스템](./design-system/index.md) | 기준 문서, 테스트, 시점 감사 |
| 과거에 무엇이 대체되었는가 | [역사 기록](./history/index.md), completed plan | immutable evidence와 Git history |

문서가 구현 상태를 설명하는 경우 코드·스키마·테스트가 현재 사실의 최종 근거다. 문서가 제품 의도, 운영 정책, 보안 불변조건 또는 승인된 의사결정을 정의하는 경우 해당 normative 문서를 변경 없이 우회하지 않는다.

## 지식 영역

- [제품](./product/index.md): 사용자, 정보 구조, 사용자 흐름, 화면 계약, 용어와 가이드
- [요구사항](./requirements/index.md): 비기능, 호환성, 오류 복구 같은 교차 기능 계약
- [기능 명세](./specs/index.md): 경계가 분명한 기능의 `spec.md`, `plan.md`, `tasks.md`
- [아키텍처](./architecture/index.md): 시스템, 데이터, API, 로깅 경계
- [의사결정](./decisions/index.md): 선택 이유, 대안, 결과를 보존하는 ADR
- [실행 계획](./plans/index.md): active, completed, tech debt
- [운영](./operations/index.md): 문서 lifecycle, runbook, 운영 감사
- [성능](./performance/index.md), [보안](./security/index.md), [테스트](./testing/index.md), [디자인 시스템](./design-system/index.md)
- [보안 취약점 신고 정책](./SECURITY.md)
- [역사 기록](./history/index.md)

## 문서 작성과 갱신

문서 type, status, authority, 이동·완료·대체 규칙은 [문서 수명주기](./operations/documentation-lifecycle.md)를 따른다. 새 문서를 만들기 전에 기존 source of truth를 확인하고, 한 사실을 여러 현재 문서에서 중복 유지하지 않는다.
