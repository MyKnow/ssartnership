---
name: ssartnership-patterns
description: Coding patterns extracted from ssartnership git history. Use when working in this repo on Next.js App Router routes, Tailwind UI, Supabase migrations, repository-pattern data access, mock/supabase switches, admin/member/partner workflows, tests, commits, validation, CI, release, push, PR, or merge work. Before any operation that can affect GitHub Actions, also use github-actions-operations.
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

When the user asks to commit and push, use `npm run release` by default rather than running `git add`, `git commit`, and `git push` manually. The release script is the canonical path because it runs the local change-aware gate, handles version updates, validates the Korean commit message, and pushes one reviewed commit. Storybook interaction and visual baselines are manual tools, not normal release prerequisites. If the release script fails after completing part of the flow, inspect the current git/package state before finishing only the remaining equivalent steps.

## Repository Shape

```txt
src/app/                  App Router pages, route handlers, loading/error states, server actions
src/components/           UI primitives and feature components
src/components/ui/        Shared primitives; adjust these before duplicating styling
src/hooks/                Client hooks, named `use*.ts`
src/lib/                  Domain logic, service helpers, repositories, adapters
src/lib/repositories/     Shared-entity interfaces plus mock and Supabase implementations
src/lib/supabase/         Server Supabase clients
supabase/migrations/      Forward migrations; the schema source of truth
supabase/schema.sql       Snapshot derived from migrations, updated with DB changes
tests/                    node:test `.test.mts` files for helpers, selectors, repositories, source contracts
tests/unit/               Vitest `.test.ts` files for routes/actions that need module mocks
deploy/                   Self-hosting Compose, edge, CI receiver, and operations assets
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
- Placement: a table used by one domain gets a domain-folder repository (`src/lib/<domain>/repository.ts`, `repository.supabase.ts`, `repository.mock.ts` when mock mode needs it). An entity shared by several domains belongs in `src/lib/repositories/` (interface, `mock/*.mock.ts`, `supabase/*.supabase.ts`, selected in `index.ts`). Do not create a third layout.
- Do not add a new file that calls `.from("<table>")` outside `src/lib/repositories/`; move the query behind the domain repository instead. The ratchet baseline and measurement commands live in `docs/plans/tech-debt.md`. Do not mass-introduce new repository+mock pairs only to reach zero.
- Mock mode exists for E2E, Storybook, and the local bootstrap profile. Keep the documented support scope in `docs/architecture/system-overview.md`; a module outside it may return an unavailable result in mock mode instead of growing a new mock write path.

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

- For any UI creation, revision, or review, use `ssartnership-ui-ux` with the relevant Codex-local frontend and Korean responsive skills.
- Preserve the hierarchy: page background -> panel -> elevated card -> inset block -> control, and use shared primitives before local one-off styling.
- Keep admin and partner portals information-dense but calm. Use route-specific skeletons and keep large form controllers/helpers separate.
- For member password, consent, profile-photo, or `returnTo` gate work, use `member-required-gate-redirects` instead of recreating gate precedence.

## Security And Reliability

- Treat auth, password reset, Mattermost verification, admin actions, push, image proxy, and Supabase service-role paths as sensitive.
- Validate request bodies and form inputs at route/action boundaries.
- When adding or changing a form, add matching FE and BE validation. Prefer one shared helper/schema imported by both the client component and the server route/action; if direct sharing is impossible, document the equivalence and test both sides.
- FE validation should prevent avoidable submits, set field-level messages, and focus the first invalid field. BE validation must still reject invalid input at the trust boundary with user-safe errors.
- Keep validation messages and error codes in a shared mapping when the same rule appears in admin, partner, or public user flows.
- Reuse the shared rule modules listed in `docs/requirements/error-recovery.md` (PIN/code/control-character checks, UUID, length constants, field errors, FormData readers, KST date and ko-KR number formatters) instead of re-declaring regexes, `maxLength` literals, or local formatters; ratchet tests reject re-declarations.
- Prefer typed recoverable errors and user-safe messages over raw `Error` leaks.
- Avoid public env vars for server-only concerns.
- Keep redirect return paths explicit and testable to avoid login/consent loops.
- Cron routes and admin APIs should fail soft where possible and log enough context server-side.
- Log server-side failures with `logServerError`/`logServerWarning` from `src/lib/server-log.ts` (one sanitized JSON line), never `console.error(label, error)` with a raw error or provider message. Wrap best-effort Supabase writes whose `{ error }` would otherwise be ignored with `expectNoError` from `src/lib/expect-no-error.ts`.
- A cleanup cron that skips failed items must report the failure count with a 5xx (`getCronErrorResponse`) instead of `ok: true`; the self-host cron runner turns that into an operator notice.

## Supabase And Migrations

- Create forward migrations under `supabase/migrations`.
- Keep `supabase/schema.sql` in sync with migration-driven schema changes.
- Separate schema changes from heavy data backfills when practical.
- For metrics and rollups, add tests for aggregation helpers or query-shape assumptions.
- When adding storage buckets or policies, review RLS and service-role usage before commit.
- Before adding a migration, run `date '+%Y%m%d%H%M%S'` and inspect `ls supabase/migrations | sort | tail -5`; the new filename must sort after the latest existing migration.
- When a migration alters a table, ensure that table is created in an earlier-sorted migration. `supabase/migrations` is the single source of truth and `supabase/schema.sql` is a derived snapshot; when they disagree, fix the snapshot, never an applied migration.

## Testing Patterns

- Choose the runner by what the test needs (details in `docs/testing/strategy.md`):
  - `node:test` in `tests/*.test.mts` (`npm run test:node`): pure helpers, selectors, parsers, metrics, SEO helpers, repository mocks, and source-text contracts.
  - Vitest in `tests/unit/*.test.ts` (`npm run test:unit`): route handlers and server actions that need module mocks (`vi.mock`) such as `next/headers`, `next/cache`, or the Supabase client.
  - Playwright E2E for user tasks across pages; Storybook for component states (manual).
- Name tests after the behavior or helper surface: `partner-portal.mock.test.mts`, `partner-metric-rollups.test.mts`, `security-hardening.test.mts`. Avoid incident-named files.
- New tests import the module and assert behavior. Add a source-text (`readFileSync` + regex) contract only when behavior cannot be exercised without a server, and keep it narrow.
- Add tests when behavior crosses data filtering, sorting, auth state, visibility, metrics, or recovery flows.

## Refactoring Procedure

Program-wide defaults are recorded in `docs/plans/active/refactor-program-2026-10.md`. When splitting, moving, or renaming code:

1. Characterize first. The first commit of a large-module split adds import-based characterization tests for the current behavior of the pure functions it touches; later commits must keep them green.
2. Find source-text contracts before moving anything: `grep -rl "<old path|identifier|literal>" tests`. Update every hit in the **same commit** as the move or string change. Roughly half of the Node tests read `src/` paths as text, so a move without this step silently breaks them.
3. When the shared helper `tests/support/read-source.mts` exists, new source-text contracts read files through it instead of hand-built relative `readFileSync` paths.
4. Keep behavior and structure apart: a pure move or split must not change wire formats, error codes, user-facing Korean copy, or redirect targets. Put intended behavior changes in their own commit with their own test.
5. Server action failures keep the redirect helper convention (`redirectAdminActionError` family). Do not introduce a parallel `ActionResult` object convention.
6. Keep the `src/app/admin/(protected)/actions.ts` barrel for existing callers, but new admin actions are imported directly from `_actions/*`.
7. Cache invalidation prefers `unstable_cache` tags: call `revalidateTag(tag, "max")` as the existing actions do (the one-argument form is deprecated in Next 16; check `node_modules/next/dist/docs` before using `updateTag`). Use `revalidatePath` only as a page-level supplement. Keep the session-gated dynamic rendering of public pages; do not switch to `cacheComponents`/PPR.
8. `supabase/migrations` is the schema source of truth and `supabase/schema.sql` is derived from it. Never edit an applied migration to fix drift.

## Validation

Prefer focused checks:

```bash
npx tsc --noEmit --pretty false
npx eslint <changed-files>
node --import ./tests/alias-register.mjs --test tests/<focused-test>.test.mts
```

The alias loader is required: without it, any test that reaches an `@/` import stops at module loading (`ERR_MODULE_NOT_FOUND`), which the failure ledger has recorded twice as a local invocation defect.

Run `next build` only when build/runtime behavior changed broadly or when explicitly requested.

### Node 24 CI typecheck parity

`Public Readiness` and the self-host image workflows run TypeScript on Node 24. Keep the project TypeScript version pinned to the verified stable release in `package.json` (do not use a broad major-version range after a compiler internal-error incident). Before pushing a normal change, run `npm run verify:change`; before a `dev` to `main` promotion or a broad build/runtime change, run `npm run verify:release`. `typecheck:ci` is a single-attempt semantic TypeScript gate; never add `--noCheck` or retry a failed compiler invocation into green. This app still keeps `next.config.ts`'s `typescript.ignoreBuildErrors` enabled because Next 16's embedded type worker has crashed independently during builds; the verified standalone semantic check remains the required type gate. `tsconfig.json` and `next-env.d.ts` intentionally exclude direct `.next` route-contract imports and the Next TypeScript plugin because the same Next worker bug has crashed or hung on them; route inventory and focused route tests cover the generated-route surface separately.

## CI Failure Guardrails

Before any push, PR open/update/ready transition, merge, release, tag, workflow dispatch, rerun, cancellation, deletion, branch-protection edit, or other GitHub Actions-affecting operation, use `github-actions-operations`. Its tiered pre-trigger gate and blocking failure-learning rules are mandatory. Repository-controlled failures, hidden retries, security failures, and schema failures block the next trigger. An exact reviewed warning baseline or a recovered external-provider transient with proven final parity does not require a source change or a new SHA.

Current workflows live in `.github/workflows/`; check `gh workflow list` instead of relying on names from older failures. Historical failures clustered around Preview sync (retired with the cloud Preview), lockfile verification (now part of the Quick profile that `Public Readiness` runs), Storybook publishing, and `Public Readiness`. Before PR, `dev` merge, or `main` promotion, check the relevant guardrail instead of waiting for CI to rediscover the same issue.

- Before every commit or push, run `npm run check:lockfile`, even when `package.json` and `package-lock.json` were not edited. Linux/amd64 optional dependency metadata can drift even when macOS installs look clean; if the command adds canonical metadata such as `dev: true` to `node_modules/fsevents`, review, stage, and commit that `package-lock.json` diff, then rerun the check until clean. Dependency or package graph changes still require the same check.
- Storybook/client UI changes: run Storybook checks only when the changed Story is used as an executable component contract or when the user explicitly requests them. The GitHub Storybook/visual workflow is manual.
- Public readiness/E2E changes: run the focused E2E locally with `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome`. If CI failures all mention missing `ffmpeg`, fix the Playwright install/config before debugging product behavior.
- Broad UI waves and Production promotion: focused E2E is insufficient. Run `npm run verify:release`; the `CI Policy Gate` on a `high` PR must include the full Release profile. Update assertions when the UI contract intentionally changes, use accessible step names, derive responsive columns from computed CSS instead of fixture cardinality, and give first-compile redirects an explicit timeout.
- Do not chain an in-memory mock setup mutation into login. Cold Next.js compilation can create separate module graphs, making the mutation invisible and preventing `partner_session` creation. Keep setup E2E independent and use a pre-seeded completed account for login/company-scope E2E.
- The project `prepush` script aliases `verify:change`, which classifies the actual merge-base diff through the same repository module as GitHub. Every tier first runs `check:docs`; `docs` then skips runtime checks, `development` runs changed-file lint and semantic typecheck, `ui` adds Node/unit tests, and `standard`/`high` run the complete Quick profile. Unknown paths, deletions, renames, oversized changes, CI, dependencies, migrations, API/actions, auth/security, repositories, and E2E contracts fail closed to `high`. `verify:release` remains the complete Production build plus retry-free full E2E suite for `dev` to `main` promotion. Actions and self-host image builds must use `npm run install:trusted`; raw dependency materialization with `npm ci`/`npm install` is forbidden. The trusted path disables every lifecycle, requires exact registry URLs plus SHA-512 lock integrity, never runs `esbuild/install.js`, and executes an `esbuild` binary only after platform-specific SHA-256 verification. Because the canonical release script pushes with `--no-verify`, `scripts/release.mjs` calls `npm run prepush` explicitly before branch and main/tag pushes.
- An always-on `npm run dev` and Playwright's web server cannot share `.next/dev/lock`, even on ports 3000 and 3100. Preserve the user dev server and give Playwright `NEXT_DIST_DIR=.next-e2e`; keep that directory ignored by both Git and ESLint so a later pre-push lint does not scan generated bundles.
- Keep search result behavior and URL serialization as separate contracts: visible filtering belongs in E2E, serialization in unit tests, and URL restoration in its dedicated back-navigation flow.
- Registration step E2E must use the breakpoint-independent semantic state (`파트너 등록 단계` navigation and visible `aria-current="step"`) instead of compact-only labels. Use `:visible` because both responsive stepper DOMs can remain mounted.
- Match partner navigation assertions to fixture cardinality: multi-company accounts show the chooser, while a single-company session redirects to its canonical dashboard. Allow 15 seconds for the initial compiled render.
- Debounced/router-backed query-string synchronization may lag behind visible filtering. Keep result filtering, URL serialization, and back-navigation restoration as separate contracts instead of extending a combined assertion timeout.
- Mock partner authentication: `NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE=mock` must not depend on the Supabase-backed rate-limit lookup. Keep that bypass restricted to the mock repository path; never weaken the production/supabase guard.
- Mock public SSR must also stay repository-backed. Do not call `getSupabaseAdminClient()` directly for render dependencies such as registration categories when `NEXT_PUBLIC_DATA_SOURCE=mock`; CI intentionally has no Supabase secrets.
- A partner login can reach `/partner` before `partner_session` is committed. In E2E, poll `browserContext.cookies()` for the non-empty cookie rather than treating URL or chooser text as session readiness, then open the canonical protected company path.
- Visual baseline changes: after reviewing intentional diffs, run `npm run test:visual -- --update-snapshots` and then a plain `npm run test:visual`. Treat an unexplained screenshot diff as a blocker, not as permission to regenerate.
- Route smoke failures: a rendered Korean 404 page means the route inventory, redirect, or app route changed. Update the smoke fixture and the route/redirect intentionally in the same work unit.
- Migration changes: run `npm run validate:migrations` and inspect sorted migration order. No workflow applies DDL: the operator applies migrations to self-hosted Preview and Production and writes each environment's schema approval, and receivers refuse a mismatched migration tree. Local validation is not proof that either environment applied the migration.
- Preview data copy is an operator procedure (`scripts/self-host-environments/cli.mjs prepare-copy`), never a push side effect. The cloud-era `sync:preview` path is retired (it targeted the frozen cloud baseline); never use or reintroduce it. For a copy failure, inspect the sanitizer diagnostics and the copy receipt first.
- Main promotion: create a short-lived `dev` to `main` PR only when Production is ready. Require the always-running `CI Policy Gate` before merge; after merge, monitor the exact Production SHA's policy gate, the first attempt of `Self-host Production Images`, and the Production receiver state for that SHA. Never require a conditionally skipped verification job directly in branch protection.

## Release And Docs

- Start from `docs/index.md`; keep the relevant product, requirement, spec, plan, design-system, operations, and security source of truth aligned when the task changes those decisions.
- Version bump commits update `package.json` and `package-lock.json` together.
- Do not create new top-level docs unless there is no obvious existing home.
