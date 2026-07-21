---
name: ssartnership-patterns
description: Coding patterns extracted from ssartnership git history. Use when working in this repo on Next.js App Router routes, Tailwind UI, Supabase migrations, repository-pattern data access, mock/supabase switches, admin/member/partner workflows, tests, commits, or validation.
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
- Before adding a migration, run `date '+%Y%m%d%H%M%S'` and inspect `ls supabase/migrations | sort | tail -5`; the new filename must sort after the latest existing migration.
- When a migration alters a table, ensure that table is created in an earlier-sorted migration or already exists in the remote schema. A Preview branch `MIGRATIONS_FAILED` status often means filename ordering or schema drift, not only SQL syntax.

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

### Node 24 CI typecheck parity

`Public Readiness` and Vercel run TypeScript on Node 24. Keep the project TypeScript version pinned to the verified stable release in `package.json` (do not use a broad major-version range after a compiler internal-error incident). Before pushing a change that modifies TypeScript, routes, generated component props, or repository contracts, run `npm run typecheck:ci` and `npm run build` in addition to focused tests. This app keeps `next.config.ts`'s `typescript.ignoreBuildErrors` enabled because Next 16's embedded worker crashes on the repository's valid generic types; the standalone `typecheck:ci` step must remain immediately before build in CI and is the authoritative type gate. The wrapper retries a compiler-process failure once only; a second failure remains a hard failure. Do not hide actual diagnostics with retries—fix reported type errors first.

## CI Failure Guardrails

Recent failed Actions clustered into four workflows: `Sync Preview Supabase`, `Verify Node Lockfile`, `Publish Storybook`, and `Public Readiness`. Before PR, `dev` merge, or `main` promotion, check the relevant guardrail instead of waiting for CI to rediscover the same issue.

- Before every commit or push, run `npm run check:lockfile`, even when `package.json` and `package-lock.json` were not edited. Linux/amd64 optional dependency metadata can drift even when macOS installs look clean; if the command adds canonical metadata such as `dev: true` to `node_modules/fsevents`, review, stage, and commit that `package-lock.json` diff, then rerun the check until clean. Dependency or package graph changes still require the same check.
- Storybook/client UI changes: run `npm run build-storybook`; when stories have interaction tests or media/crop dialogs, run `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome npm run test-storybook` and update story assertions with the component contract.
- Public readiness/E2E changes: run the focused E2E locally with `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome`. If CI failures all mention missing `ffmpeg`, fix the Playwright install/config before debugging product behavior.
- Broad UI waves: focused E2E is insufficient. Run or wait for the full `Public Readiness` E2E suite with the same mock-source environment as `playwright.config.ts`. Update assertions when the UI contract intentionally changes, use accessible step names, derive responsive columns from computed CSS instead of fixture cardinality, and give first-compile redirects an explicit timeout.
- Do not chain an in-memory mock setup mutation into login. Cold Next.js compilation can create separate module graphs, making the mutation invisible and preventing `partner_session` creation. Keep setup E2E independent and use a pre-seeded completed account for login/company-scope E2E.
- The project `prepush` script is the required local Public Readiness gate: it runs `npm run check:lockfile` first and then `CI=1 PLAYWRIGHT_CHROMIUM_CHANNEL=chrome playwright test`. The ECC global pre-push hook executes this optional repository gate after lint/test/build. Because the canonical release script pushes with `--no-verify`, `scripts/release.sh` must also call `npm run prepush` explicitly before branch and main/tag pushes.
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
- Supabase Preview changes: run `npm run validate:migrations`, inspect sorted migration order, and wait for the Supabase Preview external status to become green. Do not treat local migration validation as proof that the remote Preview branch applied successfully.
- Preview sync failures: inspect sanitizer diagnostics and missing relation errors first. Production-to-Preview sync may fail when Production has tables not present in Preview, so the sync script must tolerate or explicitly map schema drift.
- Main promotion: after pushing or merging into `main`, monitor `gh run list --branch main` or `gh pr checks --watch` until `Verify Node Lockfile`, `Public Readiness`, Supabase, and Vercel statuses are green.

## Release And Docs

- Keep `README.md`, `docs/TODO.md`, `docs/FIX.md`, design-system docs, and security docs aligned when the task directly changes those decisions.
- Version bump commits update `package.json` and `package-lock.json` together.
- Do not create new top-level docs unless there is no obvious existing home.
