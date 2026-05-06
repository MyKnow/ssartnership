---
name: ssartnership-patterns
description: Coding patterns extracted from ssartnership git history. Use when working in this repo on Next.js App Router routes, Tailwind UI, Supabase migrations, repository-pattern data access, mock/supabase switches, admin/member/partner workflows, tests, commits, or validation.
version: 1.0.0
source: local-git-analysis
analyzed_commits: 200
---

# Ssartnership Patterns

## Overview

This repo ships a Next.js App Router MVP for SSAFY partnership operations. Keep changes small, layered, and reversible. Prefer existing routes, components, helpers, repositories, and design tokens before adding new surfaces.

## Commit Conventions

Recent history uses conventional commits with Korean, outcome-focused subjects:

- `feat:` for new partnership, auth, review, notification, event, SEO, or admin capabilities
- `fix:` for production/runtime bugs, Supabase query issues, build errors, redirect loops, and data mismatch fixes
- `refactor:` for UI/UX cleanup, file responsibility separation, repository flow cleanup, and structure changes
- `docs:` for README, TODO, FIX, policy, design-system, and audit notes
- `chore:` for version bumps, package updates, and maintenance
- `perf(scope):` is accepted for targeted performance work

Keep commit subjects short unless the change intentionally records a multi-part recovery or production hardening plan.

When the user asks to commit and push, use `npm run release` by default rather than running `git add`, `git commit`, and `git push` manually. The release script is the canonical path because it handles version updates, Storybook build/test gates, Korean commit-message entry, and push behavior. If the release script fails after completing part of the flow, inspect the current git/package state before finishing only the remaining equivalent steps.

## Repository Shape

```txt
src/app/                  App Router pages, route handlers, loading/error states, server actions
src/components/           UI primitives and feature components
src/components/ui/        Shared primitives; adjust these before duplicating styling
src/hooks/                Client hooks, named `use*.ts`
src/lib/                  Domain logic, service helpers, repositories, adapters
src/lib/repositories/     Interfaces plus mock and Supabase implementations
src/lib/supabase/         Server Supabase clients
supabase/migrations/      Forward migrations
supabase/schema.sql       Schema snapshot updated with DB changes
tests/                    Node `.test.mts` files for helpers, selectors, repositories, flows
```

High-change areas from the last 200 commits include `package.json`, `package-lock.json`, `supabase/schema.sql`, `src/app/admin/(protected)/actions.ts`, partner detail pages, `HomeView`, `SiteHeader`, admin partner pages, `event-catalog`, and repository implementations. Be extra conservative in these files because they often sit on core flows.

## Co-Change Patterns

History shows these files commonly move together:

- Route/page work often changes `src/app` and `src/components` together.
- Route/page work often changes `src/app` and `src/lib` together.
- Data-model work often changes route/page, component, repository, migration, and `supabase/schema.sql` together.
- Dependency work changes `package.json` and `package-lock.json` together.
- UI-system work changes `src/components/ui/*`, `src/app/globals.css`, and `docs/design-system/*`.
- Behavior that crosses sorting, parsing, metrics, auth, repositories, or selectors gets focused tests under `tests/`.

## Repository Pattern

- Keep data access behind repository interfaces.
- Keep mock and Supabase implementations aligned so backend switching is mechanical.
- Repository methods should return domain models, not raw database rows.
- Put Supabase row-to-domain mapping near the Supabase repository implementation.
- Keep service/business rules such as visibility, authorization, periods, state transitions, and recoverable errors outside page components when they grow beyond simple rendering.
- When changing a model, check `src/lib/types.ts`, relevant repository interfaces, mock repository, Supabase repository, migrations, schema snapshot, pages, and admin forms.

## Feature Workflow

For a new user-facing or admin-facing feature:

1. Add or update route/page/loading/error surfaces in `src/app`.
2. Add feature components under a domain folder in `src/components`.
3. Put reusable primitives in `src/components/ui` only when they are broadly useful.
4. Add domain helpers, validation, and repository methods in `src/lib`.
5. Update mock and Supabase repository implementations together.
6. Add Supabase migration and update `supabase/schema.sql` when storage changes.
7. Add focused tests under `tests/` for non-trivial helpers, selectors, metrics, parsing, repository mocks, or security-sensitive behavior.

## UI Patterns

- Preserve the hierarchy: page background -> panel -> elevated card -> inset block -> control.
- Avoid nested cards, redundant wrappers, arbitrary shadows, and decorative gradients.
- Use shared primitives (`Button`, `Card`, `Surface`, `Input`, `Select`, `Tabs`, `Skeleton`, `Toast`) before local one-off styling.
- Keep admin and partner portals information-dense but calm.
- For loading states, use route-specific skeletons in `src/components/loading` and colocated `loading.tsx` files.
- For forms, keep controller hooks/helpers separate when state and validation become large.

## Security And Reliability

- Treat auth, password reset, Mattermost verification, admin actions, push, image proxy, and Supabase service-role paths as sensitive.
- Validate request bodies and form inputs at route/action boundaries.
- When adding or changing a form, add matching FE and BE validation. Prefer one shared helper/schema imported by both the client component and the server route/action; if direct sharing is impossible, document the equivalence and test both sides.
- FE validation should prevent avoidable submits, set field-level messages, and focus the first invalid field. BE validation must still reject invalid input at the trust boundary with user-safe errors.
- Keep validation messages and error codes in a shared mapping when the same rule appears in admin, partner, or public user flows.
- Prefer typed recoverable errors and user-safe messages over raw `Error` leaks.
- Avoid public env vars for server-only concerns.
- Keep redirect return paths explicit and testable to avoid login/consent loops.
- Cron routes and admin APIs should fail soft where possible and log enough context server-side.

## Supabase And Migrations

- Create forward migrations under `supabase/migrations`.
- Keep `supabase/schema.sql` in sync with migration-driven schema changes.
- Separate schema changes from heavy data backfills when practical.
- For metrics and rollups, add tests for aggregation helpers or query-shape assumptions.
- When adding storage buckets or policies, review RLS and service-role usage before commit.

## Testing Patterns

- Tests live in `tests/` and use `.test.mts`.
- Name tests after the behavior or helper surface: `partner-portal.mock.test.mts`, `partner-metric-rollups.test.mts`, `security-hardening.test.mts`.
- Prefer focused Node tests for pure helpers, selectors, parser logic, metrics, SEO helpers, and repository mocks.
- Add tests when behavior crosses data filtering, sorting, auth state, visibility, metrics, or recovery flows.

## Validation

Prefer focused checks:

```bash
npx tsc --noEmit --pretty false
npx eslint <changed-files>
node --test tests/<focused-test>.test.mts
```

Run `next build` only when build/runtime behavior changed broadly or when explicitly requested.

## Release And Docs

- Keep `README.md`, `docs/TODO.md`, `docs/FIX.md`, design-system docs, and security docs aligned when the task directly changes those decisions.
- Version bump commits update `package.json` and `package-lock.json` together.
- Do not create new top-level docs unless there is no obvious existing home.
