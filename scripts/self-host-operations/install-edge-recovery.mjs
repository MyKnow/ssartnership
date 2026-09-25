#!/opt/ssartnership/node24/node
import { execFileSync } from "node:child_process";
import { lstat, readFile, realpath, writeFile, chmod, link, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { inspectManagedContainer } from "./edge-recovery.mjs";

const NODE = "/opt/ssartnership/node24/node";
const UNIT_DIRECTORY = "/etc/systemd/system";
const UNIT_NAMES = Object.freeze([
  "ssartnership-edge-recovery.service",
  "ssartnership-edge-recovery.timer",
]);
const SAFE_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function run(command, args, timeout = 30_000) {
  try {
    execFileSync(command, args, {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout, maxBuffer: 64 * 1024,
      env: { PATH: SAFE_PATH, LANG: "C.UTF-8" },
    });
  } catch {
    fail("EDGE_INSTALL_COMMAND_FAILED");
  }
}

async function assertRootOwnedPath(target) {
  let current = target;
  while (true) {
    const metadata = await lstat(current);
    if (metadata.isSymbolicLink() || metadata.uid !== 0 || (metadata.mode & 0o022) !== 0) {
      fail("EDGE_INSTALL_PATH_UNSAFE");
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

async function sourceRoot() {
  const scriptPath = await realpath(fileURLToPath(import.meta.url));
  const root = path.dirname(path.dirname(path.dirname(scriptPath)));
  if (await realpath(root) !== root) fail("EDGE_INSTALL_SOURCE_PATH_INVALID");
  await assertRootOwnedPath(root);
  return root;
}

async function ensureInstalledUnit(destination, contents) {
  try {
    const metadata = await lstat(destination);
    if (metadata.isSymbolicLink() || !metadata.isFile() || metadata.uid !== 0
      || (metadata.mode & 0o777) !== 0o644 || await readFile(destination, "utf8") !== contents) {
      fail("EDGE_INSTALL_UNIT_CONFLICT");
    }
    return;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const temporary = path.join(UNIT_DIRECTORY, `.ssartnership-edge-recovery-${randomUUID()}.tmp`);
  await writeFile(temporary, contents, { encoding: "utf8", mode: 0o644, flag: "wx" });
  await chmod(temporary, 0o644);
  try {
    await link(temporary, destination);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = await lstat(destination);
    if (existing.isSymbolicLink() || !existing.isFile() || existing.uid !== 0
      || (existing.mode & 0o777) !== 0o644 || await readFile(destination, "utf8") !== contents) {
      fail("EDGE_INSTALL_UNIT_CONFLICT");
    }
  } finally {
    await unlink(temporary);
  }
}

async function install() {
  if (process.getuid?.() !== 0) fail("EDGE_OPERATOR_REQUIRED");
  if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT) fail("REMOTE_DOCKER_FORBIDDEN");
  process.env.PATH = SAFE_PATH;

  const nodeVersion = runVersion(NODE);
  const version = /^v24\.(\d+)\.(\d+)$/u.exec(nodeVersion);
  if (!version || Number(version[1]) < 18 || (Number(version[1]) === 18 && Number(version[2]) < 1)) {
    fail("EDGE_INSTALL_NODE_VERSION_INVALID");
  }
  await assertRootOwnedPath(NODE);

  const root = await sourceRoot();
  const units = await Promise.all(UNIT_NAMES.map(async (name) => {
    const source = path.join(root, "deploy/self-host-operations/systemd", name);
    await assertRootOwnedPath(source);
    return { name, contents: await readFile(source, "utf8") };
  }));

  const docker = await inspectManagedContainer();
  if (docker.project !== "ssartnership-edge" || docker.service !== "caddy") fail("EDGE_CONTAINER_SCOPE_MISMATCH");

  await assertRootOwnedPath(UNIT_DIRECTORY);
  await Promise.all(units.map(({ name, contents }) => ensureInstalledUnit(path.join(UNIT_DIRECTORY, name), contents)));
  run("/usr/bin/systemd-analyze", ["verify", ...UNIT_NAMES.map((name) => path.join(UNIT_DIRECTORY, name))]);
  run("/usr/bin/systemctl", ["daemon-reload"]);
  run("/usr/bin/systemctl", ["enable", "--now", "ssartnership-edge-recovery.timer"]);
  run("/usr/bin/systemctl", ["start", "ssartnership-edge-recovery.service"], 120_000);
  process.stdout.write('{"component":"public-edge","state":"installed","timer":"active"}\n');
}

function runVersion(binary) {
  try {
    return execFileSync(binary, ["--version"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 5_000,
      env: { PATH: SAFE_PATH, LANG: "C.UTF-8" },
    }).trim();
  } catch {
    fail("EDGE_INSTALL_NODE_UNAVAILABLE");
  }
}

try {
  await install();
} catch (error) {
  process.stderr.write(`${JSON.stringify({ component: "public-edge", state: "install-failed", error: error?.code ?? "EDGE_INSTALL_FAILED" })}\n`);
  process.exitCode = 1;
}
