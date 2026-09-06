import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, lstat, rm, stat } from "node:fs/promises";
import path from "node:path";

export const OPERATIONS_STANZA = "ssartnership";
export const MANIFEST_VERSION = 1;
export const MAX_BACKUP_AGE_MS = 26 * 60 * 60 * 1000;
export const MAX_CHECK_AGE_MS = 8 * 24 * 60 * 60 * 1000;
export const MAX_DRILL_AGE_MS = 31 * 24 * 60 * 60 * 1000;

const ENV_KEY = /^[A-Z][A-Z0-9_]*$/u;
const PROJECT_NAME = /^ssartnership-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u;
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,62}$/u;
const MANAGED_ENVIRONMENT = /^(?:COMPOSE_|POSTGRES_|JWT_|SUPABASE_|SELF_HOST_|PGBACKREST_|RESTIC_|PGRST_|STORAGE_|KONG_|PGPASSWORD$|PGDATABASE$|PGPORT$)/u;
const RESTORE_POINT_NAME = /^self_host_ops_[a-z0-9_]{1,100}$/u;
const DATABASE_MARKER = /^ops-\d+-[a-z0-9]{4,32}-(?:before|after)$/u;
const STORAGE_MARKER_PATH = /^\.self-host-operations\/[a-f0-9]{32}\.marker$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const RESTIC_SNAPSHOT_ID = /^[a-f0-9]{8,64}$/u;
const PGBACKREST_BACKUP_ID = /^\d{8}-\d{6}F(?:_\d{8}-\d{6}[DI])?$/u;

export class OperationsError extends Error {
  constructor(code, message = code) {
    super(message);
    this.code = code;
  }
}

export function fail(code, message) {
  throw new OperationsError(code, message);
}

export function parseEnvText(text) {
  if (typeof text !== "string") fail("ENV_FILE_INVALID");
  const values = {};
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) fail("ENV_FILE_INVALID");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1);
    if (!ENV_KEY.test(key) || value.includes("\u0000")) fail("ENV_FILE_INVALID");
    if (Object.hasOwn(values, key)) fail("ENV_FILE_DUPLICATE_KEY");
    values[key] = value;
  }
  return Object.freeze(values);
}

export function assertProjectName(value) {
  if (typeof value !== "string" || !PROJECT_NAME.test(value)) {
    fail("COMPOSE_PROJECT_NAME_INVALID");
  }
  return value;
}

export function assertSafeIdentifier(value, code = "IDENTIFIER_INVALID") {
  if (typeof value !== "string" || !SAFE_ID.test(value)) fail(code);
  return value;
}

export function defaultStateDirectory(operationsEnvFile) {
  return path.join(path.dirname(path.resolve(operationsEnvFile)), `${path.basename(operationsEnvFile, ".env")}-state`);
}

export function defaultManifestPath(operationsEnvFile) {
  return path.join(defaultStateDirectory(operationsEnvFile), "backup-manifest.jsonl");
}

export function createOperationsEnvironment(projectName, operationsEnvFile) {
  assertProjectName(projectName);
  const stateDirectory = defaultStateDirectory(operationsEnvFile);
  return Object.freeze({
    PGBACKREST_REPO1_CIPHER_PASS: randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", ""),
    RESTIC_PASSWORD: randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", ""),
    PGBACKREST_REPOSITORY_VOLUME: `${projectName}_pgbackrest-repo`,
    RESTIC_REPOSITORY_VOLUME: `${projectName}_restic-repo`,
    SELF_HOST_OPERATIONS_STATE_DIR: stateDirectory,
  });
}

export function serializeEnvironment(environment) {
  return `${Object.entries(environment).map(([key, value]) => `${key}=${value}`).join("\n")}\n`;
}

export async function readEnvironment(filePath, { requirePrivate = false } = {}) {
  let metadata;
  try {
    metadata = await lstat(filePath);
  } catch {
    fail("ENV_FILE_MISSING");
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) fail("ENV_FILE_INVALID");
  if (requirePrivate && (metadata.mode & 0o077) !== 0) fail("OPERATIONS_ENV_PERMISSIONS_INVALID");
  return parseEnvText(await readFile(filePath, "utf8"));
}

export async function createOperationsEnvironmentFile({ dataEnvFile, operationsEnvFile }) {
  const data = await readEnvironment(dataEnvFile);
  const projectName = assertProjectName(data.COMPOSE_PROJECT_NAME);
  try {
    await lstat(operationsEnvFile);
    fail("OPERATIONS_ENV_ALREADY_EXISTS");
  } catch (error) {
    if (error instanceof OperationsError) throw error;
    if (error?.code !== "ENOENT") throw error;
  }

  const parent = path.dirname(path.resolve(operationsEnvFile));
  await mkdir(parent, { recursive: true, mode: 0o700 });
  await writeFile(
    operationsEnvFile,
    serializeEnvironment(createOperationsEnvironment(projectName, operationsEnvFile)),
    { encoding: "utf8", mode: 0o600, flag: "wx" },
  );
  return Object.freeze({ projectName, stateDirectory: defaultStateDirectory(operationsEnvFile) });
}

export async function loadOperationsContext({ dataEnvFile, operationsEnvFile }) {
  const [data, operations] = await Promise.all([
    readEnvironment(dataEnvFile),
    readEnvironment(operationsEnvFile, { requirePrivate: true }),
  ]);
  const projectName = assertProjectName(data.COMPOSE_PROJECT_NAME);
  for (const key of [
    "PGBACKREST_REPO1_CIPHER_PASS",
    "RESTIC_PASSWORD",
    "PGBACKREST_REPOSITORY_VOLUME",
    "RESTIC_REPOSITORY_VOLUME",
  ]) {
    if (!operations[key]) fail("OPERATIONS_ENV_REQUIRED_VALUE_MISSING");
  }
  if (operations.PGBACKREST_REPOSITORY_VOLUME !== `${projectName}_pgbackrest-repo`
    || operations.RESTIC_REPOSITORY_VOLUME !== `${projectName}_restic-repo`) {
    fail("OPERATIONS_ENV_PROJECT_MISMATCH");
  }
  const stateDirectory = operations.SELF_HOST_OPERATIONS_STATE_DIR
    ? path.resolve(operations.SELF_HOST_OPERATIONS_STATE_DIR)
    : defaultStateDirectory(operationsEnvFile);
  return Object.freeze({
    projectName,
    dataEnvFile: path.resolve(dataEnvFile),
    operationsEnvFile: path.resolve(operationsEnvFile),
    stateDirectory,
    data,
    operations,
  });
}

export function composeArguments(context, { projectName = context.projectName } = {}) {
  assertProjectName(projectName.replace(/-drill-[a-z0-9-]+$/u, "") || context.projectName);
  return [
    "compose",
    "--project-name", projectName,
    "--env-file", context.dataEnvFile,
    "--env-file", context.operationsEnvFile,
    "-f", "compose.yaml",
    "-f", "compose.supabase.yaml",
    "-f", "compose.operations.yaml",
  ];
}

export function composeEnvironment(context) {
  return { SELF_HOST_OPERATIONS_ENV_FILE: context.operationsEnvFile };
}

export function managedEnvironmentNames(context, environment = process.env) {
  const names = new Set([
    "COMPOSE_PROJECT_NAME",
    ...Object.keys(context.data ?? {}),
    ...Object.keys(context.operations ?? {}),
  ]);
  for (const name of Object.keys(environment)) {
    if (isManagedEnvironmentName(name)) {
      names.add(name);
    }
  }
  return Object.freeze([...names]);
}

export function isManagedEnvironmentName(name) {
  return MANAGED_ENVIRONMENT.test(name);
}

export function buildPgBackRestCommand(command, extra = []) {
  return ["exec", "-T", "--user", "postgres", "db", "pgbackrest", `--stanza=${OPERATIONS_STANZA}`, command, ...extra];
}

export function buildResticCommand(command, extra = []) {
  return ["run", "--rm", "--no-deps", "restic", command, ...extra];
}

function validIsoTime(value) {
  if (typeof value !== "string" || value.length > 64 || !/^\d{4}-\d{2}-\d{2}T/u.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

export function assertIsoTime(value) {
  const date = validIsoTime(value);
  if (!date) fail("PITR_TARGET_TIME_INVALID");
  return date.toISOString();
}

export function newDrillProjectName(projectName, uuid = randomUUID()) {
  assertProjectName(projectName);
  const token = uuid.toLowerCase().replaceAll(/[^a-z0-9]/gu, "").slice(0, 20);
  const name = `${projectName}-drill-${token}`;
  if (!PROJECT_NAME.test(name) || name.length > 63) fail("DRILL_PROJECT_NAME_INVALID");
  return name;
}

export function drillVolumeNames(projectName) {
  assertProjectName(projectName.replace(/-drill-[a-z0-9-]+$/u, "") || projectName);
  return Object.freeze({ db: `${projectName}_db-data`, storage: `${projectName}_storage-data` });
}

export function parseManifestLines(text) {
  if (typeof text !== "string") fail("MANIFEST_INVALID");
  const records = [];
  for (const line of text.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      fail("MANIFEST_INVALID");
    }
    if (!record || record.version !== MANIFEST_VERSION || typeof record.kind !== "string") {
      fail("MANIFEST_INVALID");
    }
    records.push(Object.freeze(record));
  }
  return Object.freeze(records);
}

export async function readManifest(manifestPath) {
  try {
    return parseManifestLines(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error instanceof OperationsError) throw error;
    if (error?.code === "ENOENT") fail("MANIFEST_MISSING");
    throw error;
  }
}

export async function appendManifest(manifestPath, record) {
  if (!record || record.version !== MANIFEST_VERSION) fail("MANIFEST_RECORD_INVALID");
  const directory = path.dirname(path.resolve(manifestPath));
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(manifestPath, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600, flag: "a" });
}

export function selectBackupManifest(records) {
  const backups = records.filter((record) => record.kind === "backup" && record.result === "success");
  const latest = backups.at(-1);
  if (!latest?.database?.backupId || !latest?.database?.restorePoint?.name || !latest?.database?.restorePoint?.time
    || !latest?.storage?.snapshotId) {
    fail("RESTORE_DRILL_BACKUP_NOT_FOUND");
  }
  if (!RESTORE_POINT_NAME.test(latest.database.restorePoint.name)
    || !DATABASE_MARKER.test(latest.database.markers?.before ?? "")
    || !DATABASE_MARKER.test(latest.database.markers?.after ?? "")
    || !STORAGE_MARKER_PATH.test(latest.storage.marker?.path ?? "")
    || !SHA256.test(latest.storage.marker?.sha256 ?? "")
    || !RESTIC_SNAPSHOT_ID.test(latest.storage.snapshotId)) {
    fail("RESTORE_DRILL_MANIFEST_VALUES_INVALID");
  }
  return latest;
}

export function selectPitrTarget(backup, requestedTargetTime) {
  const restorePoint = backup?.database?.restorePoint;
  if (!restorePoint?.name || !restorePoint?.time) fail("RESTORE_DRILL_BACKUP_NOT_FOUND");
  if (!requestedTargetTime) return Object.freeze({ type: "name", target: restorePoint.name, time: restorePoint.time });
  const requested = assertIsoTime(requestedTargetTime);
  const start = validIsoTime(backup.database?.backupStopTime);
  const end = validIsoTime(restorePoint.time);
  if (!start || !end || new Date(requested) < start || new Date(requested) > end) {
    fail("PITR_TARGET_NOT_PAIRED_WITH_MANIFEST");
  }
  // PostgreSQL's recovery_target_time GUC uses its configuration timestamp
  // parser, which does not accept the JavaScript ISO `T...Z` representation.
  const postgresTimestamp = requested.replace("T", " ").replace("Z", "+00:00");
  return Object.freeze({ type: "time", target: postgresTimestamp, time: requested });
}

export function parsePgBackRestInfo(text) {
  let info;
  try {
    info = JSON.parse(text);
  } catch {
    fail("PGBACKREST_INFO_INVALID");
  }
  const stanza = Array.isArray(info) ? info.find((entry) => entry?.name === OPERATIONS_STANZA) ?? info[0] : null;
  if (!stanza || stanza?.status?.code !== 0 || !Array.isArray(stanza.backup)) fail("PGBACKREST_INFO_INVALID");
  const backup = stanza.backup.at(-1);
  if (!backup?.label || !backup?.timestamp?.stop) fail("PGBACKREST_BACKUP_NOT_FOUND");
  return Object.freeze({
    backupId: backup.label,
    backupType: backup.type,
    backupStartTime: new Date(backup.timestamp.start * 1000).toISOString(),
    backupStopTime: new Date(backup.timestamp.stop * 1000).toISOString(),
    walStart: backup.archive?.start ?? null,
    walStop: backup.archive?.stop ?? null,
  });
}

export function parseResticSnapshots(text) {
  let snapshots;
  try {
    snapshots = JSON.parse(text);
  } catch {
    fail("RESTIC_SNAPSHOTS_INVALID");
  }
  if (!Array.isArray(snapshots)) fail("RESTIC_SNAPSHOTS_INVALID");
  const snapshot = snapshots.at(-1);
  if (!snapshot?.id || typeof snapshot.id !== "string") fail("RESTIC_SNAPSHOT_NOT_FOUND");
  return Object.freeze({ id: snapshot.id, time: snapshot.time ?? null });
}

export function parseArchiveStats(text) {
  let stats;
  try {
    stats = JSON.parse(text.trim());
  } catch {
    fail("ARCHIVE_STATS_INVALID");
  }
  if (!stats || typeof stats !== "object") fail("ARCHIVE_STATS_INVALID");
  const number = (value) => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  return Object.freeze({
    archivedCount: number(stats.archived_count),
    failedCount: number(stats.failed_count),
    lastArchivedAt: typeof stats.last_archived_at === "string" ? stats.last_archived_at : null,
    lastFailedAt: typeof stats.last_failed_at === "string" ? stats.last_failed_at : null,
    configured: stats.archive_mode === "on" && stats.archive_command === "pgbackrest --stanza=ssartnership archive-push %p",
  });
}

/** Expire file snapshots only when their matching database backup expired. */
export function expiredPairedStorageSnapshots(pgInfoText, snapshotText) {
  let info;
  let snapshots;
  try {
    info = JSON.parse(pgInfoText);
    snapshots = JSON.parse(snapshotText);
  } catch { fail("PAIRED_RETENTION_INVALID"); }
  const stanza = Array.isArray(info) ? info.find((entry) => entry.name === OPERATIONS_STANZA) : null;
  if (stanza?.status?.code !== 0 || !Array.isArray(stanza.backup) || !stanza.backup.length || !Array.isArray(snapshots)) fail("PAIRED_RETENTION_INVALID");
  const retained = new Set(stanza.backup.map((backup) => backup.label));
  if ([...retained].some((label) => !PGBACKREST_BACKUP_ID.test(label))) fail("PAIRED_RETENTION_INVALID");
  const expired = [];
  for (const snapshot of snapshots) {
    if (!Array.isArray(snapshot.tags) || !snapshot.tags.includes("ssartnership-storage")) continue;
    const labels = snapshot.tags.filter((tag) => tag.startsWith("pgbackrest-")).map((tag) => tag.slice(11));
    if (labels.length !== 1 || !PGBACKREST_BACKUP_ID.test(labels[0]) || !RESTIC_SNAPSHOT_ID.test(snapshot.id)) fail("PAIRED_RETENTION_INVALID");
    if (!retained.has(labels[0])) expired.push(snapshot.id);
  }
  return expired;
}

export function classifyAge(timestamp, maxAgeMs, now = Date.now()) {
  const date = typeof timestamp === "string" ? new Date(timestamp) : null;
  if (!date || Number.isNaN(date.valueOf())) return Object.freeze({ state: "missing", ageSeconds: null, healthy: false });
  const ageMs = Math.max(0, now - date.valueOf());
  return Object.freeze({ state: ageMs <= maxAgeMs ? "current" : "stale", ageSeconds: Math.floor(ageMs / 1000), healthy: ageMs <= maxAgeMs });
}

export function isArchiveHealthy(archive) {
  const lastArchived = validIsoTime(archive?.lastArchivedAt);
  const lastFailed = validIsoTime(archive?.lastFailedAt);
  return archive?.configured === true && Boolean(lastArchived) && (!lastFailed || lastFailed <= lastArchived);
}

export function createStatusReport({ records, archive, now = Date.now() }) {
  const latestBackup = [...records].reverse().find((record) => record.kind === "backup");
  const latestCheck = [...records].reverse().find((record) => record.kind === "check");
  const latestDrill = [...records].reverse().find((record) => record.kind === "restore-drill");
  const backupAge = classifyAge(latestBackup?.finishedAt, MAX_BACKUP_AGE_MS, now);
  const checkAge = { ...classifyAge(latestCheck?.finishedAt, MAX_CHECK_AGE_MS, now), result: latestCheck?.result ?? "missing" };
  const drillAge = { ...classifyAge(latestDrill?.finishedAt, MAX_DRILL_AGE_MS, now), result: latestDrill?.result ?? "missing" };
  checkAge.healthy = checkAge.healthy && checkAge.result === "success";
  drillAge.healthy = drillAge.healthy && drillAge.result === "success";
  const archiveHealthy = isArchiveHealthy(archive);
  const archiveFinished = validIsoTime(archive?.lastArchivedAt);
  // Idle databases need not produce WAL. This is an age observation, not a
  // promise that every current commit has reached the archive.
  const secondsSinceLastArchived = archiveFinished
    ? Math.max(0, Math.floor((now - archiveFinished.valueOf()) / 1000))
    : null;
  const checks = [
    latestBackup?.result === "success" && backupAge.healthy,
    archiveHealthy,
    checkAge.healthy,
    drillAge.healthy,
  ];
  return Object.freeze({
    version: 1,
    healthy: checks.every(Boolean),
    lastSuccess: classifyAge([...records].reverse().find((record) => record.kind === "backup" && record.result === "success")?.finishedAt, MAX_BACKUP_AGE_MS, now),
    backup: { result: latestBackup?.result ?? "missing", id: latestBackup?.database?.backupId ?? null, ...backupAge },
    archive: { ...archive, secondsSinceLastArchived, healthy: archiveHealthy },
    repositoryCheck: checkAge,
    restoreDrill: drillAge,
  });
}

export function commandReceipt(name, exitCode, startedAt, finishedAt) {
  return Object.freeze({ name, exitCode, startedAt, finishedAt });
}

export function makeBackupRecord({ id = `backup-${randomUUID()}`, startedAt, finishedAt, database, storage, archive, commands, result = "success" }) {
  return Object.freeze({
    version: MANIFEST_VERSION,
    kind: "backup",
    id,
    startedAt,
    finishedAt,
    result,
    database,
    storage: { ...storage, consistency: "quiesced-snapshot; not arbitrary-object PITR" },
    archive,
    commands,
  });
}

export async function assertAbsentVolume(run, volumeName) {
  const result = await run("docker", ["volume", "ls", "--filter", `name=^${volumeName}$`, "--format", "{{.Name}}"], { allowFailure: true });
  if (result.exitCode !== 0) fail("RESTORE_DRILL_VOLUME_INSPECTION_FAILED");
  if (result.stdout.trim()) fail("RESTORE_DRILL_TARGET_ALREADY_EXISTS");
}

export async function assertDirectoryAbsentOrEmpty(directory) {
  try {
    const metadata = await stat(directory);
    if (!metadata.isDirectory()) fail("RESTORE_DRILL_TARGET_INVALID");
  } catch (error) {
    if (error?.code === "ENOENT") return;
    if (error instanceof OperationsError) throw error;
    throw error;
  }
}

export async function acquireOperationsLock(stateDirectory) {
  const lockDirectory = path.join(stateDirectory, "operations.lock");
  await mkdir(stateDirectory, { recursive: true, mode: 0o700 });
  try {
    await mkdir(lockDirectory, { mode: 0o700 });
  } catch (error) {
    if (error?.code === "EEXIST") fail("OPERATIONS_LOCKED");
    throw error;
  }
  try {
    await writeFile(path.join(lockDirectory, "owner.json"), JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { encoding: "utf8", mode: 0o600, flag: "wx" });
  } catch (error) {
    await rm(lockDirectory, { recursive: true, force: true });
    throw error;
  }
  return async () => {
    await rm(lockDirectory, { recursive: true, force: true });
  };
}
