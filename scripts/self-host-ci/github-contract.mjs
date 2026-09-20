import { COMPONENTS, SHA, HASH } from "./lib.mjs";

export const GITHUB_REPOSITORY = "MyKnow/ssartnership";

export const RELEASE_PROFILES = Object.freeze({
  preview: Object.freeze({
    name: "preview", branch: "dev", ref: "refs/heads/dev",
    workflowPath: ".github/workflows/self-host-preview.yml",
    artifactName: "ssartnership-preview-release", imageTag: "dev",
    siteOrigin: "https://ssartnership-dev.myknow.xyz",
    apiOrigin: "https://ssartnership-api-dev.myknow.xyz",
    publishJob: "Publish Verified Preview Images",
    verifyStep: "Verify archives and current dev before publication",
  }),
  production: Object.freeze({
    name: "production", branch: "main", ref: "refs/heads/main",
    workflowPath: ".github/workflows/self-host-production.yml",
    artifactName: "ssartnership-production-release", imageTag: "production",
    siteOrigin: "https://ssartnership.myknow.xyz",
    apiOrigin: "https://ssartnership-api.myknow.xyz",
    publishJob: "Publish Verified Production Images",
    verifyStep: "Verify archives and current main before publication",
  }),
});

/** @typedef {typeof RELEASE_PROFILES.preview | typeof RELEASE_PROFILES.production} ReleaseProfile */

const die = code => { throw new Error(code); };
/** @param {ReleaseProfile} profile */
const approvedProfile = profile => {
  if (!Object.values(RELEASE_PROFILES).includes(profile)) die("GITHUB_PROFILE_INVALID");
  return profile;
};

function keys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== [...expected].sort().join()) die("GITHUB_FIELDS_INVALID");
}

/** @param {Record<string, string | undefined>} env */
export function githubReleaseProfile(env = process.env) {
  const matches = Object.values(RELEASE_PROFILES).filter(profile => env.GITHUB_REF === profile.ref
    && env.GITHUB_WORKFLOW_REF === `${GITHUB_REPOSITORY}/${profile.workflowPath}@${profile.ref}`);
  if (matches.length !== 1) die("GITHUB_CONTEXT_INVALID");
  return matches[0];
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {ReleaseProfile} [profile]
 */
export function githubContext(env = process.env, profile = githubReleaseProfile(env)) {
  approvedProfile(profile);
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY !== GITHUB_REPOSITORY || env.GITHUB_EVENT_NAME !== "push"
    || env.GITHUB_REF !== profile.ref || !SHA.test(env.GITHUB_SHA ?? "") || !/^[1-9][0-9]{0,15}$/u.test(env.GITHUB_RUN_ID ?? "")
    || !Number.isSafeInteger(Number(env.GITHUB_RUN_ID)) || env.GITHUB_RUN_ATTEMPT !== "1"
    || env.GITHUB_WORKFLOW_REF !== `${GITHUB_REPOSITORY}/${profile.workflowPath}@${profile.ref}`) die("GITHUB_CONTEXT_INVALID");
  return { repository: GITHUB_REPOSITORY, sha: env.GITHUB_SHA, runId: Number(env.GITHUB_RUN_ID), attempt: 1 };
}

/** @param {ReleaseProfile} [profile] */
export function imageReference(component, sha, profile = RELEASE_PROFILES.preview) {
  approvedProfile(profile);
  if (!COMPONENTS.includes(component) || !SHA.test(sha)) die("GITHUB_IMAGE_INVALID");
  return `ghcr.io/myknow/ssartnership-${component}:${profile.imageTag}-${sha}`;
}

/** @param {ReleaseProfile} profile */
function envelope(value, context, profile) {
  approvedProfile(profile);
  keys(value, ["version", "repository", "sha", "runId", "attempt", "platform", "sourceHash", "gate", "images"]);
  if (value.version !== 1 || value.repository !== GITHUB_REPOSITORY || !SHA.test(value.sha) || value.sha !== context.sha
    || value.runId !== context.runId || !Number.isSafeInteger(value.runId) || value.runId <= 0 || value.attempt !== 1
    || value.platform !== "linux/amd64" || !HASH.test(value.sourceHash)) die("GITHUB_RELEASE_INVALID");
  keys(value.gate, ["tests", "failures", "errors", "skipped", "retries", "e2eRuntime", "fixtureBuildDeployable"]);
  if (!Number.isSafeInteger(value.gate.tests) || value.gate.tests < 103 || ["failures", "errors", "skipped", "retries"].some(key => value.gate[key] !== 0)
    || value.gate.e2eRuntime !== "production-test-only" || value.gate.fixtureBuildDeployable !== false) die("GITHUB_GATE_INVALID");
  if (!Array.isArray(value.images) || value.images.length !== COMPONENTS.length) die("GITHUB_IMAGES_INVALID");
}

/** @param {ReleaseProfile} [profile] */
export function validateBundle(value, context, profile = RELEASE_PROFILES.preview) {
  envelope(value, context, profile);
  value.images.forEach((image, index) => {
    keys(image, ["component", "tag", "id", "archive", "hash"]);
    if (image.component !== COMPONENTS[index] || image.tag !== imageReference(image.component, value.sha, profile)
      || image.archive !== `${image.component}.tar` || !/^sha256:[a-f0-9]{64}$/u.test(image.id) || !HASH.test(image.hash)) die("GITHUB_IMAGE_INVALID");
  });
  return value;
}

/** @param {ReleaseProfile} [profile] */
export function validatePublishedRelease(value, context, profile = RELEASE_PROFILES.preview) {
  envelope(value, context, profile);
  value.images.forEach((image, index) => {
    keys(image, ["component", "id", "digest", "reference"]);
    if (image.component !== COMPONENTS[index] || !/^sha256:[a-f0-9]{64}$/u.test(image.id) || !/^sha256:[a-f0-9]{64}$/u.test(image.digest)
      || image.reference !== `${imageReference(image.component, value.sha, profile).split(":")[0]}@${image.digest}`) die("GITHUB_IMAGE_INVALID");
  });
  return value;
}

/** @param {ReleaseProfile} [profile] */
export function verifyRemoteRelease(manifest, run, liveSha, profile = RELEASE_PROFILES.preview) {
  approvedProfile(profile);
  validatePublishedRelease(manifest, { sha: liveSha, runId: run.id }, profile);
  if (run.repository?.full_name !== GITHUB_REPOSITORY || run.head_repository?.full_name !== GITHUB_REPOSITORY
    || run.head_sha !== liveSha || run.head_branch !== profile.branch || run.event !== "push" || run.run_attempt !== 1
    || run.status !== "completed" || run.conclusion !== "success" || run.path !== profile.workflowPath) die("GITHUB_RUN_NOT_APPROVED");
  return manifest;
}

/** @param {ReleaseProfile} [profile] */
export function verifyRemoteJobs(jobs, context, profile = RELEASE_PROFILES.preview) {
  approvedProfile(profile);
  const required = {
    "Isolated AMD64 Release Gate": ["Build without publishing credentials", "Upload only validated image archives"],
    [profile.publishJob]: ["Authenticate registry for publication only", profile.verifyStep, "Publish immutable deployment manifest", "Remove registry session"],
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
