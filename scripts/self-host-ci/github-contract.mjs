import { COMPONENTS, SHA, HASH } from "./lib.mjs";

export const GITHUB_REPOSITORY = "MyKnow/ssartnership";
export const WORKFLOW_PATH = ".github/workflows/self-host-preview.yml";
export const SITE_ORIGIN = "https://ssartnership-dev.myknow.xyz";
export const API_ORIGIN = "https://ssartnership-api-dev.myknow.xyz";
const die = code => { throw new Error(code); };
function keys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== [...expected].sort().join()) die("GITHUB_FIELDS_INVALID");
}
/** @param {Record<string, string | undefined>} env */
export function githubContext(env = process.env) {
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== GITHUB_REPOSITORY || env.GITHUB_EVENT_NAME !== "push"
    || env.GITHUB_REF !== "refs/heads/dev" || !SHA.test(env.GITHUB_SHA) || !/^[1-9][0-9]{0,15}$/u.test(env.GITHUB_RUN_ID)
    || !Number.isSafeInteger(Number(env.GITHUB_RUN_ID)) || env.GITHUB_RUN_ATTEMPT !== "1"
    || env.GITHUB_WORKFLOW_REF !== `${GITHUB_REPOSITORY}/${WORKFLOW_PATH}@refs/heads/dev`) die("GITHUB_CONTEXT_INVALID");
  return { repository: GITHUB_REPOSITORY, sha: env.GITHUB_SHA, runId: Number(env.GITHUB_RUN_ID), attempt: 1 };
}
export function imageReference(component, sha) {
  if (!COMPONENTS.includes(component) || !SHA.test(sha)) die("GITHUB_IMAGE_INVALID");
  return `ghcr.io/myknow/ssartnership-${component}:dev-${sha}`;
}
function envelope(value, context) {
  keys(value, ["version", "repository", "sha", "runId", "attempt", "platform", "sourceHash", "gate", "images"]);
  if (value.version !== 1 || value.repository !== GITHUB_REPOSITORY || !SHA.test(value.sha) || value.sha !== context.sha
    || value.runId !== context.runId || !Number.isSafeInteger(value.runId) || value.runId <= 0 || value.attempt !== 1
    || value.platform !== "linux/amd64" || !HASH.test(value.sourceHash)) die("GITHUB_RELEASE_INVALID");
  keys(value.gate, ["tests", "failures", "errors", "skipped", "retries", "e2eRuntime", "fixtureBuildDeployable"]);
  if (!Number.isSafeInteger(value.gate.tests) || value.gate.tests < 103 || ["failures", "errors", "skipped", "retries"].some(key => value.gate[key] !== 0)
    || value.gate.e2eRuntime !== "production-test-only" || value.gate.fixtureBuildDeployable !== false) die("GITHUB_GATE_INVALID");
  if (!Array.isArray(value.images) || value.images.length !== COMPONENTS.length) die("GITHUB_IMAGES_INVALID");
}
export function validateBundle(value, context) {
  envelope(value, context);
  value.images.forEach((image, index) => {
    keys(image, ["component", "tag", "id", "archive", "hash"]);
    if (image.component !== COMPONENTS[index] || image.tag !== imageReference(image.component, value.sha)
      || image.archive !== `${image.component}.tar` || !/^sha256:[a-f0-9]{64}$/u.test(image.id) || !HASH.test(image.hash)) die("GITHUB_IMAGE_INVALID");
  });
  return value;
}
export function validatePublishedRelease(value, context) {
  envelope(value, context);
  value.images.forEach((image, index) => {
    keys(image, ["component", "id", "digest", "reference"]);
    if (image.component !== COMPONENTS[index] || !/^sha256:[a-f0-9]{64}$/u.test(image.id) || !/^sha256:[a-f0-9]{64}$/u.test(image.digest)
      || image.reference !== `${imageReference(image.component, value.sha).split(":")[0]}@${image.digest}`) die("GITHUB_IMAGE_INVALID");
  });
  return value;
}
// API metadata must be obtained independently by the server from pinned
// api.github.com endpoints. A downloaded manifest is never its own authority.
export function verifyRemoteRelease(manifest, run, liveDevSha) {
  validatePublishedRelease(manifest, { sha: liveDevSha, runId: run.id });
  if (run.repository?.full_name !== GITHUB_REPOSITORY || run.head_repository?.full_name !== GITHUB_REPOSITORY
    || run.head_sha !== liveDevSha || run.head_branch !== "dev" || run.event !== "push" || run.run_attempt !== 1
    || run.status !== "completed" || run.conclusion !== "success" || run.path !== WORKFLOW_PATH) die("GITHUB_RUN_NOT_APPROVED");
  return manifest;
}

// The aggregate conclusion alone is insufficient: independently fetched jobs
// must include the required build/publication steps without skipped failures.
export function verifyRemoteJobs(jobs, context) {
  const required = {
    "Isolated AMD64 Release Gate": ["Build without publishing credentials", "Upload only validated image archives"],
    "Publish Verified Preview Images": ["Authenticate registry for publication only", "Verify archives and current dev before publication", "Publish immutable deployment manifest", "Remove registry session"],
  };
  if (!Array.isArray(jobs) || jobs.length !== 2 || new Set(jobs.map(job => job.name)).size !== 2) die("GITHUB_JOBS_NOT_APPROVED");
  for (const job of jobs) {
    const names = required[job.name];
    if (!names || job.run_id !== context.runId || job.run_attempt !== 1 || job.head_sha !== context.sha
      || job.status !== "completed" || job.conclusion !== "success" || !Array.isArray(job.steps)
      || job.steps.some(step => step.status !== "completed" || step.conclusion !== "success")
      || names.some(name => job.steps.filter(step => step.name === name).length !== 1)) die("GITHUB_JOBS_NOT_APPROVED");
  }
  return true;
}
