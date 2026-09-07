#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import {
  acquireOperationsLock,
  OperationsError,
  OPERATIONS_STANZA,
  appendManifest,
  assertAbsentVolume,
  assertIsoTime,
  buildPgBackRestCommand,
  buildResticCommand,
  commandReceipt,
  composeArguments,
  composeEnvironment,
  createOperationsEnvironmentFile,
  createStatusReport,
  defaultManifestPath,
  drillVolumeNames,
  expiredPairedStorageSnapshots,
  loadOperationsContext,
  makeBackupRecord,
  isManagedEnvironmentName,
  managedEnvironmentNames,
  newDrillProjectName,
  parseArchiveStats,
  parsePgBackRestInfo,
  parseResticSnapshots,
  readManifest,
  selectBackupManifest,
  selectPitrTarget,
} from "./lib.mjs";

const QUIESCE_SERVICES = ["app", "gateway", "rest", "realtime", "storage"];
const RESUME_SERVICES = ["storage", "rest", "realtime", "gateway", "app"];
const ARCHIVE_STATS_SQL = "SELECT json_build_object('archived_count', archived_count, 'failed_count', failed_count, 'last_archived_at', last_archived_time, 'last_failed_at', last_failed_time, 'archive_mode', current_setting('archive_mode'), 'archive_command', current_setting('archive_command'))::text FROM pg_stat_archiver";

function usage() {
  return [
    "usage:",
    "  cli.mjs init --env-file <data.env> --operations-env-file <operations.env>",
    "  cli.mjs backup --type <full|incr> --env-file <data.env> --operations-env-file <operations.env>",
    "  cli.mjs check --env-file <data.env> --operations-env-file <operations.env>",
    "  cli.mjs status --env-file <data.env> --operations-env-file <operations.env>",
    "  cli.mjs restore-drill [--target-time <ISO-8601>] [--manifest <path>] --env-file <data.env> --operations-env-file <operations.env>",
  ].join("\n");
}

export function parseCliArguments(argv) {
  const [command, ...rest] = argv;
  if (!command || command.startsWith("-")) throw new OperationsError("COMMAND_INVALID", usage());
  /** @type {{command: string, env_file?: string, operations_env_file?: string, type?: string, target_time?: string, manifest?: string}} */
  const options = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    if (!key.startsWith("--") || key === "--") throw new OperationsError("ARGUMENT_INVALID", usage());
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) throw new OperationsError("ARGUMENT_VALUE_MISSING", usage());
    if (!new Set(["--env-file", "--operations-env-file", "--type", "--target-time", "--manifest"]).has(key)) {
      throw new OperationsError("ARGUMENT_INVALID", usage());
    }
    const normalized = key.slice(2).replaceAll("-", "_");
    if (Object.hasOwn(options, normalized)) throw new OperationsError("ARGUMENT_DUPLICATE", usage());
    options[normalized] = value;
    index += 1;
  }
  for (const required of ["env_file", "operations_env_file"]) {
    if (!options[required]) throw new OperationsError("ARGUMENT_VALUE_MISSING", usage());
  }
  if (!["init", "backup", "check", "status", "restore-drill"].includes(command)) {
    throw new OperationsError("COMMAND_INVALID", usage());
  }
  if (command === "backup" && !["full", "incr"].includes(options.type)) {
    throw new OperationsError("BACKUP_TYPE_INVALID", usage());
  }
  if (command !== "backup" && options.type) throw new OperationsError("ARGUMENT_INVALID", usage());
  if (command !== "restore-drill" && (options.target_time || options.manifest)) {
    throw new OperationsError("ARGUMENT_INVALID", usage());
  }
  if (options.target_time) assertIsoTime(options.target_time);
  return Object.freeze(options);
}

export function createProcessRunner({ cwd = process.cwd(), environment = process.env, timeoutMs = 30 * 60_000, maxOutputBytes = 8 * 1024 * 1024 } = {}) {
  return (file, args, { allowFailure = false, env = {}, unset = [] } = {}) => new Promise((resolve, reject) => {
    const childEnvironment = { ...environment };
    for (const name of Object.keys(childEnvironment)) {
      if (isManagedEnvironmentName(name)) delete childEnvironment[name];
    }
    for (const name of unset) delete childEnvironment[name];
    Object.assign(childEnvironment, env);
    const child = spawn(file, args, {
      cwd,
      env: childEnvironment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let failureCode = null;
    const timer = setTimeout(() => {
      failureCode = "COMMAND_TIMEOUT";
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      if (stdout.length + chunk.length > maxOutputBytes) {
        failureCode = "COMMAND_OUTPUT_LIMIT";
        child.kill("SIGTERM");
      } else stdout += chunk;
    });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-64 * 1024); });
    child.once("error", () => {
      clearTimeout(timer);
      reject(new OperationsError("COMMAND_UNAVAILABLE"));
    });
    child.once("close", (exitCode) => {
      clearTimeout(timer);
      if (failureCode) {
        reject(new OperationsError(failureCode));
        return;
      }
      const result = Object.freeze({ exitCode: exitCode ?? 1, stdout, stderr });
      if (result.exitCode !== 0 && !allowFailure) {
        reject(Object.assign(new OperationsError("COMMAND_FAILED"), { exitCode: result.exitCode }));
        return;
      }
      resolve(result);
    });
  });
}

function now() {
  return new Date().toISOString();
}

function safeErrorCode(error) {
  return error instanceof OperationsError ? error.code : "OPERATIONS_FAILED";
}

async function withReceipt(receipts, name, operation) {
  const startedAt = now();
  try {
    const result = await operation();
    receipts.push(commandReceipt(name, 0, startedAt, now()));
    return result;
  } catch (error) {
    receipts.push(commandReceipt(name, Number.isInteger(error?.exitCode) ? error.exitCode : 1, startedAt, now()));
    throw error;
  }
}

function composeRun(context, run, args, options = {}) {
  return run("docker", [...composeArguments(context, options), ...args], {
    ...options,
    env: { ...composeEnvironment(context), ...(options.env ?? {}) },
    unset: [...new Set([...(options.unset ?? []), ...managedEnvironmentNames(context)])],
  });
}

async function psql(context, run, sql, { projectName, service = "db" } = {}) {
  const result = await composeRun(context, run, [
    "exec", "-T", "--user", "postgres", service, "psql", "-v", "ON_ERROR_STOP=1", "-U", "supabase_admin", "-d", "postgres", "-At", "-c", sql,
  ], { projectName });
  return result.stdout.trim();
}

async function pgBackRest(context, run, command, extra = [], { projectName } = {}) {
  return composeRun(context, run, buildPgBackRestCommand(command, extra), { projectName });
}

async function restic(context, run, command, extra = [], { projectName, composeRunOptions = {} } = {}) {
  return composeRun(context, run, buildResticCommand(command, extra), { projectName, ...composeRunOptions });
}

async function getRunningServices(context, run) {
  const result = await composeRun(context, run, ["ps", "--status", "running", "--services"]);
  return new Set(result.stdout.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean));
}

export async function quiesceWrites(context, run, onSelected) {
  const running = await getRunningServices(context, run);
  const stopped = QUIESCE_SERVICES.filter((service) => running.has(service));
  // Record intent before Docker stop: a failed stop can still have stopped
  // some services, which the caller's finally block must resume.
  onSelected(stopped);
  if (stopped.length > 0) await composeRun(context, run, ["stop", ...stopped]);
  return stopped;
}

async function restartOnlyPreviouslyRunning(context, run, services) {
  const resume = RESUME_SERVICES.filter((service) => services.includes(service));
  if (resume.length > 0) await composeRun(context, run, ["start", ...resume]);
}

async function ensureSyntheticSchema(context, run) {
  await psql(context, run, [
    "CREATE SCHEMA IF NOT EXISTS self_host_operations",
    "CREATE TABLE IF NOT EXISTS self_host_operations.restore_drill_markers (marker text PRIMARY KEY, phase text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp())",
  ].join("; "));
}

async function writeMarker(context, run, marker, phase) {
  await psql(context, run, `INSERT INTO self_host_operations.restore_drill_markers(marker, phase) VALUES ('${marker}', '${phase}')`);
}

async function createRestorePoint(context, run, restorePoint) {
  const raw = await psql(context, run, `SELECT json_build_object('name', '${restorePoint}', 'time', to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"'))::text FROM pg_create_restore_point('${restorePoint}')`);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new OperationsError("RESTORE_POINT_INVALID");
  }
  if (parsed?.name !== restorePoint || typeof parsed?.time !== "string") throw new OperationsError("RESTORE_POINT_INVALID");
  return parsed;
}

async function archiveStats(context, run) {
  return parseArchiveStats(await psql(context, run, ARCHIVE_STATS_SQL));
}

function syntheticStorageMarker() {
  const token = randomUUID().replaceAll("-", "");
  const content = `ssartnership-self-host-operations:${token}\n`;
  return Object.freeze({
    path: `.self-host-operations/${token}.marker`,
    content,
    sha256: createHash("sha256").update(content).digest("hex"),
  });
}

async function createStorageMarker(context, run, marker) {
  // marker values are generated locally from a restricted alphabet, so this
  // shell command has no user-supplied interpolation.
  const script = `umask 077; mkdir -p /var/lib/storage/.self-host-operations; printf '%s\\n' '${marker.content.trim()}' > /var/lib/storage/${marker.path}`;
  await composeRun(context, run, ["run", "--rm", "--no-deps", "storage-marker", script]);
}

async function assertStorageMarker(context, run, projectName, marker) {
  if (!/^\.self-host-operations\/[a-f0-9]{32}\.marker$/u.test(marker?.path ?? "")
    || !/^[a-f0-9]{64}$/u.test(marker.sha256 ?? "")) {
    throw new OperationsError("RESTORE_DRILL_STORAGE_MARKER_MISSING");
  }
  const script = `test "$(sha256sum /var/lib/storage/${marker.path} | awk '{print $1}')" = "${marker.sha256}"`;
  await composeRun(context, run, ["run", "--rm", "--no-deps", "storage-marker", script], { projectName });
}

async function ensureResticRepository(context, run, receipts) {
  const before = await restic(context, run, "snapshots", ["--json"], {
    composeRunOptions: { allowFailure: true },
  });
  if (before.exitCode === 0) return;
  await withReceipt(receipts, "restic-init", () => restic(context, run, "init"));
}

async function recordFailure(manifestPath, kind, startedAt, commands, error) {
  await appendManifest(manifestPath, {
    version: 1,
    kind,
    id: `${kind}-${Date.now()}`,
    startedAt,
    finishedAt: now(),
    result: "failed",
    failureCode: safeErrorCode(error),
    commands,
  });
}

export async function performBackup(context, run, type) {
  const manifestPath = defaultManifestPath(context.operationsEnvFile);
  const startedAt = now();
  const commands = [];
  const markerBase = `ops-${Date.now()}-${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const beforeMarker = `${markerBase}-before`;
  const afterMarker = `${markerBase}-after`;
  const restorePointName = `self_host_ops_${markerBase.replaceAll("-", "_")}`;
  try {
    await withReceipt(commands, "marker-schema", () => ensureSyntheticSchema(context, run));
    await withReceipt(commands, "marker-before", () => writeMarker(context, run, beforeMarker, "before-backup"));
    await withReceipt(commands, "pgbackrest-stanza-create", () => pgBackRest(context, run, "stanza-create"));
    await withReceipt(commands, "pgbackrest-check", () => pgBackRest(context, run, "check"));

    let database;
    let snapshot;
    let restorePoint;
    let archive;
    const storageMarker = syntheticStorageMarker();
    let stopped = [];
    try {
      await withReceipt(commands, "quiesce-app-and-storage-writes", () => quiesceWrites(context, run, (services) => { stopped = services; }));
      await withReceipt(commands, `pgbackrest-backup-${type}`, () => pgBackRest(context, run, "backup", [`--type=${type}`]));
      const info = await withReceipt(commands, "pgbackrest-info", () => pgBackRest(context, run, "info", ["--output=json"]));
      database = parsePgBackRestInfo(info.stdout);
      await withReceipt(commands, "storage-marker", () => createStorageMarker(context, run, storageMarker));
      await ensureResticRepository(context, run, commands);
      await withReceipt(commands, "restic-backup", () => restic(context, run, "backup", [
        "--tag", "ssartnership-storage",
        "--tag", `pgbackrest-${database.backupId}`,
        "/var/lib/storage",
      ]));
      const snapshots = await withReceipt(commands, "restic-snapshots", () => restic(context, run, "snapshots", ["--json", "--tag", `pgbackrest-${database.backupId}`]));
      snapshot = parseResticSnapshots(snapshots.stdout);
      await withReceipt(commands, "restic-paired-retention", async () => {
        const allSnapshots = await restic(context, run, "snapshots", ["--json"]);
        const expired = expiredPairedStorageSnapshots(info.stdout, allSnapshots.stdout);
        if (expired.length) await restic(context, run, "forget", [...expired, "--prune"]);
      });
      restorePoint = await withReceipt(commands, "database-restore-point", () => createRestorePoint(context, run, restorePointName));
      await withReceipt(commands, "database-wal-switch", () => psql(context, run, "SELECT pg_switch_wal()"));
      await withReceipt(commands, "pgbackrest-restore-point-check", () => pgBackRest(context, run, "check"));
      archive = await withReceipt(commands, "archive-stats", () => archiveStats(context, run));
    } finally {
      await withReceipt(commands, "resume-previously-running-services", () => restartOnlyPreviouslyRunning(context, run, stopped));
    }
    await withReceipt(commands, "marker-after", () => writeMarker(context, run, afterMarker, "after-target"));
    await withReceipt(commands, "after-marker-wal-switch", () => psql(context, run, "SELECT pg_switch_wal()"));
    await withReceipt(commands, "after-marker-archive-check", () => pgBackRest(context, run, "check"));
    const record = makeBackupRecord({
      startedAt,
      finishedAt: now(),
      database: { ...database, restorePoint, markers: { before: beforeMarker, after: afterMarker } },
      storage: { snapshotId: snapshot.id, capturedAt: snapshot.time, marker: { path: storageMarker.path, sha256: storageMarker.sha256 } },
      archive,
      commands,
    });
    await appendManifest(manifestPath, record);
    return record;
  } catch (error) {
    await recordFailure(manifestPath, "backup", startedAt, commands, error);
    throw error;
  }
}

export async function performCheck(context, run) {
  const manifestPath = defaultManifestPath(context.operationsEnvFile);
  const startedAt = now();
  const commands = [];
  try {
    await withReceipt(commands, "pgbackrest-check", () => pgBackRest(context, run, "check"));
    await withReceipt(commands, "restic-check", () => restic(context, run, "check", ["--read-data-subset=10%"]));
    const record = { version: 1, kind: "check", id: `check-${Date.now()}`, startedAt, finishedAt: now(), result: "success", commands };
    await appendManifest(manifestPath, record);
    return record;
  } catch (error) {
    await recordFailure(manifestPath, "check", startedAt, commands, error);
    throw error;
  }
}

async function assertFreshDrillTarget(context, run, drillProject) {
  const volumes = drillVolumeNames(drillProject);
  await assertAbsentVolume(run, volumes.db);
  await assertAbsentVolume(run, volumes.storage);
  const existing = await run("docker", ["ps", "--all", "--filter", `label=com.docker.compose.project=${drillProject}`, "--format", "{{.ID}}"], { allowFailure: true });
  if (existing.exitCode === 0 && existing.stdout.trim()) throw new OperationsError("RESTORE_DRILL_TARGET_ALREADY_EXISTS");
  return volumes;
}

async function waitForIsolatedDatabase(context, run, projectName) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const result = await composeRun(context, run, ["exec", "-T", "restore-drill-db", "pg_isready", "-U", "supabase_admin", "-d", "postgres"], {
      projectName,
      allowFailure: true,
    });
    if (result.exitCode === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new OperationsError("RESTORE_DRILL_DATABASE_TIMEOUT");
}

async function assertRestoredMarkers(context, run, projectName, markers) {
  if (!markers?.before || !markers?.after) throw new OperationsError("RESTORE_DRILL_MARKERS_MISSING");
  const result = await psql(context, run, `SELECT json_build_object('before', EXISTS(SELECT 1 FROM self_host_operations.restore_drill_markers WHERE marker = '${markers.before}'), 'after', EXISTS(SELECT 1 FROM self_host_operations.restore_drill_markers WHERE marker = '${markers.after}'))::text`, { projectName, service: "restore-drill-db" });
  let parsed;
  try {
    parsed = JSON.parse(result);
  } catch {
    throw new OperationsError("RESTORE_DRILL_MARKER_QUERY_INVALID");
  }
  if (parsed.before !== true || parsed.after !== false) throw new OperationsError("RESTORE_DRILL_MARKER_ASSERTION_FAILED");
}

export async function performRestoreDrill(context, run, { manifestPath = defaultManifestPath(context.operationsEnvFile), targetTime, removeContainer = false } = {}) {
  const records = await readManifest(manifestPath);
  const backup = selectBackupManifest(records);
  const target = selectPitrTarget(backup, targetTime);
  const drillProject = newDrillProjectName(context.projectName);
  const startedAt = now();
  const commands = [];
  let databaseStarted = false;
  try {
    const volumes = await assertFreshDrillTarget(context, run, drillProject);
    await withReceipt(commands, "pgbackrest-restore", () => composeRun(context, run, [
      "run", "--rm", "--no-deps", "restore-db",
      `--stanza=${OPERATIONS_STANZA}`,
      "restore",
      `--set=${backup.database.backupId}`,
      `--type=${target.type}`,
      `--target=${target.target}`,
      "--recovery-option=recovery_target_action=promote",
    ], { projectName: drillProject }));
    await withReceipt(commands, "restic-restore", () => composeRun(context, run, [
      "run", "--rm", "--no-deps",
      "--volume", `${volumes.storage}:/restore/var/lib/storage`,
      "restore-restic", "--no-lock", "restore", "--verify", backup.storage.snapshotId, "--target", "/restore",
    ], { projectName: drillProject }));
    await withReceipt(commands, "isolated-db-start", () => composeRun(context, run, ["up", "-d", "restore-drill-db"], { projectName: drillProject }));
    databaseStarted = true;
    await withReceipt(commands, "isolated-db-ready", () => waitForIsolatedDatabase(context, run, drillProject));
    await withReceipt(commands, "pitr-marker-assertion", () => assertRestoredMarkers(context, run, drillProject, backup.database.markers));
    await withReceipt(commands, "restic-restored-storage-marker", () => assertStorageMarker(context, run, drillProject, backup.storage.marker));
    const record = {
      version: 1,
      kind: "restore-drill",
      id: `restore-drill-${Date.now()}`,
      startedAt,
      finishedAt: now(),
      result: "success",
      sourceBackupId: backup.database.backupId,
      sourceStorageSnapshotId: backup.storage.snapshotId,
      target,
      isolatedProject: drillProject,
      targetVolumes: volumes,
      commands,
    };
    await appendManifest(manifestPath, record);
    return record;
  } catch (error) {
    await recordFailure(manifestPath, "restore-drill", startedAt, commands, error);
    throw error;
  } finally {
    if (removeContainer) {
      // Exact new drill project only. Keep recovered volumes/evidence, but
      // don't retain a stopped container's runtime backup-key environment.
      await composeRun(context, run, ["rm", "--force", "--stop", "restore-drill-db"], { projectName: drillProject });
    } else if (databaseStarted) {
      await composeRun(context, run, ["stop", "restore-drill-db"], { projectName: drillProject, allowFailure: true });
    }
  }
}

export async function performStatus(context, run) {
  let records = [];
  let archive = { archivedCount: null, failedCount: null, lastArchivedAt: null, lastFailedAt: null };
  try {
    records = await readManifest(defaultManifestPath(context.operationsEnvFile));
  } catch (error) {
    if (!(error instanceof OperationsError) || error.code !== "MANIFEST_MISSING") throw error;
  }
  try {
    archive = await archiveStats(context, run);
  } catch (error) {
    if (!(error instanceof OperationsError)) throw error;
  }
  return createStatusReport({ records, archive });
}

export async function executeCli(argv, { run = createProcessRunner() } = {}) {
  const options = parseCliArguments(argv);
  if (options.command === "init") {
    const result = await createOperationsEnvironmentFile({ dataEnvFile: options.env_file, operationsEnvFile: options.operations_env_file });
    return { command: "init", projectName: result.projectName, operationsEnvFile: path.resolve(options.operations_env_file), stateDirectory: result.stateDirectory };
  }
  const context = await loadOperationsContext({ dataEnvFile: options.env_file, operationsEnvFile: options.operations_env_file });
  if (options.command === "status") return performStatus(context, run);
  const release = await acquireOperationsLock(context.stateDirectory);
  try {
    if (options.command === "backup") return await performBackup(context, run, options.type);
    if (options.command === "check") return await performCheck(context, run);
    return await performRestoreDrill(context, run, { manifestPath: options.manifest, targetTime: options.target_time });
  } finally {
    await release();
  }
}

async function main() {
  try {
    const result = await executeCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result?.healthy === false) process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: safeErrorCode(error) })}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  await main();
}
