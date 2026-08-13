---
name: github-actions-operations
description: GitHub Actions operation and failure-learning protocol for ssartnership. Use before any action that can create or affect a GitHub Actions run—including git push, PR open/update/ready/merge, tag or release, workflow dispatch/rerun/cancel/delete, branch-protection edits, and workflow edits—and after any failed, cancelled, timed-out, stale, action-required, startup-failed, unexpectedly skipped, or nominally successful run containing retries, flaky tests, errors, or warnings. Also use for Actions-history audits and dev/main promotion.
---

# GitHub Actions Operations

Protect the repository from repeat CI failures and misleading green checks. Preserve failure evidence, learn from every abnormal run, and trigger remote work only from a reviewed local state.

## Mandatory Trigger Protocol

Before **every** operation that can start, replace, queue, skip, or cancel a GitHub Actions run:

1. Read this file completely.
2. Read [failure-ledger.md](references/failure-ledger.md) completely. Match the planned change against every relevant known signature.
3. Resolve the exact repository, target branch, head SHA, event, expected workflows, external deployment checks, and any moving PR that will also run against the same SHA.
   Inspect `.github/workflows/*.yml`, current PR checks, and `gh workflow list`; do not guess the expected run count from memory.
   When a provider install policy has a runtime floor, prove the provider's actual Node and package-manager versions from project settings or a retained build log. A Node major does not prove a bundled npm minor.
4. Inspect active runs that mutate shared state. Do not push, merge, dispatch, or change PR state while Preview sync, Production migration, or another shared mutation could be cancelled, superseded, or made stale.
5. Run the smallest relevant checks, then `npm run prepush`, the repository-required gate. Treat an internal retry or flaky pass as a failure, not as green evidence.
6. Review the final diff, status, issue/PR linkage, and expected run count. Use `Refs #...` until the work has reached the repository's required promotion boundary.
7. State the expected remote effects before triggering them. Perform one deliberate remote mutation, then monitor its exact first attempt before causing another.

Reading the skill earlier in the task does not satisfy this gate. Re-read it immediately before each Actions-triggering mutation because the ledger may have changed.

## First-Attempt Verification

For each triggered SHA or dispatch:

- Record the run ID, workflow, event, exact head SHA, attempt number, and immutable URL.
- Monitor all expected checks, including duplicate push and moving-PR runs when both are intentional.
- Inspect complete job logs, not only GitHub's conclusion badge. Search for `flaky`, `retry #`, failed-first-attempt output, provider errors, unexpected skips, warnings, and annotations.
- Confirm test totals and zero retries for Playwright and Storybook. A successful job with a retry is an abnormal run.
- Keep remote Playwright fail-closed: use zero retries for required CI or make the required job explicitly fail when the reporter records a retry/flaky result. A green badge must never hide a failed first attempt.
- Keep every required wrapper fail-closed. A compiler, linter, test, audit, build, or deployment wrapper may collect a second diagnostic, but it must preserve the first nonzero result and may not turn a failed first invocation into green.
- Confirm provider contracts: Vercel deployment SHA and alias, Supabase migration status, and Preview sync checkout/stale guard/data/storage/post-migration results when applicable.
- Distinguish an expected job-level `skipped` guard from workflow-level cancellation or an unexpected missing check.
- Do not call a change clean until every expected first attempt is complete and log-audited.

## Failure-Learning Loop

Treat all of these as learning events: `failure`, `cancelled`, `timed_out`, `action_required`, `startup_failure`, `stale`, unexpected `skipped`, provider failure, or a success log containing retry/flaky/error evidence.

When one occurs:

1. Stop further Actions-triggering mutations in the affected sequence.
2. Preserve the original run. Never delete, cancel, or rerun it to manufacture a green history. A rerun is allowed only for explicit recovery evidence after the root cause is fixed and recorded; it never replaces a new-SHA first attempt.
3. Capture the exact run/job/step indices, SHA, attempt, event, timestamps, conclusions, annotation presence, and fixed signature counts. Use [audit-actions-run.mjs](scripts/audit-actions-run.mjs) with an explicit `--attempt` for a consistent read-only structural snapshot; it must never persist GitHub-provided log, annotation, workflow, job, step, or path text. Treat `logAvailable: false`, `annotationCollectionComplete: false`, or a nonzero auditor exit as an unavailable evidence boundary, never as a clean audit.
4. Classify the root cause as product, test, workflow, dependency/toolchain, external provider, concurrency, data/schema, configuration, or operator sequencing. Prove the classification; do not label a run flaky merely because a retry passes.
5. Update this skill package before the next Actions-triggering mutation: always update [failure-ledger.md](references/failure-ledger.md) with the run, signature, cause, prevention, regression coverage, and rollout state; update this `SKILL.md` too when the reusable procedure itself was incomplete. Repeated occurrences still extend the ledger even when the procedure text needs no change.
6. Add an executable regression or fail-closed contract whenever practical. Fix repository-controlled causes in a new commit and run retry-disabled focused repetition plus the full relevant gate locally. For a proven external-only outage, add a repository guard or remove the avoidable dependency when possible; otherwise record the provider incident and wait for a new, independently triggered first attempt without rerunning or rewriting the original evidence.
7. Re-read this skill and the updated ledger immediately before pushing the new commit. Verify its remote first attempt from raw logs.

If logs have expired or a run was deleted, record the unavailable boundary and do not claim that log as audited.

## Workflow-Specific Gates

### Public Readiness and lockfile

- GitHub Linux must use the repository-pinned Node/npm path without Docker, `npx`, or a registry fetch during canonical lockfile verification.
- Never materialize dependencies with raw `npm ci` or `npm install` in Actions or Vercel. Use `npm run install:trusted`: it verifies the static/effective npm policy and every reviewed non-registry dependency, installs with every lifecycle script disabled after application/provider secrets are scrubbed (reviewed proxy/CA transport variables may remain), then verifies and executes the integrity-pinned platform `esbuild@0.28.1` binary directly. It never runs `esbuild/install.js` or another lifecycle installer. Keep `.npmrc` exactly at `allow-git=none`, `ignore-scripts=true`, and `omit-lockfile-registry-resolved=false`; do not add package-manager keys unsupported by the oldest reviewed provider npm. The sole reviewed raw-install exception is the post-install, `--package-lock-only --ignore-scripts` canonical lockfile verification; it may not materialize dependencies. This path does not rely on npm's advisory allow-script policy: lifecycle suppression, native Git blocking, exact source classification, and lock identity are independent fail-closed controls.
- Keep provider credentials and application secrets out of job-level environment variables when dependency installation runs in that job. Set `persist-credentials: false` on every checkout, run the trusted install through its explicit environment allowlist, and inject application secrets only into the exact post-install step that needs them. Vercel cannot step-scope project build variables, so its custom install command also starts from an empty shell environment; later application builds still execute dependency code with build-time variables and remain a separate reviewed supply-chain boundary.
- Run `npm run check:lockfile` and `npm run prepush`. Preserve exact Node 24.18.1/npm 11.16.0 on GitHub; Vercel and local install policy accepts the source-reviewed npm range 11.12.1 through 11.x and rejects npm 12 until separately reviewed.
- Before a push or PR that creates a Vercel deployment, verify that the current Vercel build runtime satisfies that reviewed range. If it does not, preserve the failed provider check and correct the runtime contract on a new SHA. Change the range only after primary-source review plus executable regression evidence; never lower it merely to make a deployment green.
- Keep `playwright.config.ts` at `retries: 0` for required E2E and retain traces on failure. Audit output for exact passed totals and zero `flaky`, `retry #`, or `✘` markers; GitHub success alone is insufficient.
- A run-level `success` is invalid evidence if any required job or step failed or was unexpectedly skipped. This catches historical composite workflows whose publish job failed under an overall green conclusion.

### Storybook and visual tests

- Use retry-disabled focused repetition for a failed Story, then run all Storybook interaction/a11y tests.
- Scope modal queries to their dialog, wait for actual controlled-state transitions, and isolate story state/mocks. Do not solve timing defects by rerunning.
- Keep visual baselines bound to the canonical renderer. Review image changes; never regenerate unexplained drift.

### Preview sync and migrations

- `workflow_run` executes the workflow definition from the default branch even when it checks out a `dev` SHA. Verify both the definition source and checked-out target.
- Bind every manual or marker-triggered privileged workflow to an exact reviewed commit. Checkout that SHA, verify runner `HEAD`, and re-read the live protected/integration ref immediately before a database mutation. Never replace the approved revision with a floating `ref: dev` or `ref: main`.
- A workflow that sends cookies, authorization headers, bypass tokens, or login credentials may contact only a repository-pinned origin. Do not accept an operator-supplied URL or rely on HTTPS alone as an allowlist.
- Only an eligible successful `dev` push may join the shared Preview mutation queue. Non-eligible completions need unique no-op concurrency groups.
- Do not start another dev mutation while a sync is active. Verify exact checkout, stale-SHA guard, migration count, credential sanitization, all table/storage stages, and the post-sync migration check.
- Treat `failed on attempt`, provider 5xx recovery, database fallback, `Skipping object`, or `Skipping bucket` as abnormal even if the run succeeds. A required bucket/object skip is blocking; an intentional database fallback must emit and verify a distinct degraded result rather than masquerade as clean parity.
- Never expose passwords, tokens, member identifiers, object paths, or other PII while inspecting sync evidence. Storage retry/failure diagnostics may emit only fixed operation labels, validated numeric status, and a provider-code-presence boolean; never embed provider messages, code values, or object paths.

### Main promotion and external providers

- Verify `dev` integration and Preview deployment first. Re-evaluate schema-first, environment, and disabled-feature ordering before `main`.
- Confirm required branch checks remain fail-closed. A skipped required job must not satisfy protection.
- After merge, inspect the exact Production SHA's first runs and deployment. Do not infer readiness from the PR head deployment.
- Follow the repository's merge-commit convention unless the active Issue/PR explicitly documents another reviewed method.

## Audit And Redaction

- Audit the full currently retained Actions inventory by paginating to exhaustion. Report the freeze timestamp, earliest/latest run, totals by workflow/event/conclusion, and exact unavailable/deleted-log boundary.
- Inspect every retained abnormal run and every available success log for hidden retries when conducting a full audit.
- For every run, inspect job and required-step conclusions as well as the run conclusion. Search successful logs for `flaky`, `retry #`, `✘`, `##[error]`, `##[warning]`, `failed on attempt`, `Skipping object`, `Skipping bucket`, database fallback, and non-fatal cache/provider failures.
- Search required-wrapper diagnostics for an internal second invocation as well. The retained typecheck-wrapper census found no hidden successful retry, but a wrapper that retries after a nonzero first result can create one and is forbidden.
- Distinguish Production dependency-audit failures from informational findings in the full development dependency tree. Do not broadly suppress mock-server, npm, provider, or network errors; any allowlist must be exact, environment-scoped, and regression-tested.
- Treat every log, annotation, workflow name, job name, step name, and repository path returned by GitHub as untrusted secret-bearing text. The per-run structural auditor inspects it only in memory; durable audit output may contain only fixed signature identifiers, counts, line numbers, numeric job/step indices, validated SHA/timestamps/enums, field-presence booleans, and workflow identifiers selected from the repository's reviewed local workflow allowlist. A bounded full-history census may temporarily cache mode-0600 raw ZIP/log inputs under the ignored audit directory solely while classifying them; never copy their text into durable evidence, and remove them after the ledger is safely committed and the investigation ends.
- Never persist or quote a matched raw line, even after regex redaction. Secret-name suffixes, quoted headers, multiline payloads, ANSI escapes, and future credential formats make denylist sanitization an unsafe boundary. Write a short operator-authored cause summary to the ledger without copying identifiers, credentials, payloads, or paths.
- Never mutate Actions, GitHub state, deployments, databases, or user data during a read-only audit.

Use [failure-ledger.md](references/failure-ledger.md) as the living source for known signatures and current rollout state. The frozen 2026-08-13 census and exact retained abnormal/hidden-retry run IDs are in [retained-actions-audit.md](references/retained-actions-audit.md). Before a full-census download, set `umask 077`, create the audit root with mode 0700, and keep raw logs mode 0600; after download, verify every directory/file mode before reading any corpus. Never track raw logs.
After the sanitized durable ledger is committed and no incident investigation needs the raw artifacts, remove local temporary logs from `.tmp/actions-audit/`. GitHub remains the source for retained originals; never delete the remote runs.

## Audit Completeness Gate

Do not treat a ledger marked draft, partial, pending, or unavailable as complete historical evidence. Before an Actions-triggering change that matches an incompletely audited signature, finish that signature's retained-log audit or explicitly stop and report the unavailable boundary. Current task-local fixes may continue offline, but no remote mutation may rely on an unfinished mandatory preflight.
