import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { githubContext, imageReference, validateBundle, validatePublishedRelease, verifyRemoteRelease, verifyRemoteJobs } from "../scripts/self-host-ci/github-contract.mjs";

const sha = "a".repeat(40), hash = "b".repeat(64);
const environment = { GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "MyKnow/ssartnership", GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/dev", GITHUB_SHA: sha, GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1", GITHUB_WORKFLOW_REF: "MyKnow/ssartnership/.github/workflows/self-host-preview.yml@refs/heads/dev" };
const context = githubContext(environment);
const bundle = () => ({ version: 1, ...context, platform: "linux/amd64", sourceHash: hash, gate: { tests: 103, failures: 0, errors: 0, skipped: 0, retries: 0, e2eRuntime: "production-test-only", fixtureBuildDeployable: false }, images: ["app", "telemetry", "database"].map(component => ({ component, tag: imageReference(component, sha), id: `sha256:${hash}`, archive: `${component}.tar`, hash })) });
test("GitHub release accepts only the exact dev push first attempt", () => {
  for (const [key, value] of Object.entries({ GITHUB_ACTIONS: "false", GITHUB_REPOSITORY: "attacker/ssartnership", GITHUB_EVENT_NAME: "pull_request_target", GITHUB_REF: "refs/heads/main", GITHUB_RUN_ID: "9999999999999999", GITHUB_RUN_ATTEMPT: "2", GITHUB_SHA: "dev", GITHUB_WORKFLOW_REF: "other" })) {
    assert.throws(() => githubContext({ ...environment, [key]: value }), /GITHUB_CONTEXT_INVALID/);
  }
  assert.equal(imageReference("app", sha), `ghcr.io/myknow/ssartnership-app:dev-${sha}`);
  assert.throws(() => imageReference("../other", sha));
});
test("only complete, exact-SHA, retry-free three-image bundles can publish", () => {
  validateBundle(bundle(), context);
  for (const key of ["failures", "errors", "skipped", "retries"] as const) {
    const changed = bundle(); changed.gate[key] = 1;
    assert.throws(() => validateBundle(changed, context));
  }
  const changed = bundle(); changed.images[1] = changed.images[0];
  assert.throws(() => validateBundle(changed, context));
  assert.throws(() => validateBundle({ ...bundle(), extra: "ignored?" }, context));
  assert.throws(() => validateBundle({ ...bundle(), sha: "c".repeat(40) }, context));
});
test("server admission checks first-attempt run identity, latest dev, workflow and every digest", () => {
  const published = { ...bundle(), images: bundle().images.map(({ component, id }) => ({ component, id, digest: `sha256:${hash}`, reference: `${imageReference(component, sha).split(":")[0]}@sha256:${hash}` })) };
  validatePublishedRelease(published, context);
  const run = { id: 123, run_attempt: 1, head_sha: sha, head_branch: "dev", event: "push", status: "completed", conclusion: "success", path: ".github/workflows/self-host-preview.yml", repository: { full_name: "MyKnow/ssartnership" }, head_repository: { full_name: "MyKnow/ssartnership" } };
  verifyRemoteRelease(published, run, sha);
  for (const mutation of [{ conclusion: "failure" }, { run_attempt: 2 }, { head_sha: "c".repeat(40) }, { path: ".github/workflows/other.yml" }, { head_repository: { full_name: "fork/repo" } }]) assert.throws(() => verifyRemoteRelease(published, { ...run, ...mutation }, sha));
  assert.throws(() => verifyRemoteRelease(published, run, "c".repeat(40)));
  assert.throws(() => validatePublishedRelease({ ...published, images: published.images.map(item => ({ ...item, reference: "ghcr.io/attacker/app:latest" })) }, context));
});
test("workflow separates unprivileged build from publication and has no server credential or PR trigger", () => {
  const workflow = readFileSync(new URL("../.github/workflows/self-host-preview.yml", import.meta.url), "utf8");
  assert.match(workflow, /branches: \[dev\]/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /needs: build/);
  assert.match(workflow, /packages: write/);
  assert.doesNotMatch(workflow, /pull_request|workflow_run|self-hosted|SSH_PRIVATE|SUPABASE_SERVICE_ROLE|continue-on-error|npm ci/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /github-release\.mjs build/);
  assert.match(workflow, /github-release\.mjs publish/);
  const gate = readFileSync(new URL("../deploy/self-host-ci/gate.mjs", import.meta.url), "utf8");
  assert.match(gate, /github-amd64/);
});
test("green aggregate cannot admit missing, skipped, retried or failed publication steps", () => {
  const rows = [
    ["Isolated AMD64 Release Gate", ["Build without publishing credentials", "Upload only validated image archives"]],
    ["Publish Verified Preview Images", ["Authenticate registry for publication only", "Verify archives and current dev before publication", "Publish immutable deployment manifest", "Remove registry session"]],
  ] as const;
  const jobs = rows.map(([name, steps]) => ({ name, run_id: context.runId, run_attempt: 1, head_sha: sha, status: "completed", conclusion: "success", steps: steps.map(name => ({ name, status: "completed", conclusion: "success" })) }));
  assert.equal(verifyRemoteJobs(jobs, context), true);
  assert.throws(() => verifyRemoteJobs(jobs.slice(0, 1), context));
  for (const change of [{ run_attempt: 2 }, { head_sha: "c".repeat(40) }, { conclusion: "failure" }, { name: "Unknown" }, { steps: [] }]) assert.throws(() => verifyRemoteJobs([jobs[0], { ...jobs[1], ...change }], context));
  for (const conclusion of ["skipped", "failure", "cancelled"]) {
    const changed = structuredClone(jobs); changed[1].steps[2].conclusion = conclusion;
    assert.throws(() => verifyRemoteJobs(changed, context));
  }
  const duplicate = structuredClone(jobs); duplicate[1].steps.push(duplicate[1].steps[2]);
  assert.throws(() => verifyRemoteJobs(duplicate, context));
});
