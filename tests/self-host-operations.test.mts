import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  MAX_BACKUP_AGE_MS,
  MAX_CHECK_AGE_MS,
  MAX_DRILL_AGE_MS,
  OperationsError,
  acquireOperationsLock,
  assertAbsentVolume,
  assertProjectName,
  buildPgBackRestCommand,
  composeArguments,
  createStatusReport,
  defaultManifestPath,
  drillVolumeNames,
  expiredPairedStorageSnapshots,
  managedEnvironmentNames,
  newDrillProjectName,
  parseEnvText,
  parseArchiveStats,
  isArchiveHealthy,
  parseManifestLines,
  selectBackupManifest,
  selectPitrTarget,
} from "../scripts/self-host-operations/lib.mjs";
import { createProcessRunner, executeCli, parseCliArguments, quiesceWrites } from "../scripts/self-host-operations/cli.mjs";

test("CLI retains the operations lock until asynchronous backup/check failure finishes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ssartnership-lock-"));
  const data = path.join(directory, "data.env");
  const operations = path.join(directory, "operations.env");
  await writeFile(data, "COMPOSE_PROJECT_NAME=ssartnership-lock\n", { mode: 0o600 });
  await executeCli(["init", "--env-file", data, "--operations-env-file", operations]);
  let unblock!: () => void;
  const blocked = new Promise<void>((resolve) => { unblock = resolve; });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const running = executeCli(["check", "--env-file", data, "--operations-env-file", operations], {
    run: async () => { entered(); await blocked; throw new OperationsError("SYNTHETIC_FAILURE"); },
  });
  const expectedFailure = assert.rejects(running, /SYNTHETIC_FAILURE/);
  await started;
  try {
    await assert.rejects(() => acquireOperationsLock(path.join(directory, "operations-state")), /OPERATIONS_LOCKED/);
  } finally {
    unblock();
    await expectedFailure;
  }
  const release = await acquireOperationsLock(path.join(directory, "operations-state"));
  await release();
});

const project = "ssartnership-local";
const context = {
  projectName: project,
  dataEnvFile: "/srv/ssartnership/.tmp/self-host/data.env",
  operationsEnvFile: "/srv/ssartnership/.tmp/self-host/operations.env",
  data: { COMPOSE_PROJECT_NAME: project, POSTGRES_PASSWORD: "data-only" },
  operations: {
    PGBACKREST_REPO1_CIPHER_PASS: "secret",
    RESTIC_PASSWORD: "secret",
    PGBACKREST_REPOSITORY_VOLUME: `${project}_pgbackrest-repo`,
    RESTIC_REPOSITORY_VOLUME: `${project}_restic-repo`,
  },
};

function backupRecord({ result = "success", finishedAt = "2026-09-06T00:00:00.000Z" } = {}) {
  return {
    version: 1,
    kind: "backup",
    result,
    finishedAt,
    database: {
      backupId: "20260906-000000F",
      backupStopTime: "2026-09-06T00:00:00.000Z",
      restorePoint: { name: "self_host_ops_test", time: "2026-09-06T00:01:00.000Z" },
      markers: { before: "ops-1725580800000-test1234-before", after: "ops-1725580800000-test1234-after" },
    },
    storage: { snapshotId: "abc12345", marker: { path: ".self-host-operations/0123456789abcdef0123456789abcdef.marker", sha256: "a".repeat(64) } },
  };
}

test("operations env parsing rejects ambiguity and requires a constrained project", () => {
  assert.deepEqual(parseEnvText("COMPOSE_PROJECT_NAME=ssartnership-local\nPOSTGRES_PASSWORD=a=b\n"), {
    COMPOSE_PROJECT_NAME: project,
    POSTGRES_PASSWORD: "a=b",
  });
  assert.throws(() => parseEnvText("A=x\nA=y\n"), (error: unknown) => error instanceof OperationsError && error.code === "ENV_FILE_DUPLICATE_KEY");
  assert.throws(() => assertProjectName("production"), (error: unknown) => error instanceof OperationsError && error.code === "COMPOSE_PROJECT_NAME_INVALID");
  assert.equal(defaultManifestPath("/srv/ssartnership/.tmp/self-host/operations.env"), "/srv/ssartnership/.tmp/self-host/operations-state/backup-manifest.jsonl");
});

test("compose command preserves both env files and pgBackRest executes as postgres", () => {
  const args = composeArguments(context);
  assert.deepEqual(args.slice(0, 7), [
    "compose", "--project-name", project,
    "--env-file", context.dataEnvFile,
    "--env-file", context.operationsEnvFile,
  ]);
  assert.ok(args.includes("compose.operations.yaml"));
  assert.deepEqual(buildPgBackRestCommand("backup", ["--type=full"]), [
    "exec", "-T", "--user", "postgres", "db", "pgbackrest", "--stanza=ssartnership", "backup", "--type=full",
  ]);
});

test("restore Compose disables networking, archive writes and restored background workers", async () => {
  const compose = await readFile(new URL("../compose.operations.yaml", import.meta.url), "utf8");
  const drill = compose.split("  restore-drill-db:")[1].split("  restic:")[0];
  assert.match(drill, /network_mode: none/u);
  assert.match(drill, /archive_mode=off/u);
  assert.match(drill, /shared_preload_libraries=/u);
  assert.match(drill, /pgbackrest-repo:\/var\/lib\/pgbackrest\/repo:ro/u);
});

test("managed environment scrub list removes poisoned inherited Compose values", () => {
  const poisoned = {
    NODE_ENV: "test" as const,
    PATH: "/bin",
    COMPOSE_PROJECT_NAME: "ssartnership-poisoned",
    POSTGRES_PASSWORD: "poisoned",
    SUPABASE_URL: "https://poisoned.invalid",
    SELF_HOST_RUNTIME_ENV_FILE: "/tmp/poisoned",
    PGBACKREST_REPO1_CIPHER_PASS: "poisoned",
    RESTIC_PASSWORD: "poisoned",
  };
  const names = new Set(managedEnvironmentNames(context, poisoned));
  for (const key of Object.keys(poisoned).filter((key) => !["PATH", "NODE_ENV"].includes(key))) assert.ok(names.has(key));
  assert.ok(!names.has("PATH"));
});

test("process runner cannot let inherited managed values override env-file configuration", async () => {
  const run = createProcessRunner({
    environment: {
      NODE_ENV: "test",
      PATH: process.env.PATH ?? "",
      COMPOSE_PROJECT_NAME: "ssartnership-poisoned",
      POSTGRES_PASSWORD: "poisoned",
      SELF_HOST_RUNTIME_ENV_FILE: "/tmp/poisoned",
      PGBACKREST_REPO1_CIPHER_PASS: "poisoned",
      RESTIC_PASSWORD: "poisoned",
    },
  });
  const result = await run(process.execPath, ["-e", "process.stdout.write(JSON.stringify({project:process.env.COMPOSE_PROJECT_NAME ?? null,password:process.env.POSTGRES_PASSWORD ?? null,ops:process.env.SELF_HOST_OPERATIONS_ENV_FILE ?? null}))"], {
    env: { SELF_HOST_OPERATIONS_ENV_FILE: "/srv/ops.env" },
  });
  assert.deepEqual(JSON.parse(result.stdout), { project: null, password: null, ops: "/srv/ops.env" });
});

test("restore drill names new target volumes and refuses any existing target", async () => {
  const drillProject = newDrillProjectName(project, "edb2dd5f-5f1a-45dc-ae85-a2d075ebba2f");
  assert.match(drillProject, /^ssartnership-local-drill-/u);
  assert.deepEqual(drillVolumeNames(drillProject), {
    db: `${drillProject}_db-data`,
    storage: `${drillProject}_storage-data`,
  });
  await assert.rejects(
    () => assertAbsentVolume(async () => ({ exitCode: 0, stdout: "[]", stderr: "" }), "existing-volume"),
    (error: unknown) => error instanceof OperationsError && error.code === "RESTORE_DRILL_TARGET_ALREADY_EXISTS",
  );
  await assert.doesNotReject(() => assertAbsentVolume(async () => ({ exitCode: 0, stdout: "", stderr: "" }), "fresh-volume"));
  await assert.rejects(() => assertAbsentVolume(async () => ({ exitCode: 1, stdout: "", stderr: "" }), "unknown-volume"), /RESTORE_DRILL_VOLUME_INSPECTION_FAILED/);
});

test("PITR time may only use the matching backup-to-restore-point window", () => {
  const backup = backupRecord();
  assert.deepEqual(selectPitrTarget(backup, undefined), {
    type: "name", target: "self_host_ops_test", time: "2026-09-06T00:01:00.000Z",
  });
  assert.equal(selectPitrTarget(backup, "2026-09-06T00:00:30.000Z").type, "time");
  assert.equal(selectPitrTarget(backup, "2026-09-06T00:00:30.000Z").target, "2026-09-06 00:00:30.000+00:00");
  assert.throws(() => selectPitrTarget(backup, "2026-09-06T00:02:00.000Z"), (error: unknown) => error instanceof OperationsError && error.code === "PITR_TARGET_NOT_PAIRED_WITH_MANIFEST");
  assert.equal(selectBackupManifest([backup]).database.backupId, "20260906-000000F");
});

test("manifest parsing and status classify stale, failed, and archive-failure states as unhealthy", () => {
  const records = parseManifestLines(`${JSON.stringify(backupRecord())}\n${JSON.stringify({ version: 1, kind: "check", result: "success", finishedAt: "2026-09-06T00:00:00.000Z" })}\n${JSON.stringify({ version: 1, kind: "restore-drill", result: "success", finishedAt: "2026-09-06T00:00:00.000Z" })}\n`);
  const now = Date.parse("2026-09-06T00:10:00.000Z");
  const healthy = createStatusReport({
    records,
    archive: { configured: true, archivedCount: 4, failedCount: 0, lastArchivedAt: "2026-09-06T00:05:00.000Z", lastFailedAt: null },
    now,
  });
  assert.equal(healthy.healthy, true);
  assert.equal(healthy.lastSuccess.state, "current");
  const unhealthy = createStatusReport({
    records: [backupRecord({ result: "failed", finishedAt: new Date(now - MAX_BACKUP_AGE_MS - 1).toISOString() })],
    archive: { archivedCount: 4, failedCount: 1, lastArchivedAt: "2026-09-06T00:01:00.000Z", lastFailedAt: "2026-09-06T00:02:00.000Z" },
    now,
  });
  assert.equal(unhealthy.healthy, false);
  assert.equal(unhealthy.backup.result, "failed");
  assert.equal(unhealthy.repositoryCheck.healthy, false);
  assert.equal(unhealthy.restoreDrill.healthy, false);
  assert.ok(MAX_CHECK_AGE_MS > MAX_BACKUP_AGE_MS && MAX_DRILL_AGE_MS > MAX_CHECK_AGE_MS);
  const failedLatest = createStatusReport({ records: [...records, { version: 1, kind: "restore-drill", result: "failed", finishedAt: new Date(now).toISOString() }], archive: healthy.archive, now });
  assert.equal(failedLatest.healthy, false);
  assert.equal(failedLatest.restoreDrill.result, "failed");
});

test("archive health requires the current WAL configuration, not historical success alone", () => {
  const fields = { archived_count: 4, failed_count: 0, last_archived_at: "2026-09-06T00:05:00Z", last_failed_at: null };
  assert.equal(isArchiveHealthy(parseArchiveStats(JSON.stringify(fields))), false);
  assert.equal(isArchiveHealthy(parseArchiveStats(JSON.stringify({ ...fields, archive_mode: "off", archive_command: "pgbackrest --stanza=ssartnership archive-push %p" }))), false);
  assert.equal(isArchiveHealthy(parseArchiveStats(JSON.stringify({ ...fields, archive_mode: "on", archive_command: "pgbackrest --stanza=ssartnership archive-push %p" }))), true);
});

test("retention follows retained database chains instead of grouping each unique snapshot tag forever", () => {
  const current = "20260906-091109F_20260906-091307I";
  const expired = "20260901-010000F";
  const info = JSON.stringify([{ name: "ssartnership", status: { code: 0 }, backup: [{ label: "20260906-091109F" }, { label: current }] }]);
  const snapshots = [
    { id: "a".repeat(64), tags: ["ssartnership-storage", `pgbackrest-${current}`] },
    { id: "b".repeat(64), tags: ["ssartnership-storage", `pgbackrest-${expired}`] },
    { id: "c".repeat(64), tags: ["unmanaged"] },
  ];
  assert.deepEqual(expiredPairedStorageSnapshots(info, JSON.stringify(snapshots)), ["b".repeat(64)]);
  assert.throws(() => expiredPairedStorageSnapshots("[]", JSON.stringify(snapshots)), /PAIRED_RETENTION_INVALID/);
});

test("partial quiesce failures still record the exact services requiring recovery", async () => {
  let selected: string[] = [];
  const run = async (_file: string, args: string[]) => {
    if (args.includes("ps")) return { exitCode: 0, stdout: "app\nstorage\ndb\n", stderr: "" };
    throw new OperationsError("COMMAND_FAILED");
  };
  await assert.rejects(() => quiesceWrites(context, run, (services: string[]) => { selected = services; }), /COMMAND_FAILED/);
  assert.deepEqual(selected, ["app", "storage"]);
});

test("runner bounds command time and captured output", async () => {
  const limited = createProcessRunner({ maxOutputBytes: 32 });
  await assert.rejects(() => limited(process.execPath, ["-e", "process.stdout.write('x'.repeat(1000))"]), /COMMAND_OUTPUT_LIMIT/);
  const timed = createProcessRunner({ timeoutMs: 20 });
  await assert.rejects(() => timed(process.execPath, ["-e", "setTimeout(()=>{}, 5000)"]), /COMMAND_TIMEOUT/);
});

test("CLI requires both separated env files and constrains backup types", () => {
  assert.deepEqual(parseCliArguments(["backup", "--type", "full", "--env-file", "data.env", "--operations-env-file", "ops.env"]).type, "full");
  assert.throws(() => parseCliArguments(["backup", "--type", "full", "--env-file", "data.env"]), (error: unknown) => error instanceof OperationsError && error.code === "ARGUMENT_VALUE_MISSING");
  assert.throws(() => parseCliArguments(["backup", "--type", "diff", "--env-file", "data.env", "--operations-env-file", "ops.env"]), (error: unknown) => error instanceof OperationsError && error.code === "BACKUP_TYPE_INVALID");
});

test("operation lock refuses overlap and releases after completion", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ssartnership-operations-test-"));
  const release = await acquireOperationsLock(directory);
  await assert.rejects(() => acquireOperationsLock(directory), (error: unknown) => error instanceof OperationsError && error.code === "OPERATIONS_LOCKED");
  await release();
  const nextRelease = await acquireOperationsLock(directory);
  await nextRelease();
  await writeFile(path.join(directory, "finished"), "ok");
});

test("init creates a separate private operations env and never overwrites it", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ssartnership-operations-init-"));
  const dataEnvFile = path.join(directory, "data.env");
  const operationsEnvFile = path.join(directory, "operations.env");
  await writeFile(dataEnvFile, `COMPOSE_PROJECT_NAME=${project}\nPOSTGRES_PASSWORD=not-an-operations-secret\n`);
  const result = await executeCli(["init", "--env-file", dataEnvFile, "--operations-env-file", operationsEnvFile]);
  assert.ok("command" in result);
  assert.equal(result.command, "init");
  assert.equal((await stat(operationsEnvFile)).mode & 0o077, 0);
  const contents = await readFile(operationsEnvFile, "utf8");
  assert.ok(contents.includes("PGBACKREST_REPO1_CIPHER_PASS="));
  assert.ok(contents.includes("RESTIC_PASSWORD="));
  await assert.rejects(
    () => executeCli(["init", "--env-file", dataEnvFile, "--operations-env-file", operationsEnvFile]),
    (error: unknown) => error instanceof OperationsError && error.code === "OPERATIONS_ENV_ALREADY_EXISTS",
  );
});
