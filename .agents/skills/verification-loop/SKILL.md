---
name: verification-loop
description: "A comprehensive verification system for Claude Code sessions."
---

# Verification Loop Skill

A comprehensive verification system for Claude Code sessions.

## When to Use

Invoke this skill:
- After completing a feature or significant code change
- Before creating a PR
- When you want to ensure quality gates pass
- After refactoring

## Verification Phases

### Phase 0: Repository-Specific CI Parity

Before the generic phases, add checks that mirror the CI failures this repo has already seen:

```bash
# Always run before commit/push, even when package.json and package-lock.json were not edited.
# Optional platform packages can drift in lockfile metadata without a manifest change.
npm run check:lockfile

# Supabase migration changes
npm run validate:migrations
ls supabase/migrations | sort | tail -5

# Storybook or client UI changes
npm run build-storybook
PLAYWRIGHT_CHROMIUM_CHANNEL=chrome npm run test-storybook
```

Always run `npm run check:lockfile` before every commit or push. Do not scope this check only to dependency changes: Linux/npm canonicalization can add metadata such as `dev: true` to optional platform packages (for example `node_modules/fsevents`) even when application files are the only files changed.

If the command changes `package-lock.json`, review that diff, keep the canonical change, stage it with the work unit, and rerun the command until it reports a clean lockfile. Never discard the generated canonical diff just because `package.json` is unchanged. The GitHub `Verify Node Lockfile` job runs the Linux/amd64 Node 20/npm 10 resolution first and blocks `Public Readiness` at the same step, so a lockfile drift failure must be fixed before investigating later CI stages. When Docker is unavailable locally, the repository script's npm 10 fallback is the required local parity check; run `npm ci` after canonicalizing the lockfile.

Use only the other checks relevant to the changed files, but never skip `npm run check:lockfile` when `package.json`, `package-lock.json`, Playwright, Storybook, or native/optional dependencies changed.

For Supabase work, local validation is not enough by itself. Confirm the new migration sorts after the latest existing file and wait for the remote Preview/Supabase branch status to leave `MIGRATIONS_FAILED`.

For E2E work, a CI-wide failure that mentions missing `ffmpeg` or a missing Playwright executable is an environment/install problem. Fix the Playwright install step or use `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome` before debugging app behavior.

For page-smoke failures, a 404 response body means the test route list and App Router tree are out of sync. Update the route, compatibility redirect, or smoke fixture deliberately.

For a broad UI wave, run the full CI-equivalent E2E suite, not only focused tests. A focused `BASE_URL` run can hide mock-source and server-start failures. Use an isolated Playwright server with the same mock environment as `playwright.config.ts`; if a developer server already holds the Next.js lock for the workspace, use a clean worktree or let CI run before merge.

Before accepting UI E2E assertions:

- Assert the current product contract. If mobile intentionally removes a generic icon CTA, assert its absence and use the visible title/card navigation path.
- Prefer accessible names (`getByRole`) over duplicated visible step text. Compact steppers may render only a number while exposing `1/5 제휴처` through `aria-label`.
- Verify responsive grid columns from computed `grid-template-columns`; do not require a second data row merely to prove layout.
- Assert step progress through the shared semantic contract (`nav` and visible `aria-current="step"`) rather than a compact-only accessible name. Responsive implementations can leave both hidden and visible stepper DOMs mounted, so include `:visible` to avoid strict-mode collisions.
- Match the company-selection expectation to the fixture cardinality. Multi-company mock accounts show the chooser, while exactly one company redirects to its dashboard; allow 15 seconds for the first compiled redirect/render.
- Keep visible filtering assertions separate from URL-state assertions. Rapid `router.replace` transitions can make a combined search-result test flaky; cover serialization in unit tests and filter restoration in a dedicated navigation E2E.
- Add explicit navigation/hydration timeouts for first-compile redirects instead of relying only on `networkidle`.
- Keep mock auth isolated from Supabase infrastructure. When the partner portal repository is mock, do not call the Supabase-backed rate-limit lookup; production/supabase paths must retain the guard.
- Keep mock SSR read paths isolated too. Under `NEXT_PUBLIC_DATA_SOURCE=mock`, render dependencies such as registration categories must come through the repository instead of a direct `getSupabaseAdminClient()` call; CI intentionally has no Supabase secrets.
- Audit every parallel SSR dependency, including plan-gated metrics and timeseries, for mock isolation. One direct Supabase read inside `Promise.all` fails the entire page in secret-free CI.
- Never combine an in-memory mock setup mutation and login in one E2E flow. Next.js cold compilation can evaluate setup and login in different module graphs, so the login cannot see the mutated store and no `partner_session` cookie is created. Test setup independently and log in with a deterministically pre-seeded, completed mock account.
- This repository opts into the full CI-parity Playwright suite before push through `package.json#prepush`. The global ECC hook runs the optional repository `prepush` script after lint/test/build for ordinary pushes. `npm run release` intentionally uses `git push --no-verify`, so `scripts/release.sh` must invoke `npm run prepush` directly before both branch pushes and main tag pushes.
- Keep the always-on local dev server and Playwright web server on separate Next.js build directories. `playwright.config.ts` must set `NEXT_DIST_DIR=.next-e2e`; a different port alone does not avoid Next's `.next/dev/lock` singleton.
- Keep `.next-e2e/**` in both `.gitignore` and ESLint's `globalIgnores`. After running E2E locally, `npm run lint` must not traverse generated Next bundles; otherwise the next push hook can fail on generated `@ts-ignore` and unused-variable diagnostics rather than source code.
- Playwright mock authentication requires a test-only `PARTNER_SESSION_SECRET` of at least 32 characters; otherwise CI can fail after successful credential validation when the session cookie is signed.
- Pixel geometry assertions must wait for `networkidle` and `document.fonts.ready` before measuring layout.
- For cold-compiled Next.js routes, separate the link destination contract from the destination task: assert `href`, then navigate explicitly. Do not let server-rendered visibility race client hydration in CI.
- Assign an explicit per-test timeout to cold multi-route flows; do not hide the cost by increasing the global Playwright timeout.
- Poll exact responsive geometry until hydration settles instead of loosening the visual contract or depending on CI retries.

When intentional UI changes affect visual baselines, run `npm run test:visual -- --update-snapshots`, inspect the six affected 360/820/1366 images, then rerun plain `npm run test:visual`. Never update snapshots merely to silence an unexplained diff.

### Phase 1: Build Verification
```bash
# Check if project builds
npm run build 2>&1 | tail -20
# OR
pnpm build 2>&1 | tail -20
```

If build fails, STOP and fix before continuing.

### Phase 2: Type Check
```bash
# TypeScript projects
npx tsc --noEmit 2>&1 | head -30

# Node 24 Public Readiness parity (ssartnership)
npm run typecheck:ci

# Python projects
pyright . 2>&1 | head -30
```

Report all type errors. Fix critical ones before continuing.

### Phase 3: Lint Check
```bash
# JavaScript/TypeScript
npm run lint 2>&1 | head -30

# Python
ruff check . 2>&1 | head -30
```

### Phase 4: Test Suite
```bash
# Run tests with coverage
npm run test -- --coverage 2>&1 | tail -50

# Check coverage threshold
# Target: 80% minimum
```

Report:
- Total tests: X
- Passed: X
- Failed: X
- Coverage: X%

### Phase 5: Security Scan
```bash
# Check for secrets
grep -rn "sk-" --include="*.ts" --include="*.js" . 2>/dev/null | head -10
grep -rn "api_key" --include="*.ts" --include="*.js" . 2>/dev/null | head -10

# Check for console.log
grep -rn "console.log" --include="*.ts" --include="*.tsx" src/ 2>/dev/null | head -10
```

### Phase 6: Diff Review
```bash
# Show what changed
git diff --stat
git diff HEAD~1 --name-only
```

Review each changed file for:
- Unintended changes
- Missing error handling
- Potential edge cases

### Phase 7: Remote Status Watch

After pushing a PR branch or promoting `dev` to `main`, watch remote checks instead of assuming the push finished the release:

```bash
gh pr checks --watch
gh run list --branch main --limit 10
```

Do not mark a release-ready task complete while `Verify Node Lockfile`, `Public Readiness`, `Publish Storybook`, Supabase Preview, or Vercel statuses are red or still in progress, unless the user explicitly accepts that risk.

## Output Format

After running all phases, produce a verification report:

```
VERIFICATION REPORT
==================

Build:     [PASS/FAIL]
Types:     [PASS/FAIL] (X errors)
Lint:      [PASS/FAIL] (X warnings)
Tests:     [PASS/FAIL] (X/Y passed, Z% coverage)
Security:  [PASS/FAIL] (X issues)
Diff:      [X files changed]

Overall:   [READY/NOT READY] for PR

Issues to Fix:
1. ...
2. ...
```

## Continuous Mode

For long sessions, run verification every 15 minutes or after major changes:

```markdown
Set a mental checkpoint:
- After completing each function
- After finishing a component
- Before moving to next task

Run: /verify
```

## Integration with Hooks

This skill complements PostToolUse hooks but provides deeper verification.
Hooks catch issues immediately; this skill provides comprehensive review.
