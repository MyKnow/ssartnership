---
name: docs-governance
description: Repository markdown placement and documentation taxonomy for ssartnership. Use when creating, moving, renaming, or reviewing markdown files so that README, AGENTS, and skill docs stay in place and every other project markdown file is stored under docs/ with a clear category.
---

# Docs Governance

Use this skill whenever the task creates or reorganizes Markdown documentation in this repository.

## Core Rule

Keep project Markdown files under `docs/`.

Allowed non-`docs/` exceptions:

- `README.md`
- `AGENTS.md`
- `.agents/skills/**/SKILL.md`
- skill metadata or assets that are part of a skill package

Everything else that is a project document should live under `docs/`.

## Placement Rules

Choose the narrowest matching category first.

- `docs/security/`
  - security reviews
  - hardening guides
  - auth, secrets, abuse prevention, incident notes
- `docs/performance/`
  - profiling notes
  - performance audits
  - before/after measurements
  - optimization plans
- `docs/design-system/`
  - foundations
  - component conventions
  - layout/motion rules
- `docs/architecture/`
  - system structure
  - repository/service boundaries
  - data flow and technical decisions
- `docs/operations/`
  - release workflow
  - deployment runbooks
  - maintenance guides
  - operational audits
- `docs/product/`
  - roadmap
  - TODO/FIX lists
  - feature rollout notes
  - domain policies that are product-facing
- `docs/testing/`
  - Storybook
  - Playwright
  - test strategy
  - QA guides

If no category exists yet, create the smallest obvious directory under `docs/` instead of leaving the file at repo root.

## File Naming

- Prefer lowercase kebab-case for general docs: `release-workflow.md`
- Keep established security report naming when already standardized:
  - `security_YYYY-MM-DD_NN.md`
- Avoid vague names at root level like `FIX.md`, `TODO.md`, `notes.md`
- Prefer names that make the category obvious without opening the file

## Required Behavior

When asked to create a new Markdown doc:

1. Decide whether it is a skill file or repository doc
2. If it is a repository doc, place it under `docs/`
3. If the file already exists outside `docs/` and is not an allowed exception, move it
4. Update internal links if a move changes paths

When asked to review doc layout:

1. List root-level `.md` files
2. Separate allowed exceptions from misplaced docs
3. Propose the target `docs/` subdirectory for each misplaced file

## Current Repository Taxonomy

Use these directories first because they already exist:

- `docs/security/`
- `docs/performance/`
- `docs/design-system/`

Preferred next directories when needed:

- `docs/architecture/`
- `docs/operations/`
- `docs/product/`
- `docs/testing/`

## Notes

- Do not move `AGENTS.md`; tooling expects it at repo root.
- Do not create extra top-level Markdown files unless the user explicitly wants a root-level exception.
- `STORYBOOK.md` should live under `docs/testing/` if it is kept as repository documentation.
