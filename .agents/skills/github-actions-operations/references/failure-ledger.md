# GitHub Actions failure ledger

This is the living, sanitized source for Actions failure signatures and rollout state. Read it completely before every operation that can affect GitHub Actions. Every abnormal run extends this file before the next remote trigger, even when it matches an existing signature.

## Frozen audit baseline

- Repository: `MyKnow/ssartnership`
- Freeze timestamp: `2026-08-13T14:48:40Z`
- Retained run range: `2026-04-12T07:04:05Z` through `2026-08-13T14:21:15Z`
- Fully paginated retained inventory: 3,362 runs
- Conclusions after the final in-progress run settled: 2,337 success, 195 failure, 136 cancelled, 694 skipped
- Workflow totals: Sync Preview Supabase 1,149; Verify Node Lockfile 1,018; Public Readiness 723; Publish Storybook 325; Storybook and Visual Baselines 66; Measure Admin Preview Performance 54; Apply Preview Supabase Migrations 16; Apply Production Supabase Migrations 11
- Event totals: push 1,602; workflow_run 1,005; pull_request 670; workflow_dispatch 85
- Failure/cancellation audit: all 331 runs classified from metadata/jobs; 264 full logs available, 67 unavailable
- Success audit: all 2,337 run/job records inspected; 1,755 full logs available and scanned, 582 returned `410 Gone`
- Skipped audit: 694 metadata records; 684 Sync Preview workflow-run no-ops, 8 Storybook PR guards, and 2 Preview migration guards. These normally have no executed log body.
- Expired success-log boundary: 582 runs from `2026-04-12T09:26:47Z` through `2026-05-15T08:37:37Z` (225 Verify Node Lockfile, 223 Publish Storybook, 134 Sync Preview Supabase)
- Two expired-log runs were overall `success` despite a failed install job and skipped publish job: `25095791143`, `25096099514`. Their job metadata is preserved; the exact dependency error is unknowable.

The audit is complete for the retained GitHub inventory, subject to the stated expired-log boundary. GitHub cannot prove runs that were deleted before the freeze. Exact frozen IDs and category coverage are preserved in [retained-actions-audit.md](retained-actions-audit.md).

## Active rollout state

- Docker-dependent lockfile verification (`31699366066`, external registry 502) is fixed on `dev` by PR #358. GitHub Linux now uses pinned Node/npm without Docker or `npx`. It is not considered Production-complete until the same contract reaches `main` and the exact main SHA passes.
- Hidden Playwright retries affected 441 successful retained runs. The current #360 change sets required Playwright retries to zero and retains failure traces. This is not effective until merged to `dev`, then `main`.
- Preview Sync no-op concurrency cancellation affected 51 retained runs. PR #359 isolates eligible mutations from no-op completions, but its latest Storybook stabilization commit is intentionally unpushed until #360 establishes this skill contract. A `workflow_run` fix is not authoritative until its workflow exists on default branch `main`.
- PR #359 run `31709729097` failed one Push Composer Story interaction. The original run is preserved. Local commit `f360e55b` scopes the dialog, verifies controlled input state, and passed retry-disabled focused repetition 5 times plus the full 462-story gate; remote first-attempt evidence is still pending.
- #360's independent security review found three privileged-workflow trust-boundary defects and one private-log defect: an operator URL could receive Preview admin credentials, Admin Performance and Preview migration workflows selected floating `dev`, and Storage failures could print private object paths. The local #360 change pins the admin origin, binds privileged execution to exact checked-out SHAs with pre-mutation live-ref checks, and emits only structural Storage status/code diagnostics. None is effective until merged to `dev`, then `main` where workflow definitions are authoritative.
- Production dependency/security/type/unit/migration failures are genuine gates. Do not suppress them as notification noise.

## Known signatures and prevention

### Required tests and UI gates

- `hidden_playwright_retry` — 441 nominally successful runs, `2026-06-23` through `2026-08-13`. Evidence includes `✘`, `retry #1/#2`, and final `N flaky`. Prevention: `retries: 0`, `trace: retain-on-failure`, readiness/hydration fixes, deterministic state reset, and raw-log zero-marker verification.
- `public_e2e_regression_or_flake_exhausted` — 54 failures. These include partner discovery, auth recovery, admin, and route smoke defects. Prevention depends on the proven failing surface; never collapse them into a generic flaky label.
- `storybook_interaction_or_a11y_failure` — 7 failures. Root causes include shared draft/mock state and unverified async UI transitions. Scope queries to the active dialog, assert controlled state, reset per-story state, and run the full interaction/a11y gate.
- `storybook_visual_baseline_drift` — 2 failures. Keep renderer and font environment canonical; inspect images before updating a baseline.
- `public_playwright_browser_install_timeout` — 2 historical failures. Keep browser setup explicit and pinned; classify provider download failure separately from product failure.

### Lockfile, dependencies, and toolchain

- `lockfile_canonical_drift` — 20 standalone plus 6 Public failures. Run canonical lockfile verification before every push and keep the generated Linux metadata committed.
- `public_lockfile_external_docker_registry_failure` — run `31699366066`. Docker Hub returned 502. The repository removed this avoidable CI registry dependency in PR #358.
- `publish_storybook_lockfile_npm_ci_mismatch` — 13 historical failures; `workflow_runtime_or_npm_ci_mismatch` — 1; `legacy_verify_workflow_chromatic_external_or_runtime` — 4. Preserve package/lock parity and keep concerns in dedicated workflows.
- `public_dependency_audit_prod_advisory` — 9; `public_dependency_policy_advisory` — 2; `public_security_policy_advisory` — 1. Fix or explicitly govern the cited advisory. Distinguish the blocking Production audit from informational full-tree output.
- `public_typecheck_failure` — 7 and `public_unit_regression` — 9. These are product/test contract failures, not infrastructure noise.
- `typecheck_internal_retry` — the previous `typecheck:ci` wrapper retried once after a nonzero compiler result and could have turned a failed first invocation green. A retained-log re-search found its marker in 7 available abnormal runs (`29826051322`, `29829199266`, `29829836787`, `29830160392`, `29833137979`, `29833536346`, `29833894244`) and in 0 of all 1,755 available successful logs; one known typecheck failure (`29825302827`) has no available log. #360 removes the retry entirely and adds a fail-closed source contract. Any required wrapper that exits from a later successful invocation instead of preserving the first failure reopens this signature.
- `checkout_internal_retry` — successful runs `26329677499`, `26330714822`, `26332867420`. Checkout emitted `##[error]` and recovered internally. Always inspect error annotations and raw logs even on green.
- Historical Node action deprecation affected 1,628 successes and the unused `fileURLToPath` lint warning affected 360. Both disappeared after runtime/workflow cleanup; any recurrence reopens the signature.

### Preview migrations, data, and Storage

- `privileged_workflow_destination_or_revision_drift` — #360 security review. Any credential-bearing workflow URL must equal the repository-pinned Preview origin, and every privileged workflow must execute the reviewed event/input SHA rather than a floating branch. Database mutations must recheck runner `HEAD` and the current live ref immediately before apply.
- `private_storage_path_ci_logging` — #360 security review. Production Storage object paths are private evidence. Retry/failure output must use fixed operation labels, numeric status, and code-presence only; raw provider messages, provider code values, and `${objectPath}` interpolation in CI diagnostics are forbidden.
- `preview_sync_workflow_run_concurrency_cancel` — 51 cancellations. Only eligible successful `dev` push completions may use the shared queue; no-op events need a unique run-ID group.
- `preview_sync_manual_or_push_cancel` — 42 cancellations. Minimize operator dispatches and preserve one deliberate mutation at a time.
- `superseded_ci_concurrency_cancel` — 43 Public/lockfile/Storybook cancellations. These can be expected after a newer SHA, but they remain recorded and must not substitute for clean evidence on the final SHA.
- `preview_sync_remote_migration_apply_failure` — 23; standalone Preview migration apply failure — 2; legacy apply failure — 7; missing relation drift — 3; workflow/tooling failure — 4. Verify ordered local history, remote ledger parity, schema-first sequencing, and exact CLI/runtime versions.
- `preview_sync_data_storage_sync_failure` — 18 failures. Inspect the exact table/bucket stage, preserve sanitization, and require post-sync migration parity.
- `storage_provider_retry_recovered` — 6 successful runs: `26331599944` (504), `28006519761` (502), `29004176142`, `29426647566`, `29983736113`, `30180865391` (504). Recovery is useful but still abnormal evidence; record the provider failure and verify final parity.
- `storage_skip_green` — `29896920643` (400), `30698107430` (520). An object was skipped under an overall success. Any `Skipping object`, `Skipping bucket`, or skipped cleanup is degraded and blocks clean parity unless an explicit, reviewed optional-bucket contract says otherwise.
- `preview_database_fallback_green` — 8 successful runs: `26330465086`, `27111529103`, `27813814301`, `27817340422`, `27819595233`, `27819775977`, `31451615513`, `31454056487`. A missing tenant/user error used fallback. An intended fallback must be structurally reported and audited, never silently accepted as clean.

### Persistent successful-log noise

- npm `allow-scripts` warnings affected 641 successes. #360 does not rely on the advisory allow-list as the execution boundary: every Actions and Vercel install uses `npm run install:trusted` and `npm ci --ignore-scripts` with all lifecycle packages denied. It verifies the reviewed local archiver source, registry identities, common deployment-platform esbuild integrities, and directly executes only the installed pinned esbuild binary—not its installer. Static policy, root/workspace lifecycle, effective `ignore-scripts`/strict/dangerous overrides, registry identity, integrity drift, and unreviewed non-registry sources fail before installation. This is not effective until merged to `dev`, then `main`.
- `dependency_prepare_before_policy` — #360's security review confirmed that npm can execute git/directory `prepare` during package extraction before native allow-script preflight, and `dangerously-allow-all-scripts` can bypass strict mode. The trusted path disables all lifecycle execution, rejects the dangerous override and arbitrary git/URL/file sources, verifies the sole reviewed local package byte-for-byte, and never invokes an npm lifecycle installer. Any raw Actions/Vercel `npm ci`/`npm install`, root/workspace lifecycle, unreviewed non-registry source, or explicit installer reopens this merge-blocking signature.
- `secret_bearing_dependency_install` — the frozen audit did not expose a credential leak, but #360's threat-model review found Preview Sync and Admin Performance made service-role, database, session, gateway, and login credentials job-wide before dependency installation. Checkout also persisted the Actions token, and Vercel exposes build variables to custom install processes. #360 moves Actions secrets to exact post-install steps, disables checkout credential persistence, launches install children from a narrow environment allowlist, and starts the Vercel install command under `env -i`. Later Vercel build code still sees build-time variables and remains a separate supply-chain boundary. Any future job-level secret, persisted checkout credential, or unsanitized install environment combined with dependency installation reopens this merge-blocking signature.
- `audit_raw_text_persistence` — #360's security review proved that regex-redacted Action logs and annotations could retain synthetic Wallet-key, Mattermost-key, admin-cookie, quoted authorization, and future secret-name forms. The auditor now persists no GitHub-provided text at all: only fixed signature IDs/counts/line numbers, numeric indices, validated metadata, and field-presence booleans. It requires an explicit attempt, uses an attempt-specific URL, records incomplete log/annotation retrieval as non-clean, emits fixed error text only, strips ANSI before classification, and creates a new mode-0600 direct-child file without overwrite or symlink traversal. Any durable raw or “sanitized” log/annotation/name/path field, silent retrieval failure, mutable latest-attempt audit, or overwrite-capable output reopens this merge-blocking privacy signature.
- `raw_audit_artifact_permissions` — during #360 the full-history temporary corpus was found with a mode-0755 root and 12,885 mode-0644 files. No content was printed; the root was restricted to 0700 and every file to 0600, then fully rechecked. A full-census download must start under `umask 077`, create a 0700 root, produce 0600 files, and verify every mode immediately. Any broader mode blocks further inspection and remote rollout until contained.
- Informational positive full-tree audit summaries appeared in 746 successes. The Production dependency audit remains the blocking source of truth.
- E2E mock logging emitted `log_insert_failed`/`ingest_exception` in 404 successes and network `ECONNRESET`/`aborted`/`uncaughtException` in 415. Suppress only a proven exact mock-environment signature; new messages or non-mock occurrences remain abnormal.
- Cache save collisions appeared in 101 successes. They are post-job nonfatal, but repeated occurrences should be reduced with a single writer, unique key, or read-only cache policy.
- Historical npm package deprecations appeared in 115 successes. Any current recurrence requires package-specific evaluation.

## Mandatory entry for every new abnormal run

Append or extend the matching signature before the next remote trigger with:

- Run ID and immutable URL
- Local allowlisted workflow identifier, event, exact SHA, attempt, timestamps, and GitHub conclusion
- Numeric indices and conclusions for every failed or unexpectedly skipped job/step; each annotation's structural level/field-presence/line/signatures and an explicit collection-complete flag
- Fixed signature IDs/counts/line numbers plus an operator-authored safe cause summary; never raw or regex-redacted GitHub text
- Proven classification and rejected alternatives
- Repository fix or external-provider handling
- Executable regression/fail-closed contract
- First-attempt verification on the replacement SHA
- Rollout state on branch, PR, `dev`, and `main`
- Remaining risk or expired/unavailable-log boundary

Never delete or rewrite the original evidence. A rerun cannot replace a new-SHA first attempt.
