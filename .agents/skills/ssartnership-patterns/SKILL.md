---
name: ssartnership-patterns
description: Repository-specific coding patterns for ssartnership. Use when working in this repo on Next.js App Router pages, Tailwind UI, Supabase migrations, repository-pattern data access, mock/supabase switches, tests, or commit and validation conventions.
---

# Ssartnership Patterns

## Overview

Use the repo's existing structure and keep changes small, layered, and reversible.

## Repository Shape

- `src/app/` for routes, loading states, error pages, and server actions
- `src/components/` for reusable UI and feature components
- `src/lib/` for domain logic, repositories, shared helpers, and adapters
- `supabase/migrations/` and `supabase/schema.sql` for database changes
- `tests/` for `.test.mts` coverage around domain logic and selectors

## Commit Conventions

- Use conventional prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- Keep summaries short and outcome-focused
- Use Korean commit subjects when that fits the change better
- Group related route, component, lib, migration, and test edits in one commit when they belong to the same feature

## Working Rules

- Prefer existing components, helpers, and local patterns over new abstractions
- Keep data access behind repository interfaces with `mock` and `supabase` implementations
- Keep mock and supabase shapes aligned so switching backends is mechanical
- When data models change, update the route/page, component, repository, and migration together
- Preserve the design hierarchy: page background -> panel -> elevated card -> inset block -> control
- Avoid nested cards, redundant wrappers, and oversized shadows
- Favor explicit spacing and shared tokens from `src/app/globals.css` and `docs/design-system`

## Validation

- Run `npx tsc --noEmit --pretty false`
- Run focused `npx eslint ...` on changed files
- Add or update tests in `tests/` when behavior crosses data, sorting, or selection logic
- Do not run `next build` unless the user explicitly asks for it

## Common Workflows

- New feature: route/page, component, lib helper, repository, migration, and tests
- UI refinement: adjust the shared component first, then patch consuming pages
- Data switch: keep mock and supabase repositories aligned with the same API surface
- Design cleanup: fix hierarchy and spacing before adding new visual decoration
