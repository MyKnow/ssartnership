---
title: Repository Knowledge 문서 수명주기
type: runbook
status: current
authority: normative
last_verified: 2026-08-29
---

# Repository Knowledge 문서 수명주기

`AGENTS.md`는 작업 규칙과 [Repository Knowledge Map](../index.md)으로 가는 짧은 지도다. 제품·기술·운영 지식의 본문은 `docs/`에 두고, 문서를 하나의 거대한 매뉴얼이나 `spec.md`로 합치지 않는다.

## Source of Truth

| 정보 | source of truth | 문서의 역할 |
| --- | --- | --- |
| 제품 의도·화면 계약·요구사항 | `docs/product`, `docs/requirements`, `docs/specs` | 승인된 WHAT/WHY와 수용 기준 |
| 기술 구조·결정 이유 | `docs/architecture`, `docs/decisions` | 경계와 선택 이유 |
| 현재 구현 사실 | `src`, schema, migrations, tests, package scripts | 실행 가능한 최종 근거 |
| 작업 상태 | active plan, GitHub Issue/PR, Git, CI | 재개 맥락과 실제 진행 증거 |
| 운영 절차 | `docs/operations/runbooks`, 저장소 스크립트 | 반복 가능한 절차 |
| 완료·감사·측정 결과 | completed plan, audit, history | 해당 시점의 변경 불가능한 증거 |

한 사실을 여러 current 문서에 복제하지 않는다. 다른 영역에서 필요하면 정본을 링크하고, 구현 상태를 서술할 때는 근거 경로를 함께 둔다.

## 분류와 경로

| 경로 | 용도 | 일반적인 type/status/authority |
| --- | --- | --- |
| `docs/product/` | 사용자 가치, 흐름, 화면 계약, 용어 | `product-contract/current/normative` |
| `docs/requirements/` | 교차 기능 요구사항 | `requirement/current/normative` |
| `docs/specs/<feature>/` | 경계가 분명한 기능의 spec/plan/tasks | `feature-spec`, `implementation-plan`, `task-list` |
| `docs/architecture/` | 현행 시스템·데이터·API 경계 | `architecture/current/descriptive` |
| `docs/decisions/` | 채택한 선택과 대안 | `decision/current/normative` |
| `docs/plans/active/` | 저장소만으로 재개 가능한 실행 계획 | `exec-plan/active/normative` |
| `docs/plans/completed/` | 완료된 실행 기록 | `exec-plan/completed/evidence` |
| `docs/plans/tech-debt.md` | 아직 승인되지 않은 후속 후보 | `tech-debt/active/descriptive` |
| `docs/operations/runbooks/` | 반복 운영·복구 절차 | `runbook/current/normative` |
| `**/audits/`, baselines, measurements | 시점 감사와 측정 | `audit`, `baseline`, `measurement` + `completed/evidence` |
| `docs/history/` | 대체되거나 만료된 원본 | `history/archived|superseded/evidence` |

`generated/`는 원본과 생성 명령이 있을 때만 만든다. 스키마를 사람이 복사한 문서는 generated 문서가 아니다. 외부 자료는 원본 링크를 우선하며, 장기 보존이 꼭 필요한 자료만 출처와 사용 조건을 명시해 `references/`에 둔다.

## Frontmatter 계약

모든 `docs/**/*.md`는 다음 scalar frontmatter를 가진다.

```yaml
---
title: 문서 제목
type: feature-spec
status: current
authority: normative
last_verified: 2026-08-29 # 실제로 재검증한 경우에만 선택적으로 기록
---
```

- `title`: 사람이 찾을 수 있는 고유한 제목
- `type`: 문서가 수행하는 한 가지 책임
- `status`: `current`, `active`, `completed`, `superseded`, `archived`
- `authority`: `normative`, `descriptive`, `evidence`
- `last_verified`: 코드·외부 상태와 다시 대조한 날짜. 이동이나 frontmatter 추가만으로 갱신하지 않는다.
- `superseded_by`: `status: superseded`일 때 필요한 대체 문서의 저장소 상대 경로
- `source_paths`: 생성 문서를 도입할 때 원본 목록. 현재 수동 관리 문서에는 사용하지 않는다.

허용 type은 `index`, `security-policy`, `product-contract`, `guide`, `requirement`, `feature-spec`, `implementation-plan`, `task-list`, `architecture`, `decision`, `exec-plan`, `tech-debt`, `runbook`, `design-system`, `test-guide`, `baseline`, `measurement`, `audit`, `report`, `history`다.

## Spec lifecycle

큰 기능은 아래 흐름으로 관리한다.

```text
Issue에서 문제·범위 승인
  -> specs/<feature>/spec.md (WHAT/WHY, 불변조건, 수용 기준)
  -> plan.md (기술 경계, 변경 surface, 검증·rollout)
  -> tasks.md (순서, 상태, 완료 증거)
  -> 구현·PR·CI
  -> 문서는 현행 계약으로 유지하거나 completed/history로 이동
```

기존 시스템 전체를 소급해 spec으로 만들지 않는다. 데이터 모델, 인증·보안, 다중 surface 또는 아키텍처를 바꾸는 계획 작업부터 적용한다. 작은 단일 수정은 Issue/PR과 회귀 테스트로 충분하다.

## 상태 전환

- active plan이 끝나면 완료 증거와 남은 위험을 기록하고 `plans/completed/`로 이동한다.
- 더 이상 유효하지 않지만 추적 가치가 있으면 `history/`로 이동한다. 대체 문서가 있으면 `status: superseded`와 `superseded_by`를 함께 쓴다.
- 단순히 오래됐다는 이유로 감사 문서를 current 정책으로 승격하지 않는다.
- 경로를 바꾸면 저장소 전체의 Markdown 링크, workflow path filter, test/skill/README 참조를 같은 변경에서 갱신한다.
- 문서 삭제는 내용이 다른 정본에 완전히 흡수되고 Git history만으로 충분할 때만 한다.

## 검증과 리뷰

`npm run check:docs`는 frontmatter, 경로·상태 규칙, 저장소 상대 링크, 개인 컴퓨터 절대 경로, 대체 관계, top map에서 current/active normative 문서의 도달 가능성을 검사한다. 문서 전용 변경도 `npm run verify:change`에서 이 검사를 통과해야 한다.

리뷰에서는 다음을 확인한다.

1. 새 문서가 기존 정본과 책임을 중복하지 않는가.
2. current 사실과 시점 증거가 섞이지 않았는가.
3. 코드·스키마·테스트보다 문서가 구현 사실의 우선순위를 잘못 주장하지 않는가.
4. active/completed/superseded 상태와 실제 Issue/PR 상태가 모순되지 않는가.
5. 링크와 경로 필터가 이동 뒤에도 유효한가.
