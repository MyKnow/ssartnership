---
name: docs-governance
description: Repository Knowledge placement, metadata, lifecycle, link, and source-of-truth governance for ssartnership. Use when creating, moving, renaming, completing, superseding, or reviewing project documentation.
---

# Docs Governance

Use this skill whenever the task creates, reorganizes, completes, supersedes, or reviews Markdown documentation in this repository.

## Start Here

Read [docs/index.md](../../../docs/index.md) before choosing a destination. It is the Repository Knowledge map. The detailed metadata, status transition, spec lifecycle, and validation contract is [docs/operations/documentation-lifecycle.md](../../../docs/operations/documentation-lifecycle.md).

`AGENTS.md` is a concise map and working-rule file, not the project knowledge store. Do not grow it into a duplicate manual.

## Root Exceptions

Keep project Markdown under `docs/` except for:

- `README.md`
- `AGENTS.md`
- `.agents/skills/**/SKILL.md` and assets that are part of a skill package

The public vulnerability disclosure policy is `docs/SECURITY.md`. Do not introduce a second root copy.

## Source of Truth

- Product intent and user contracts: `docs/product/`, `docs/requirements/`, `docs/specs/`
- Current technical boundaries: `docs/architecture/`; decision rationale: `docs/decisions/`
- Current implementation: code, schema, migrations, tests, and package scripts
- Work state: `docs/plans/active/`, GitHub Issue/PR, Git, CI
- Repeatable operations: `docs/operations/runbooks/`
- Point-in-time evidence: completed plans, audits, measurements, and history

Link to the canonical document instead of copying the same current fact into several files.

## Placement

Choose the narrowest existing category.

- `docs/product/`: service overview, information architecture, user flows, screen contracts, terminology, operator-facing product guides
- `docs/requirements/`: cross-cutting functional and non-functional contracts
- `docs/specs/<feature>/`: planned multi-surface, data-model, security-sensitive, or architectural features
  - `spec.md`: WHAT/WHY, scope, invariants, acceptance
  - `plan.md`: technical boundaries, changed surfaces, rollout, verification
  - `tasks.md`: resumable order, status, and completion evidence
- `docs/architecture/`: current system, data, API, repository/service, logging boundaries
- `docs/decisions/`: ADRs with Context, Decision, Alternatives, Consequences, Status
- `docs/plans/active/`: approved work that needs repository-local resume context
- `docs/plans/completed/`: finished plans and their evidence
- `docs/plans/tech-debt.md`: unapproved follow-up candidates
- `docs/operations/runbooks/`: repeatable release, deployment, maintenance, recovery procedures
- `docs/operations/audits/`: dated operational findings
- `docs/security/`, `docs/performance/`, `docs/testing/`, `docs/design-system/`: domain contracts and their explicit audit/baseline subtypes
- `docs/history/`: expired or superseded originals that remain useful as evidence

Do not create `generated/` without a reproducible source and command. Do not copy an external reference into the repository unless durable offline preservation, provenance, and usage rights justify it.

## Metadata And Lifecycle

Every `docs/**/*.md` needs scalar frontmatter with `title`, `type`, `status`, and `authority`. Add `last_verified` only after real revalidation. A superseded document also needs `superseded_by`.

- Move finished active plans to `plans/completed/` and record evidence and residual risk.
- Move expired source documents to `history/`; use `superseded` when a replacement exists and `archived` when it simply expired.
- Never use an audit or historical checklist as the current runbook.
- When a path moves, update Markdown links, README/AGENTS/skill references, workflow path filters, and contract tests in the same change.
- Preserve old evidence as code text when a referenced implementation file no longer exists; do not leave a misleading broken link.

## Spec Decision

Use spec/plan/tasks for new planned work that changes several surfaces, data contracts, auth/security, or architecture. Do not retroactively convert the whole brownfield system. A small, reversible fix can stay in an Issue/PR with a focused regression test.

## Verification

Run:

```bash
npm run check:docs
```

The validator fails on invalid metadata, path/status mismatches, broken or repository-external local links, personal-machine absolute paths, missing replacement targets, and current/active normative documents that cannot be reached from `docs/index.md`.

`npm run verify:change` always runs `check:docs`, including the docs-only tier. When documentation is moved, also search the full repository for stale paths and review the final rename detection and diff.
