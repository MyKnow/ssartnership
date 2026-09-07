#!/usr/bin/env node
import { readFile, readdir, writeFile, mkdir, statfs, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { hashPreviewSeedPassword, isValidPreviewSeedPassword } from "../preview-credential-seed-lib.mjs";
import { assertPrivatePath, initializePair, loadPair, pairComposeArgs, fail } from "./lib.mjs";
import { runOperatorCommand } from "../self-host-ci/deployment.mjs";
import { createMigrationPlan, renderMigrationRunnerSql } from "../self-host-database/lib.mjs";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const run = (command, args, options = {}) => runOperatorCommand(command, args, { cwd: root, ...options });

export async function migrations() {
  const directory = path.join(root, "supabase/migrations");
  return createMigrationPlan(await Promise.all((await readdir(directory)).filter(name => name.endsWith(".sql")).map(async name => ({ name, source: await readFile(path.join(directory, name), "utf8") }))));
}

export async function withPairLock(directory, operation) {
  const dir = await assertPrivatePath(directory, true);
  const { open, unlink } = await import("node:fs/promises");
  const lock = path.join(dir, "operation.lock");
  const handle = await open(lock, "wx", 0o600).catch(() => fail("ENVIRONMENT_OPERATION_BUSY"));
  try { return await operation(); } finally { await handle.close(); await unlink(lock); }
}

export async function assertFreshProject(project) {
  const containers = await run("docker", ["ps", "-aq", "--filter", `label=com.docker.compose.project=${project}`]);
  const volumes = await run("docker", ["volume", "ls", "--format", "{{.Name}}"]);
  if (containers.stdout.trim() || volumes.stdout.split(/\r?\n/u).some(name => name.startsWith(`${project}_`))) fail("ENVIRONMENT_PROJECT_ALREADY_EXISTS");
}

export async function psql(args, sql, service = "db") {
  return (await run("docker", [...args, "exec", "-T", "--user", "postgres", service, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate", "-U", "supabase_admin", "-d", "postgres"], { input: sql, timeout: 600_000 })).stdout.trim();
}

export async function startData(directory, role, { migrationPlan } = {}) {
  const pair = await loadPair(directory);
  if (!["production", "preview"].includes(role)) fail("ENVIRONMENT_ROLE_INVALID");
  const profile = pair[role];
  const args = pairComposeArgs(root, directory, profile);
  await assertFreshProject(profile.project);
  await run("docker", [...args, "up", "-d", "--no-build", "--wait", "--wait-timeout", "180", "db", "rest", "storage", "gateway"]);
  if (role === "preview") await run("docker", [...args, "up", "-d", "--no-build", "preview-ingress"]);
  const plan = migrationPlan ?? await migrations();
  await psql(args, renderMigrationRunnerSql(plan));
  const systemId = await psql(args, "SELECT system_identifier FROM pg_control_system();");
  await writeFile(path.join(directory, role, "identity.json"), JSON.stringify({ version: 1, project: profile.project, role, systemId }), { flag: "wx", mode: 0o600 });
  return { started: true, role, migrations: plan.length, productionCutover: false };
}

export async function assertIdentity(directory, role) {
  const pair = await loadPair(directory);
  const profile = pair[role];
  if (!profile) fail("ENVIRONMENT_ROLE_INVALID");
  const file = await assertPrivatePath(path.join(directory, role, "identity.json"));
  const identity = JSON.parse(await readFile(file, "utf8"));
  const args = pairComposeArgs(root, directory, profile);
  const actual = await psql(args, "SELECT system_identifier FROM pg_control_system();");
  if (identity.project !== profile.project || identity.role !== role || !/^\d+$/u.test(actual) || actual !== identity.systemId) fail("ENVIRONMENT_IDENTITY_MISMATCH");
  // Inspect only selected fields in memory. No env/credentials are printed.
  const cid = (await run("docker", [...args, "ps", "-q", "db"])).stdout.trim();
  if (!/^[a-f0-9]{64}$/u.test(cid)) fail("ENVIRONMENT_CONTAINER_INVALID");
  const inspect = JSON.parse((await run("docker", ["inspect", cid])).stdout)[0];
  const volume = inspect.Mounts.find(m => m.Destination === "/var/lib/postgresql/data");
  if (volume?.Name !== `${profile.project}_db-data` || inspect.Config.Labels["io.ssartnership.environment"] !== role || Object.keys(inspect.HostConfig.PortBindings ?? {}).length) fail("ENVIRONMENT_VOLUME_MISMATCH");
  return { profile, args, systemId: actual };
}

async function main(argv) {
  const [command, directory, ...values] = argv;
  if (!command || command === "--help") return { usage: "cli.mjs init <new-private-directory> [options.json] | up-data <directory> <production|preview> | up-app <directory> <production|preview> <sha256:app-image> | prepare-copy <directory> | seed-preview-member <directory> <private-credential.json> | status <directory>" };
  if (!directory) fail("DIRECTORY_REQUIRED");
  if (command === "init") {
    if (values.length > 1) fail("ARGUMENTS_INVALID");
    const options = values[0] ? JSON.parse(await readFile(await assertPrivatePath(values[0]), "utf8")) : {};
    return initializePair(directory, options);
  }
  const dir = await realpath(await assertPrivatePath(directory, true));
  if (command === "status") {
    if (values.length) fail("ARGUMENTS_INVALID");
    await loadPair(dir);
    for (const role of ["production", "preview"]) await assertIdentity(dir, role);
    return { identitiesVerified: true, environments: ["production", "preview"] };
  }
  return withPairLock(dir, async () => {
    if (command === "seed-preview-member" && values.length === 1) {
      const { args } = await assertIdentity(dir, "preview");
      const credential = JSON.parse(await readFile(await assertPrivatePath(values[0]), "utf8"));
      if (!credential || Object.keys(credential).sort().join() !== "memberId,password" || !/^[a-f0-9-]{36}$/u.test(credential.memberId) || typeof credential.password !== "string" || !isValidPreviewSeedPassword(credential.password)) fail("PREVIEW_CREDENTIAL_INVALID");
      const { hash, salt } = hashPreviewSeedPassword(credential.password);
      if (!/^[a-f0-9]+$/u.test(hash) || !/^[a-f0-9]+$/u.test(salt)) fail("PREVIEW_CREDENTIAL_HASH_INVALID");
      const updated = await psql(args, `UPDATE public.members SET password_hash='${hash}', password_salt='${salt}', must_change_password=false, auth_session_version=auth_session_version+1 WHERE id='${credential.memberId}' AND deleted_at IS NULL RETURNING 1;`);
      if (updated !== "1") fail("PREVIEW_MEMBER_NOT_FOUND");
      return { seeded: true, environment: "preview" };
    }
    if (command === "up-data" && values.length === 1) return startData(dir, values[0]);
    if (command === "up-app" && values.length === 2) {
      const { args } = await assertIdentity(dir, values[0]);
      if (!/^sha256:[a-f0-9]{64}$/u.test(values[1])) fail("IMMUTABLE_APP_IMAGE_REQUIRED");
      await run("docker", [...args, "up", "-d", "--no-deps", "--no-build", "--pull", "never", "--wait", "--wait-timeout", "120", "app"], { env: { SELF_HOST_IMAGE: values[1] } });
      return { started: true, role: values[0] };
    }
    if (command === "prepare-copy" && values.length === 0) {
      const free = await statfs(dir);
      if (Number(free.bavail) * Number(free.bsize) < 15 * 1024 ** 3) fail("COPY_DISK_HEADROOM_LOW");
      const job = path.join(dir, `copy-${randomUUID()}`);
      await mkdir(job, { mode: 0o700 });
      const { prepareCopy } = await import("./copy.mjs");
      return prepareCopy(dir, job);
    }
    fail("ARGUMENTS_INVALID");
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main(process.argv.slice(2)).then(result => console.log(JSON.stringify(result))).catch(() => { console.error('{"error":"ENVIRONMENT_COMMAND_FAILED"}'); process.exitCode = 1; });
}
