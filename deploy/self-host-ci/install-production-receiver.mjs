#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertOperatorInput } from "../../scripts/self-host-ci/lib.mjs";
import { isMainModule, readRootToken, RECEIVER_PROFILES } from "../../scripts/self-host-ci/receive-release.mjs";
import { readRootSchemaApproval } from "../../scripts/self-host-ci/schema-approval.mjs";

export const PRODUCTION_RECEIVER_UNITS = Object.freeze([
  "ssartnership-production-receiver.service",
  "ssartnership-production-receiver.timer",
]);

export function isInstallerMainModule(argvPath = process.argv[1], moduleUrl = import.meta.url) {
  return isMainModule(argvPath, moduleUrl);
}

function fail(code) {
  throw new Error(code);
}

export function productionReceiverInstallPlan(root = "/opt/ssartnership/control/current") {
  if (root !== "/opt/ssartnership/control/current") fail("PRODUCTION_RECEIVER_CONTROL_ROOT_INVALID");
  return Object.freeze({
    root,
    unitSources: PRODUCTION_RECEIVER_UNITS.map((unit) => path.join(root, "deploy/self-host-ci", unit)),
    unitTargets: PRODUCTION_RECEIVER_UNITS.map((unit) => path.join("/etc/systemd/system", unit)),
    timer: PRODUCTION_RECEIVER_UNITS[1],
    stateRoot: path.dirname(RECEIVER_PROFILES.production.config.stateFile),
    releaseRoot: RECEIVER_PROFILES.production.config.releaseRoot,
  });
}

async function assertRootSecret(file) {
  await assertOperatorInput(file);
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.nlink !== 1 || (metadata.mode & 0o077) !== 0) fail("PRODUCTION_RECEIVER_SECRET_INVALID");
}

async function installUnit(source, target) {
  await assertOperatorInput(source);
  const expected = await readFile(source);
  try {
    const metadata = await lstat(target);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.uid !== 0 || (metadata.mode & 0o022) !== 0
      || !(await readFile(target)).equals(expected)) fail("PRODUCTION_RECEIVER_UNIT_CONFLICT");
    return;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const temporary = `${target}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, expected, { flag: "wx", mode: 0o644 });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function ensureHeavyLock() {
  const file = "/var/lib/ssartnership-ci/heavy.lock";
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  let handle;
  try {
    handle = await open(file, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  } finally {
    await handle?.close();
  }
  await assertOperatorInput(file);
  await chmod(file, 0o600);
}

export async function installProductionReceiver({
  operator = process.getuid?.() === 0,
  controlRoot = "/opt/ssartnership/control/current",
  execute = execFileSync,
} = {}) {
  if (!operator) fail("PRODUCTION_RECEIVER_OPERATOR_REQUIRED");
  const plan = productionReceiverInstallPlan(controlRoot);
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const canonicalControlRoot = await realpath(controlRoot);
  if (await realpath(sourceRoot) !== canonicalControlRoot) fail("PRODUCTION_RECEIVER_CONTROL_VERSION_INVALID");
  await assertOperatorInput(canonicalControlRoot, { directory: true });
  await assertOperatorInput("/opt/ssartnership/node24/node");
  await assertOperatorInput(await realpath(RECEIVER_PROFILES.production.config.composeFile));
  for (const file of [RECEIVER_PROFILES.production.config.runtimeEnvFile, RECEIVER_PROFILES.production.config.tokenFile, RECEIVER_PROFILES.production.config.schemaApprovalFile]) {
    await assertRootSecret(file);
  }
  await readRootToken(RECEIVER_PROFILES.production.config.tokenFile);
  await readRootSchemaApproval(RECEIVER_PROFILES.production.config.schemaApprovalFile, RECEIVER_PROFILES.production.schema);
  await mkdir(plan.stateRoot, { recursive: true, mode: 0o700 });
  await mkdir(plan.releaseRoot, { recursive: true, mode: 0o700 });
  await ensureHeavyLock();
  for (const [index, source] of plan.unitSources.entries()) await installUnit(await realpath(source), plan.unitTargets[index]);
  execute("systemd-analyze", ["verify", ...plan.unitTargets], { stdio: "pipe" });
  execute("systemctl", ["daemon-reload"], { stdio: "pipe" });
  execute("systemctl", ["enable", "--now", plan.timer], { stdio: "pipe" });
  return { installed: true, timer: plan.timer, firstPoll: "scheduled", databaseMigrationsApplied: false };
}

if (isInstallerMainModule()) {
  installProductionReceiver()
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch(() => { process.stderr.write('{"error":"PRODUCTION_RECEIVER_INSTALL_FAILED"}\n'); process.exitCode = 1; });
}
