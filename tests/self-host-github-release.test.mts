import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { RELEASE_PROFILES, githubContext, githubReleaseProfile, imageReference, validateBundle, validatePublishedRelease, verifyRemoteRelease, verifyRemoteJobs } from "../scripts/self-host-ci/github-contract.mjs";

const sha = "a".repeat(40), hash = "b".repeat(64);
const environment = { GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "MyKnow/ssartnership", GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/dev", GITHUB_SHA: sha, GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1", GITHUB_WORKFLOW_REF: "MyKnow/ssartnership/.github/workflows/self-host-preview.yml@refs/heads/dev" };
const profile = RELEASE_PROFILES.preview;
const context = githubContext(environment, profile);
const bundle = (selected: typeof RELEASE_PROFILES[keyof typeof RELEASE_PROFILES] = profile) => ({ version: 1, ...context, platform: "linux/amd64", sourceHash: hash, gate: { tests: 103, failures: 0, errors: 0, skipped: 0, retries: 0, e2eRuntime: "production-test-only", fixtureBuildDeployable: false }, images: ["app", "telemetry", "database"].map(component => ({ component, tag: imageReference(component, sha, selected), id: `sha256:${hash}`, archive: `${component}.tar`, hash })) });
test("gate modules remain readable by arbitrary nonroot users after private source extraction", () => {
  const dockerfile = readFileSync(new URL("../deploy/self-host-ci/Dockerfile", import.meta.url), "utf8");
  const copies = dockerfile.split("\n").filter(line => line.startsWith("COPY ") && line.includes("/opt/ssartnership/"));
  assert.equal(copies.length, 4);
  for (const line of copies) assert.match(line, /^COPY --chmod=0(?:444|555) /);
  assert.match(dockerfile, /USER 1001:1001/);
  const release = readFileSync(new URL("../scripts/self-host-ci/github-release.mjs", import.meta.url), "utf8");
  assert.match(release, /process\.umask\(0o077\)/);
  assert.match(release, /"--read-only", "--cap-drop", "ALL"/);
  assert.match(release, /"--user", `\$\{process\.getuid\(\)\}:\$\{process\.getgid\(\)\}`/);
});
test("telemetry image also normalizes public source read permissions for its nonroot runtime", () => {
  const dockerfile = readFileSync(new URL("../deploy/observability/Dockerfile", import.meta.url), "utf8");
  const copies = dockerfile.split("\n").filter(line => line.startsWith("COPY "));
  assert.equal(copies.length, 3);
  assert.ok(copies.some(line => line.includes('deploy/observability/alert-delivery.mjs')));
  // COPY also creates nested destination directories with this mode.
  for (const line of copies) assert.match(line, /^COPY --chmod=0555 /);
  assert.match(dockerfile, /USER 1001:1001/);
});
test("GitHub release resolves only exact Preview or Production push first attempts", () => {
  for (const [key, value] of Object.entries({ GITHUB_ACTIONS: "false", GITHUB_REPOSITORY: "attacker/ssartnership", GITHUB_EVENT_NAME: "pull_request_target", GITHUB_REF: "refs/heads/main", GITHUB_RUN_ID: "9999999999999999", GITHUB_RUN_ATTEMPT: "2", GITHUB_SHA: "dev", GITHUB_WORKFLOW_REF: "other" })) {
    assert.throws(() => githubContext({ ...environment, [key]: value }, profile), /GITHUB_CONTEXT_INVALID/);
  }
  assert.equal(githubReleaseProfile(environment), profile);
  assert.equal(imageReference("app", sha, profile), `ghcr.io/myknow/ssartnership-app:dev-${sha}`);
  const productionEnvironment = { ...environment, GITHUB_REF: "refs/heads/main", GITHUB_WORKFLOW_REF: "MyKnow/ssartnership/.github/workflows/self-host-production.yml@refs/heads/main" };
  assert.equal(githubReleaseProfile(productionEnvironment), RELEASE_PROFILES.production);
  assert.doesNotThrow(() => githubContext(productionEnvironment, RELEASE_PROFILES.production));
  assert.equal(imageReference("app", sha, RELEASE_PROFILES.production), `ghcr.io/myknow/ssartnership-app:production-${sha}`);
  assert.throws(() => githubContext(productionEnvironment, profile), /GITHUB_CONTEXT_INVALID/);
  assert.throws(() => imageReference("../other", sha));
});
test("only complete, exact-SHA, retry-free three-image bundles can publish", () => {
  validateBundle(bundle(), context, profile);
  for (const key of ["failures", "errors", "skipped", "retries"] as const) {
    const changed = bundle(); changed.gate[key] = 1;
    assert.throws(() => validateBundle(changed, context, profile));
  }
  const changed = bundle(); changed.images[1] = changed.images[0];
  assert.throws(() => validateBundle(changed, context, profile));
  assert.throws(() => validateBundle({ ...bundle(), extra: "ignored?" }, context, profile));
  assert.throws(() => validateBundle({ ...bundle(), sha: "c".repeat(40) }, context, profile));
  assert.throws(() => validateBundle(bundle(), context, RELEASE_PROFILES.production));
});
test("server admission checks first-attempt run identity, latest dev, workflow and every digest", () => {
  const published = { ...bundle(), images: bundle().images.map(({ component, id }) => ({ component, id, digest: `sha256:${hash}`, reference: `${imageReference(component, sha).split(":")[0]}@sha256:${hash}` })) };
  validatePublishedRelease(published, context, profile);
  const run = { id: 123, run_attempt: 1, head_sha: sha, head_branch: "dev", event: "push", status: "completed", conclusion: "success", path: ".github/workflows/self-host-preview.yml", repository: { full_name: "MyKnow/ssartnership" }, head_repository: { full_name: "MyKnow/ssartnership" } };
  verifyRemoteRelease(published, run, sha, profile);
  for (const mutation of [{ conclusion: "failure" }, { run_attempt: 2 }, { head_sha: "c".repeat(40) }, { path: ".github/workflows/other.yml" }, { head_repository: { full_name: "fork/repo" } }]) assert.throws(() => verifyRemoteRelease(published, { ...run, ...mutation }, sha, profile));
  assert.throws(() => verifyRemoteRelease(published, run, "c".repeat(40), profile));
  assert.throws(() => validatePublishedRelease({ ...published, images: published.images.map(item => ({ ...item, reference: "ghcr.io/attacker/app:latest" })) }, context, profile));
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
  const production = readFileSync(new URL("../.github/workflows/self-host-production.yml", import.meta.url), "utf8");
  assert.match(production, /branches: \[main\]/);
  assert.match(production, /environment: Production/);
  assert.match(production, /PRODUCTION_VAPID_PUBLIC_KEY: \$\{\{ vars\.PRODUCTION_VAPID_PUBLIC_KEY \}\}/);
  assert.match(production, /ssartnership-production-release/);
  assert.doesNotMatch(production, /pull_request|workflow_run|self-hosted|SSH_PRIVATE|SUPABASE_SERVICE_ROLE|continue-on-error|npm ci/);
});
test("green aggregate cannot admit missing, skipped, retried or failed publication steps", () => {
  const rows = [
    ["Isolated AMD64 Release Gate", ["Build without publishing credentials", "Upload only validated image archives"]],
    ["Publish Verified Preview Images", ["Authenticate registry for publication only", "Verify archives and current dev before publication", "Publish immutable deployment manifest", "Remove registry session"]],
  ] as const;
  const jobs = rows.map(([name, steps]) => ({ name, run_id: context.runId, run_attempt: 1, head_sha: sha, status: "completed", conclusion: "success", steps: steps.map(name => ({ name, status: "completed", conclusion: "success" })) }));
  assert.equal(verifyRemoteJobs(jobs, context, profile), true);
  assert.throws(() => verifyRemoteJobs(jobs.slice(0, 1), context, profile));
  for (const change of [{ run_attempt: 2 }, { head_sha: "c".repeat(40) }, { conclusion: "failure" }, { name: "Unknown" }, { steps: [] }]) assert.throws(() => verifyRemoteJobs([jobs[0], { ...jobs[1], ...change }], context, profile));
  for (const conclusion of ["skipped", "failure", "cancelled"]) {
    const changed = structuredClone(jobs); changed[1].steps[2].conclusion = conclusion;
    assert.throws(() => verifyRemoteJobs(changed, context, profile));
  }
  const duplicate = structuredClone(jobs); duplicate[1].steps.push(duplicate[1].steps[2]);
  assert.throws(() => verifyRemoteJobs(duplicate, context, profile));
});

test("reviewed critical suite floor accepts the reduced inventory and rejects partial bundles", () => {
  for (const selected of Object.values(RELEASE_PROFILES)) {
    const complete = bundle(selected);
    complete.gate.tests = 76;
    assert.doesNotThrow(() => validateBundle(complete, context, selected));
    for (const count of [0, 1, 75, 75.5, NaN]) {
      assert.throws(() => validateBundle({ ...complete, gate: { ...complete.gate, tests: count } }, context, selected), /GITHUB_GATE_INVALID/);
    }
  }
});
