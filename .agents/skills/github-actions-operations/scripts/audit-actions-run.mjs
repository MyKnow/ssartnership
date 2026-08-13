#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

function usage() {
  process.stdout.write(
    "Usage: audit-actions-run.mjs --repo OWNER/REPO --run-id ID --attempt N [--output FILE]\n",
  );
}

function parseArgs(argv) {
  const result = { repo: "", runId: "", attempt: "", output: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      usage();
      process.exit(0);
    }
    if (
      value === "--repo"
      || value === "--run-id"
      || value === "--attempt"
      || value === "--output"
    ) {
      const next = argv[index + 1];
      if (!next) throw new Error(`${value} requires a value`);
      const key = value === "--run-id"
        ? "runId"
        : value === "--repo"
          ? "repo"
          : value === "--attempt"
            ? "attempt"
            : "output";
      result[key] = next;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${value}`);
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(result.repo)) {
    throw new Error("--repo must be OWNER/REPO");
  }
  if (!/^\d+$/.test(result.runId)) throw new Error("--run-id must be numeric");
  if (!/^[1-9]\d*$/.test(result.attempt)) {
    throw new Error("--attempt must be a positive integer");
  }
  return result;
}

function gh(args, { allowFailure = false } = {}) {
  try {
    return execFileSync("gh", args, {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    if (!allowFailure) throw new Error("github_command_failed");
    return null;
  }
}

function parseProviderJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("github_json_invalid");
  }
}

export function resolveSafeOutputPath(output, cwd = process.cwd()) {
  const auditRoot = resolve(cwd, ".tmp/actions-audit");
  const target = resolve(cwd, output);
  if (!target.startsWith(`${auditRoot}${sep}`)) {
    throw new Error("--output must be inside .tmp/actions-audit/");
  }
  return { auditRoot, target };
}

export function writeAuditFile(output, serialized, cwd = process.cwd()) {
  const { auditRoot, target } = resolveSafeOutputPath(output, cwd);
  const tmpRoot = resolve(cwd, ".tmp");
  if (realpathSync(cwd) !== cwd) {
    throw new Error("the working directory must be a canonical, non-symlink path");
  }
  if (existsAndIsSymbolicLink(tmpRoot)) {
    throw new Error(".tmp must not be a symbolic link");
  }
  mkdirSync(tmpRoot, { recursive: true, mode: 0o700 });
  mkdirSync(auditRoot, { recursive: true, mode: 0o700 });
  if (existsAndIsSymbolicLink(auditRoot)) {
    throw new Error(".tmp/actions-audit must not be a symbolic link");
  }
  const parent = dirname(target);
  if (parent !== auditRoot) {
    throw new Error("--output must be a direct child of .tmp/actions-audit/");
  }
  const realRoot = realpathSync(auditRoot);
  const realParent = realpathSync(parent);
  if (realRoot !== resolve(cwd, ".tmp/actions-audit") || realParent !== realRoot) {
    throw new Error("--output parent escapes .tmp/actions-audit/");
  }

  let descriptor;
  try {
    descriptor = openSync(
      target,
      constants.O_CREAT
        | constants.O_EXCL
        | constants.O_WRONLY
        | (constants.O_NOFOLLOW ?? 0),
      0o600,
    );
    const file = fstatSync(descriptor);
    if (!file.isFile() || file.nlink !== 1) {
      throw new Error("--output must be a newly created regular file");
    }
    writeFileSync(descriptor, serialized, { encoding: "utf8" });
    fchmodSync(descriptor, 0o600);
    fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function existsAndIsSymbolicLink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

const signatures = [
  ["hidden_retry", /\bflaky\b|retry\s+#|passed\s+on\s+retry/i],
  ["typecheck_retry", /\[typecheck-ci\].*(?:재시도|retry)/i],
  ["failed_attempt_marker", /✘/u],
  ["test_failure", /(?:^|\s)[1-9]\d*\s+failed(?:\s|$)|failed tests?\s+[1-9]\d*/i],
  ["testing_library", /testinglibraryelementerror|unable to find an element/i],
  ["github_error", /##\[error\]/i],
  ["docker_registry", /registry-1\.docker\.io|unable to find image|502 bad gateway/i],
  ["browser_missing", /executable doesn't exist|browsertype\.launch/i],
  ["visual_drift", /screenshot comparison failed|pixelmatch|visual baseline/i],
  ["sync_missing_object", /missing\s+\d+\s+synchronized object/i],
  ["migration_failure", /migrations?_failed|migration.*(?:failed|error)/i],
  ["timeout", /timed?\s*out|timeout exceeded/i],
  ["deprecation", /deprecated|deprecation/i],
  ["github_warning", /##\[warning\]/i],
  ["storage_retry", /failed on attempt\s+\d+\/\d+/i],
  ["storage_skip", /skipping (?:object|bucket|stale-object cleanup)/i],
  ["database_fallback", /tenant\/user.*not found|fallback.*(?:database|pooler)/i],
  ["mock_server_error", /log_insert_failed|ingest_exception|econnreset|uncaughtexception|\baborted\b/i],
  ["cache_collision", /unable to reserve cache|another job may be creating this cache/i],
  ["npm_policy_warning", /allow-scripts|npm warn deprecated/i],
];

const ansiEscapePattern = /[\u001B\u009B][[\]()#;?]*(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

const safeEvents = new Set([
  "merge_group",
  "pull_request",
  "push",
  "release",
  "repository_dispatch",
  "schedule",
  "workflow_dispatch",
  "workflow_run",
]);
const safeStatuses = new Set(["completed", "in_progress", "pending", "queued", "requested", "waiting"]);
const safeConclusions = new Set([
  "action_required",
  "cancelled",
  "failure",
  "neutral",
  "skipped",
  "stale",
  "startup_failure",
  "success",
  "timed_out",
]);
const safeAnnotationLevels = new Set(["failure", "notice", "warning"]);

function safeEnum(value, allowed) {
  return typeof value === "string" && allowed.has(value) ? value : "unknown";
}

function safeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function safeTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function safeSha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/i.test(value)
    ? value.toLowerCase()
    : null;
}

export function signatureNamesForText(text) {
  if (typeof text !== "string") return [];
  const normalizedText = text.replace(ansiEscapePattern, "");
  const passedTestDescription = /(?:^|\s)[✔✓]\s|(?:^|\t)\s*ok\s+\d+\s+-/u
    .test(normalizedText);
  return signatures
    .filter(([name, pattern]) =>
      !(passedTestDescription && (name === "timeout" || name === "deprecation"))
        && pattern.test(normalizedText))
    .map(([name]) => name);
}

function summarizeLogSignatures(log) {
  if (typeof log !== "string") return {};
  const summary = Object.fromEntries(
    signatures.map(([name]) => [name, { count: 0, firstLineNumbers: [] }]),
  );
  const lines = log.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    for (const name of signatureNamesForText(lines[lineIndex])) {
      summary[name].count += 1;
      if (summary[name].firstLineNumbers.length < 20) {
        summary[name].firstLineNumbers.push(lineIndex + 1);
      }
    }
  }

  return Object.fromEntries(
    Object.entries(summary).filter(([, value]) => value.count > 0),
  );
}

export function buildSafeReport({
  repository,
  runId,
  attempt,
  metadata,
  rawAnnotations,
  annotationQueries,
  log,
  auditedAt = new Date().toISOString(),
}) {
  const rawJobs = Array.isArray(metadata?.jobs) ? metadata.jobs : [];
  const jobs = rawJobs.map((job, jobIndex) => ({
    jobIndex,
    databaseId: safeInteger(job?.databaseId),
    status: safeEnum(job?.status, safeStatuses),
    conclusion: safeEnum(job?.conclusion, safeConclusions),
    startedAt: safeTimestamp(job?.startedAt),
    completedAt: safeTimestamp(job?.completedAt),
    steps: (Array.isArray(job?.steps) ? job.steps : []).map((step, stepIndex) => ({
      stepIndex,
      stepNumber: safeInteger(step?.number),
      status: safeEnum(step?.status, safeStatuses),
      conclusion: safeEnum(step?.conclusion, safeConclusions),
      startedAt: safeTimestamp(step?.startedAt),
      completedAt: safeTimestamp(step?.completedAt),
    })),
  }));
  const failedJobs = jobs
    .filter((job) => job.conclusion === "failure")
    .map(({ jobIndex, databaseId }) => ({ jobIndex, databaseId }));
  const skippedJobs = jobs
    .filter((job) => job.conclusion === "skipped")
    .map(({ jobIndex, databaseId }) => ({ jobIndex, databaseId }));
  const failedSteps = jobs.flatMap((job) =>
    job.steps
      .filter((step) => step.conclusion === "failure")
      .map(({ stepIndex, stepNumber }) => ({
        jobIndex: job.jobIndex,
        jobDatabaseId: job.databaseId,
        stepIndex,
        stepNumber,
      })),
  );
  const annotations = (Array.isArray(rawAnnotations) ? rawAnnotations : []).map(
    ({ jobIndex, jobDatabaseId, annotation }) => ({
      jobIndex: safeInteger(jobIndex),
      jobDatabaseId: safeInteger(jobDatabaseId),
      level: safeEnum(annotation?.annotation_level, safeAnnotationLevels),
      titlePresent: typeof annotation?.title === "string" && annotation.title.length > 0,
      messagePresent: typeof annotation?.message === "string" && annotation.message.length > 0,
      pathPresent: typeof annotation?.path === "string" && annotation.path.length > 0,
      startLine: safeInteger(annotation?.start_line),
      endLine: safeInteger(annotation?.end_line),
      signatures: signatureNamesForText(
        `${typeof annotation?.title === "string" ? annotation.title : ""}\n${typeof annotation?.message === "string" ? annotation.message : ""}`,
      ),
    }),
  );
  const annotationCollection = (Array.isArray(annotationQueries)
    ? annotationQueries
    : []).map(({ jobIndex, jobDatabaseId, available }) => ({
    jobIndex: safeInteger(jobIndex),
    jobDatabaseId: safeInteger(jobDatabaseId),
    available: available === true,
  }));
  const annotationCollectionComplete = annotationCollection.length === jobs.length
    && annotationCollection.every((query) => query.available);
  const conclusion = safeEnum(metadata?.conclusion, safeConclusions);
  const event = safeEnum(metadata?.event, safeEvents);
  const headSha = safeSha(metadata?.headSha);
  const createdAt = safeTimestamp(metadata?.createdAt);
  const updatedAt = safeTimestamp(metadata?.updatedAt);
  const requestedRunId = safeInteger(Number(runId));
  const requestedAttempt = safeInteger(attempt);
  const metadataRunId = safeInteger(metadata?.databaseId);
  const metadataAttempt = safeInteger(metadata?.attempt);
  const logAvailable = typeof log === "string";
  const terminalMetadata = metadata?.status === "completed"
    && conclusion !== "unknown"
    && jobs.every(
      (job) => job.status === "completed"
        && job.conclusion !== "unknown"
        && job.steps.every(
          (step) => step.status === "completed" && step.conclusion !== "unknown",
        ),
    );
  const identityMetadataComplete = event !== "unknown"
    && headSha !== null
    && createdAt !== null
    && updatedAt !== null
    && requestedRunId !== null
    && requestedAttempt !== null
    && metadataRunId === requestedRunId
    && metadataAttempt === requestedAttempt;
  const auditComplete = logAvailable
    && annotationCollectionComplete
    && terminalMetadata
    && identityMetadataComplete;

  return {
    auditedAt: safeTimestamp(auditedAt),
    repository,
    run: {
      databaseId: metadataRunId ?? requestedRunId,
      url: `https://github.com/${repository}/actions/runs/${runId}/attempts/${attempt}`,
      workflowNamePresent:
        typeof metadata?.workflowName === "string" && metadata.workflowName.length > 0,
      event,
      status: safeEnum(metadata?.status, safeStatuses),
      conclusion,
      attempt: requestedAttempt,
      metadataAttempt,
      headSha,
      createdAt,
      updatedAt,
      jobs,
    },
    integrity: {
      successWithFailedJobs: conclusion === "success" && failedJobs.length > 0,
      failedJobs,
      skippedJobs,
      failedSteps,
      annotationCollectionComplete,
      terminalMetadata,
      identityMetadataComplete,
      auditComplete,
    },
    annotationCollection,
    annotations,
    logAvailable,
    signatures: summarizeLogSignatures(log),
    note:
      "This report stores fixed classifications, counts, indices, and validated metadata only. It never persists GitHub-provided log, annotation, workflow, job, step, or path text.",
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const metadata = parseProviderJson(
    gh([
      "run",
      "view",
      options.runId,
      "--attempt",
      options.attempt,
      "--repo",
      options.repo,
      "--json",
      "databaseId,workflowName,event,status,conclusion,attempt,headSha,createdAt,updatedAt,url,jobs",
    ]),
  );
  if (safeInteger(metadata?.attempt) !== Number(options.attempt)) {
    throw new Error("GitHub returned metadata for a different run attempt");
  }
  if (
    safeInteger(metadata?.databaseId) !== Number(options.runId)
    || !Number.isSafeInteger(Number(options.runId))
  ) {
    throw new Error("GitHub returned metadata for a different run ID");
  }
  const rawAnnotations = [];
  const annotationQueries = [];
  const rawJobs = Array.isArray(metadata.jobs) ? metadata.jobs : [];
  for (let jobIndex = 0; jobIndex < rawJobs.length; jobIndex += 1) {
    const job = rawJobs[jobIndex];
    if (!Number.isSafeInteger(job?.databaseId)) {
      annotationQueries.push({
        jobIndex,
        jobDatabaseId: null,
        available: false,
      });
      continue;
    }
    const response = gh(
      [
        "api",
        `repos/${options.repo}/check-runs/${job.databaseId}/annotations?per_page=100`,
        "--paginate",
        "--slurp",
      ],
      { allowFailure: true },
    );
    annotationQueries.push({
      jobIndex,
      jobDatabaseId: job.databaseId,
      available: response !== null,
    });
    if (response === null) continue;
    const parsedAnnotations = parseProviderJson(response);
    if (!Array.isArray(parsedAnnotations)) {
      throw new Error("github_annotations_invalid");
    }
    for (const annotation of parsedAnnotations.flat()) {
      rawAnnotations.push({
        jobIndex,
        jobDatabaseId: job.databaseId,
        annotation,
      });
    }
  }
  const log = gh(
    [
      "run",
      "view",
      options.runId,
      "--repo",
      options.repo,
      "--attempt",
      options.attempt,
      "--log",
    ],
    { allowFailure: true },
  );
  const report = buildSafeReport({
    repository: options.repo,
    runId: options.runId,
    attempt: Number(options.attempt),
    metadata,
    rawAnnotations,
    annotationQueries,
    log,
  });
  const serialized = `${JSON.stringify(report, null, 2)}\n`;

  if (options.output) {
    writeAuditFile(options.output, serialized);
  } else {
    process.stdout.write(serialized);
  }
  if (!report.integrity.auditComplete) process.exitCode = 2;
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch {
    process.stderr.write("[actions-audit] failed safely; no raw provider output was emitted.\n");
    process.exitCode = 1;
  }
}
