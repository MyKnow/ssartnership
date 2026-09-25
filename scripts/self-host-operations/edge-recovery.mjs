#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { lstat, readFile, rename, writeFile, chmod } from "node:fs/promises";
import { realpathSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import tls from "node:tls";
import { fileURLToPath } from "node:url";

export const EDGE = Object.freeze({
  project: "ssartnership-edge",
  service: "caddy",
  hosts: Object.freeze(["ssartnership.myknow.xyz", "ssartnership-dev.myknow.xyz"]),
  host: "127.0.0.1",
  port: 443,
  dockerSocket: "unix:///var/run/docker.sock",
  stateDirectory: "/run/ssartnership-edge-recovery",
  failureThreshold: 2,
  recoveryCooldownMs: 5 * 60_000,
  probeTimeoutMs: 5_000,
  recoveryTimeoutMs: 45_000,
});

const STATE_FILE = path.join(EDGE.stateDirectory, "state.json");
const OPERATOR_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";

/** @param {string[]} args @returns {string[]} */
export function dockerArguments(args) {
  return ["--host", EDGE.dockerSocket, ...args];
}

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

/** @param {string[]} args @param {number} [timeout] @returns {string} */
function runDocker(args, timeout = 10_000) {
  if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT) fail("REMOTE_DOCKER_FORBIDDEN");
  try {
    return execFileSync("docker", dockerArguments(args), {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout, maxBuffer: 64 * 1024,
      env: { PATH: OPERATOR_PATH, LANG: "C.UTF-8" },
    }).trim();
  } catch {
    fail("DOCKER_COMMAND_FAILED");
  }
}

/** @param {(args: string[], timeout?: number) => string} [run] @returns {string} */
function listManagedContainers(run = runDocker) {
	const ids = run([
    "ps", "-aq",
    "--filter", `label=com.docker.compose.project=${EDGE.project}`,
    "--filter", `label=com.docker.compose.service=${EDGE.service}`,
  ]).split(/\s+/u).filter(Boolean);
  if (ids.length !== 1 || !/^[a-f0-9]{12,64}$/u.test(ids[0])) fail("EDGE_CONTAINER_CARDINALITY_INVALID");
  return ids[0];
}

/**
 * @param {string} output
 * @returns {{status: string, project: string, service: string, ports: Record<string, {HostIp: string, HostPort: string}[]>}}
 */
export function parseContainerMetadata(output) {
  const [status, project, service, rawPorts] = output.split("\t");
  let ports;
  try { ports = JSON.parse(rawPorts); } catch { fail("EDGE_CONTAINER_METADATA_INVALID"); }
  return Object.freeze({ status, project, service, ports });
}

/**
 * @param {string} [id]
 * @param {(args: string[], timeout?: number) => string} [run]
 * @returns {Readonly<{id: string, status: string, project: string, service: string, ports: Record<string, {HostIp: string, HostPort: string}[]>}>}
 */
export function inspectManagedContainer(id, run = runDocker) {
	const containerId = id ?? listManagedContainers(run);
	const template = "{{.State.Status}}\t{{index .Config.Labels \"com.docker.compose.project\"}}\t{{index .Config.Labels \"com.docker.compose.service\"}}\t{{json .HostConfig.PortBindings}}";
	const result = parseContainerMetadata(run(["inspect", "--format", template, containerId]));
	if (result.project !== EDGE.project || result.service !== EDGE.service) fail("EDGE_CONTAINER_SCOPE_MISMATCH");
  const tlsBinding = result.ports?.["443/tcp"] ?? [];
  if (!tlsBinding.some((binding) => ["", "0.0.0.0"].includes(binding.HostIp) && binding.HostPort === "443")) {
    fail("EDGE_TLS_BINDING_MISMATCH");
  }
	return Object.freeze({ id: containerId, ...result });
}

/**
 * @param {string} hostname
 * @param {{connect?: typeof tls.connect, timeoutMs?: number}} [options]
 * @returns {Promise<boolean>}
 */
export function probeTls(hostname, {
  connect = tls.connect,
  timeoutMs = EDGE.probeTimeoutMs,
} = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let socket;
    let timer;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(true);
    };
    timer = setTimeout(() => {
      socket?.destroy();
      finish(Object.assign(new Error("EDGE_TLS_PROBE_TIMEOUT"), { code: "EDGE_TLS_PROBE_TIMEOUT" }));
    }, timeoutMs);
    try {
      socket = connect({
        host: EDGE.host,
        port: EDGE.port,
        servername: hostname,
        rejectUnauthorized: true,
      });
      socket.once("secureConnect", () => {
        if (!socket.authorized) {
          socket.destroy();
          finish(Object.assign(new Error("EDGE_TLS_CERTIFICATE_INVALID"), { code: "EDGE_TLS_CERTIFICATE_INVALID" }));
          return;
        }
        socket.end();
        finish();
      });
      socket.once("error", () => finish(Object.assign(new Error("EDGE_TLS_PROBE_FAILED"), { code: "EDGE_TLS_PROBE_FAILED" })));
    } catch {
      finish(Object.assign(new Error("EDGE_TLS_PROBE_FAILED"), { code: "EDGE_TLS_PROBE_FAILED" }));
    }
  });
}

function defaultState() {
  return { consecutiveFailures: 0, lastRecoveryAt: 0 };
}

async function readState() {
  let info;
  try { info = await lstat(STATE_FILE); }
  catch (error) { if (error?.code === "ENOENT") return defaultState(); throw error; }
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== 0 || (info.mode & 0o077) !== 0) fail("EDGE_STATE_FILE_UNSAFE");
  let value;
  try { value = JSON.parse(await readFile(STATE_FILE, "utf8")); }
  catch { fail("EDGE_STATE_FILE_INVALID"); }
  if (!Number.isSafeInteger(value.consecutiveFailures) || value.consecutiveFailures < 0
    || !Number.isSafeInteger(value.lastRecoveryAt) || value.lastRecoveryAt < 0) fail("EDGE_STATE_FILE_INVALID");
  return value;
}

async function writeState(state) {
  const directory = await lstat(EDGE.stateDirectory);
  if (!directory.isDirectory() || directory.isSymbolicLink() || directory.uid !== 0 || (directory.mode & 0o077) !== 0) {
    fail("EDGE_STATE_DIRECTORY_UNSAFE");
  }
  const temporary = path.join(EDGE.stateDirectory, `.state-${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(state)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await chmod(temporary, 0o600);
  await rename(temporary, STATE_FILE);
}

/** @param {(hostname: string) => Promise<unknown>} [probe] @returns {Promise<string[]>} */
async function probeHosts(probe = probeTls) {
  const failures = [];
  await Promise.all(EDGE.hosts.map(async (hostname) => {
    try { await probe(hostname); }
    catch { failures.push(hostname); }
  }));
  return failures.sort();
}

/**
 * @param {(hostname: string) => Promise<unknown>} probe
 * @param {(delay: number) => Promise<unknown>} sleep
 * @param {() => number} now
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
async function waitForTls(probe, sleep, now, timeoutMs = EDGE.recoveryTimeoutMs) {
  const deadline = now() + timeoutMs;
  do {
    const failures = await probeHosts(probe);
    if (failures.length === 0) return true;
    await sleep(2_000);
  } while (now() < deadline);
  return false;
}

/**
 * @typedef {{consecutiveFailures: number, lastRecoveryAt: number}} RecoveryState
 * @typedef {{read: () => Promise<RecoveryState>, write: (state: RecoveryState) => Promise<void>}} RecoveryStateStore
 * @typedef {{id: string, status: string}} EdgeContainer
 * @param {{
 *   inspect?: () => EdgeContainer | Promise<EdgeContainer>,
 *   start?: (id: string) => unknown,
 *   unpause?: (id: string) => unknown,
 *   restart?: (id: string) => unknown,
 *   probe?: (hostname: string) => Promise<unknown>,
 *   state?: RecoveryStateStore,
 *   now?: () => number,
 *   sleep?: (delay: number) => Promise<unknown>,
 * }} [options]
 */
export async function reconcileEdge({
  inspect = inspectManagedContainer,
  start = (id) => runDocker(["start", id]),
  unpause = (id) => runDocker(["unpause", id]),
  restart = (id) => runDocker(["restart", id]),
  probe = probeTls,
  state = { read: readState, write: writeState },
  now = Date.now,
  sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
} = {}) {
	const container = await inspect();
  let status = await state.read();

  if (container.status === "restarting") {
    const failures = await probeHosts(probe);
    await state.write({ consecutiveFailures: 0, lastRecoveryAt: status.lastRecoveryAt });
    return { state: failures.length ? "recovering" : "healthy", action: "none", failures };
  }

  if (container.status !== "running") {
    if (container.status !== "paused" && !["created", "exited", "dead"].includes(container.status)) {
      fail("EDGE_CONTAINER_STATE_UNSUPPORTED");
    }
    if (status.lastRecoveryAt > 0 && now() - status.lastRecoveryAt < EDGE.recoveryCooldownMs) {
      return { state: "cooldown", action: "none", failures: EDGE.hosts };
    }
    status = { consecutiveFailures: 0, lastRecoveryAt: now() };
    await state.write(status);
    const action = container.status === "paused" ? "unpaused" : "started";
    if (container.status === "paused") unpause(container.id);
    else start(container.id);
    const healthy = await waitForTls(probe, sleep, now);
    if (!healthy) fail("EDGE_START_RECOVERY_FAILED");
    return { state: "healthy", action, failures: [] };
  }

  const failures = await probeHosts(probe);
  if (failures.length === 0) {
    await state.write({ consecutiveFailures: 0, lastRecoveryAt: status.lastRecoveryAt });
    return { state: "healthy", action: "none", failures };
  }

  status.consecutiveFailures += 1;
  const cooldownActive = now() - status.lastRecoveryAt < EDGE.recoveryCooldownMs;
  if (status.consecutiveFailures < EDGE.failureThreshold || cooldownActive) {
    await state.write(status);
    return { state: cooldownActive ? "cooldown" : "degraded", action: "none", failures };
  }

  status = { consecutiveFailures: 0, lastRecoveryAt: now() };
  await state.write(status);
  restart(container.id);
  if (!await waitForTls(probe, sleep, now)) fail("EDGE_RESTART_RECOVERY_FAILED");
  return { state: "healthy", action: "restarted", failures };
}

async function main() {
	try {
		if (process.getuid?.() !== 0) fail("EDGE_OPERATOR_REQUIRED");
		const result = await reconcileEdge();
    process.stdout.write(`${JSON.stringify({ component: "public-edge", ...result })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ component: "public-edge", state: "failed", error: error?.code ?? "EDGE_RECOVERY_FAILED" })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
