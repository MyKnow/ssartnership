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
# Dependency or package-lock changes
npm run check:lockfile

# Supabase migration changes
npm run validate:migrations
ls supabase/migrations | sort | tail -5

# Storybook or client UI changes
npm run build-storybook
PLAYWRIGHT_CHROMIUM_CHANNEL=chrome npm run test-storybook
```

Use only the checks relevant to the changed files, but never skip `npm run check:lockfile` when `package.json`, `package-lock.json`, Playwright, Storybook, or native/optional dependencies changed.

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
- URL query synchronization can trail client-side filtering. After asserting visible results, allow up to 15 seconds for the router-backed URL assertion.
- Add explicit navigation/hydration timeouts for first-compile redirects instead of relying only on `networkidle`.
- Keep mock auth isolated from Supabase infrastructure. When the partner portal repository is mock, do not call the Supabase-backed rate-limit lookup; production/supabase paths must retain the guard.
- Keep mock SSR read paths isolated too. Under `NEXT_PUBLIC_DATA_SOURCE=mock`, render dependencies such as registration categories must come through the repository instead of a direct `getSupabaseAdminClient()` call; CI intentionally has no Supabase secrets.
- A cookie-setting login can update the URL before the dynamic chooser has received the session. Do not navigate away at that point. Wait up to 45 seconds for the chooser under cold CI compilation, raise the flow timeout to 90 seconds, then continue through its canonical company link.

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
