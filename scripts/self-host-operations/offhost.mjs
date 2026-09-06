#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { writeFile, lstat, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  acquireOperationsLock, appendManifest, assertAbsentVolume, composeArguments,
  defaultManifestPath, loadOperationsContext, OperationsError, readEnvironment,
  readManifest, selectBackupManifest, parseManifestLines, serializeEnvironment,
} from "./lib.mjs";
import { createProcessRunner, performRestoreDrill } from "./cli.mjs";
import { createDatabaseEnvironment } from "../self-host-database/lib.mjs";

export const OFFHOST_IMAGE = "restic/restic:0.19.1@sha256:136600b6ff6843d61d355f7f71f460a166429f35de6fd11b568fece3c9a4d510";
const ID = /^[a-f0-9]{64}$/u;
const ALLOWED_KEYS = new Set(["OFFHOST_REPOSITORY", "OFFHOST_PASSWORD", "OFFHOST_USERNAME", "OFFHOST_CREDENTIAL", "OFFHOST_CA_FILE"]);
const fail = (code) => { throw new OperationsError(code); };

export function validateOffhostEnvironment(env) {
  if (Object.keys(env).some((key) => !ALLOWED_KEYS.has(key))) fail("OFFHOST_ENV_UNKNOWN_KEY");
  for (const key of ALLOWED_KEYS) {
    if (typeof env[key] !== "string" || !env[key] || /[\r\n\0]/u.test(env[key])) fail("OFFHOST_ENV_REQUIRED");
  }
  if (!env.OFFHOST_REPOSITORY.startsWith("rest:https://")) fail("OFFHOST_HTTPS_REQUIRED");
  let url;
  try { url = new URL(env.OFFHOST_REPOSITORY.slice(5)); } catch { fail("OFFHOST_ORIGIN_INVALID"); }
  if (url.username || url.password || url.search || url.hash || !/^[a-z][a-z0-9-]{0,40}$/u.test(env.OFFHOST_USERNAME)
      || url.pathname !== `/${env.OFFHOST_USERNAME}/ssartnership/`) fail("OFFHOST_ORIGIN_INVALID");
  if (env.OFFHOST_PASSWORD.length < 32 || env.OFFHOST_CREDENTIAL.length < 24) fail("OFFHOST_CREDENTIAL_INVALID");
  if (!path.isAbsolute(env.OFFHOST_CA_FILE)) fail("OFFHOST_CA_PATH_INVALID");
  return Object.freeze({ ...env });
}

export function parseOffhostArguments(argv) {
  const [command, ...rest] = argv;
  if (!["init", "capture", "check", "restore", "rehearse"].includes(command)) fail("OFFHOST_USAGE");
  const result = { command };
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!["--env-file", "--operations-env-file", "--offhost-env-file", "--snapshot"].includes(key)
        || !value || value.startsWith("-") || Object.hasOwn(result, key)) fail("OFFHOST_USAGE");
    result[key] = value;
  }
  if (["--env-file", "--operations-env-file", "--offhost-env-file"].some((key) => !result[key])) fail("OFFHOST_USAGE");
  if (["restore", "rehearse"].includes(command) ? !ID.test(result["--snapshot"] ?? "") : result["--snapshot"]) fail("OFFHOST_SNAPSHOT_INVALID");
  return result;
}

export function parseSnapshotSummary(stdout) {
  const summaries = stdout.trim().split(/\r?\n/u).map((line) => {
    try { return JSON.parse(line); } catch { fail("OFFHOST_RECEIPT_INVALID"); }
  }).filter((item) => item.message_type === "summary");
  if (summaries.length !== 1 || !ID.test(summaries[0].snapshot_id ?? "")) fail("OFFHOST_RECEIPT_INVALID");
  return summaries[0].snapshot_id;
}

// Export only fixed outcome/time/snapshot fields, never backend messages,
// credential-bearing URLs, filenames or Restic JSON progress records.
export async function executeOffhost(argv, { run = createProcessRunner() } = {}) {
  const options = parseOffhostArguments(argv);
  const context = await loadOperationsContext({ dataEnvFile: options["--env-file"], operationsEnvFile: options["--operations-env-file"] });
  const env = validateOffhostEnvironment(await readEnvironment(options["--offhost-env-file"], { requirePrivate: true }));
  const ca = await lstat(env.OFFHOST_CA_FILE);
  if (!ca.isFile() || ca.isSymbolicLink()) fail("OFFHOST_CA_PATH_INVALID");
  if (env.OFFHOST_PASSWORD === context.operations.RESTIC_PASSWORD || env.OFFHOST_PASSWORD === context.operations.PGBACKREST_REPO1_CIPHER_PASS) fail("OFFHOST_KEY_REUSE");
  const release = await acquireOperationsLock(context.stateDirectory);
  const startedAt = new Date().toISOString();
  const manifestPath = defaultManifestPath(context.operationsEnvFile);
  const id = randomUUID();
  const frozenManifest = path.join(context.stateDirectory, `offhost-${id}.jsonl`);
  const invoke = async (args, { restoreVolume } = {}) => {
    // All configuration is explicit. OFFHOST_ is also scrubbed by the process
    // runner; neither shell env poisoning nor inherited proxies override it.
    const base = [...composeArguments(context), "-f", "compose.offhost.yaml", "run", "--rm", "--no-deps"];
    if (restoreVolume) base.push("--cap-add", "CHOWN", "--cap-add", "DAC_OVERRIDE", "--cap-add", "FOWNER", "--volume", `${restoreVolume}:/restore`);
    return run("docker", [...base, "offhost", ...args], {
      env: { ...env, OFFHOST_MANIFEST_FILE: frozenManifest },
      unset: ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"],
    });
  };
  try {
    let paired;
    if (options.command === "capture") paired = selectBackupManifest(await readManifest(manifestPath));
    await writeFile(frozenManifest, paired ? `${JSON.stringify(paired)}\n` : "", { mode: 0o600, flag: "wx" });
    let snapshotId = options["--snapshot"] ?? null;
    let restoreVolume = null;
    if (options.command === "init") await invoke(["init"]);
    if (options.command === "capture") {
      // Backup/expire/Storage writers are excluded by the shared lock. WAL
      // archives are immutable additions: the paired target predates capture.
      const response = await invoke(["backup", "--json", "--host", context.projectName, "--tag", "ssartnership-recovery", "/bundle"]);
      snapshotId = parseSnapshotSummary(response.stdout);
    }
    if (options.command === "check") await invoke(["check", "--read-data"]);
    if (["restore", "rehearse"].includes(options.command)) {
      restoreVolume = `${context.projectName}-offhost-${id.replaceAll("-", "")}`;
      await assertAbsentVolume(run, restoreVolume);
      await invoke(["restore", snapshotId, "--target", "/restore", "--verify"], { restoreVolume });
    }
    let drill = null;
    if (options.command === "rehearse") drill = await rehearseRecoveredBundle(context, run, restoreVolume);
    const record = {
      version: 1, kind: `offhost-${options.command}`, id, result: "success", startedAt,
      finishedAt: new Date().toISOString(), snapshotId, restoreVolume,
      pairedRestoreTime: paired?.database?.restorePoint?.time ?? null,
      drill,
    };
    await appendManifest(manifestPath, record);
    return record;
  } catch (error) {
    const code = error instanceof OperationsError ? error.code : "OFFHOST_FAILED";
    await appendManifest(manifestPath, { version: 1, kind: `offhost-${options.command}`, id, result: "failed", startedAt, finishedAt: new Date().toISOString(), failureCode: code });
    throw new OperationsError(code);
  } finally {
    await release();
  }
}

export async function rehearseRecoveredBundle(context, run, bundleVolume) {
  if (!/^ssartnership-[a-z0-9-]+-offhost-[a-f0-9]{32}$/u.test(bundleVolume)) fail("OFFHOST_BUNDLE_INVALID");
  const recoveryProject = `ssartnership-recovery-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const directory = path.join(context.stateDirectory, recoveryProject);
  await mkdir(directory, { mode: 0o700 });
  const pgVolume = `${recoveryProject}_pgbackrest-repo`;
  const storageVolume = `${recoveryProject}_restic-repo`;
  await assertAbsentVolume(run, pgVolume);
  await assertAbsentVolume(run, storageVolume);
  const raw = await run("docker", ["run", "--rm", "--network", "none", "--read-only", "--volume", `${bundleVolume}:/recovered:ro`, "--entrypoint", "/bin/cat", OFFHOST_IMAGE, "/recovered/bundle/manifest.jsonl"]);
  const paired = selectBackupManifest(parseManifestLines(raw.stdout));
  // Copy only ciphertext repositories from the just-restored bundle into
  // brand-new volumes. Original source volumes are not mounted here.
  await run("docker", ["run", "--rm", "--network", "none", "--read-only", "--volume", `${bundleVolume}:/recovered:ro`, "--volume", `${pgVolume}:/pg`, "--volume", `${storageVolume}:/storage`, "--entrypoint", "/bin/sh", OFFHOST_IMAGE, "-ec", "cp -a /recovered/bundle/pgbackrest/. /pg/; cp -a /recovered/bundle/storage-repository/. /storage/"]);
  const dataFile = path.join(directory, "data.env");
  const opsFile = path.join(directory, "operations.env");
  await writeFile(dataFile, serializeEnvironment(createDatabaseEnvironment({ project: recoveryProject })), { mode: 0o600, flag: "wx" });
  await writeFile(opsFile, serializeEnvironment({
    PGBACKREST_REPO1_CIPHER_PASS: context.operations.PGBACKREST_REPO1_CIPHER_PASS,
    RESTIC_PASSWORD: context.operations.RESTIC_PASSWORD,
    PGBACKREST_REPOSITORY_VOLUME: pgVolume, RESTIC_REPOSITORY_VOLUME: storageVolume,
  }), { mode: 0o600, flag: "wx" });
  const recovered = await loadOperationsContext({ dataEnvFile: dataFile, operationsEnvFile: opsFile });
  await appendManifest(defaultManifestPath(opsFile), paired);
  const result = await performRestoreDrill(recovered, run);
  return { result: result.result, projectName: result.isolatedProject, targetVolumes: result.targetVolumes, recoveredFromOffhost: true };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  try { process.stdout.write(`${JSON.stringify(await executeOffhost(process.argv.slice(2)))}\n`); }
  catch (error) { process.stderr.write(`${JSON.stringify({ error: error instanceof OperationsError ? error.code : "OFFHOST_FAILED" })}\n`); process.exitCode = 1; }
}
