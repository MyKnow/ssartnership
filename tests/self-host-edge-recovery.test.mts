import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { dockerArguments, EDGE, inspectManagedContainer, probeTls, reconcileEdge } from "../scripts/self-host-operations/edge-recovery.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONTAINER_ID = "0123456789ab";
const PORT_BINDINGS = JSON.stringify({ "443/tcp": [{ HostIp: "0.0.0.0", HostPort: "443" }] });
type RecoveryState = { consecutiveFailures: number; lastRecoveryAt: number };

function stateStore(initial: RecoveryState = { consecutiveFailures: 0, lastRecoveryAt: 0 }) {
  let current = structuredClone(initial);
  const writes: RecoveryState[] = [];
  return {
    writes,
    async read() { return structuredClone(current); },
    async write(next: RecoveryState) { current = structuredClone(next); writes.push(structuredClone(next)); },
  };
}

function metadata(status: string = "running", project: string = EDGE.project, service: string = EDGE.service, ports: string = PORT_BINDINGS) {
  return `${status}\t${project}\t${service}\t${ports}`;
}

class FakeTlsSocket extends EventEmitter {
  authorized = true;
  request = "";
  ended = false;
  destroyed = false;

  write(value: string) { this.request += value; return true; }
  end() { this.ended = true; }
  destroy() { this.destroyed = true; }
}

test("Docker inspection selects the single labeled edge and requires a public 443 binding", () => {
  const calls: string[][] = [];
  const run = (args: string[]) => {
    calls.push(args);
    if (args[0] === "ps") return CONTAINER_ID;
    return metadata();
  };

  const container = inspectManagedContainer(undefined, run);

  assert.equal(container.id, CONTAINER_ID);
  assert.equal(container.status, "running");
  assert.deepEqual(calls[0], [
    "ps", "-aq",
    "--filter", `label=com.docker.compose.project=${EDGE.project}`,
    "--filter", `label=com.docker.compose.service=${EDGE.service}`,
  ]);
  assert.equal(calls[1][0], "inspect");
  assert.equal(calls[1].at(-1), CONTAINER_ID);
  assert.ok(calls.every((args) => args[0] === "ps" || args[0] === "inspect"));
  assert.deepEqual(dockerArguments(["ps"]), ["--host", "unix:///var/run/docker.sock", "ps"]);
});

test("Docker inspection rejects another service and a non-public TLS port", () => {
  const inspect = (output: string) => () => inspectManagedContainer(CONTAINER_ID, () => output);
  assert.throws(inspect(metadata("running", "other-project")), { code: "EDGE_CONTAINER_SCOPE_MISMATCH" });
  assert.throws(inspect(metadata("running", EDGE.project, EDGE.service, JSON.stringify({ "443/tcp": [{ HostIp: "127.0.0.1", HostPort: "443" }] }))), { code: "EDGE_TLS_BINDING_MISMATCH" });
});

test("TLS probe validates the certificate for each SNI host without consulting app or API health", async () => {
  const socket = new FakeTlsSocket();
  let options: import("node:tls").ConnectionOptions | undefined;
  const result = probeTls(EDGE.hosts[0], {
    connect: ((received: import("node:tls").ConnectionOptions) => {
      options = received;
      queueMicrotask(() => socket.emit("secureConnect"));
      return socket as unknown as import("node:tls").TLSSocket;
    }) as unknown as typeof import("node:tls").connect,
    timeoutMs: 100,
  });

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(options?.host, EDGE.host);
  assert.equal(options?.port, EDGE.port);
  assert.equal(options?.servername, EDGE.hosts[0]);
  assert.equal(options?.rejectUnauthorized, true);
  assert.equal(socket.request, "");
  assert.equal(socket.ended, true);
  await assert.doesNotReject(result);
});

test("TLS probe fails closed for an invalid certificate and for a listener timeout", async () => {
  const invalidCertificate = new FakeTlsSocket();
  invalidCertificate.authorized = false;
  const invalidResult = probeTls(EDGE.hosts[0], {
    connect: (() => {
      queueMicrotask(() => invalidCertificate.emit("secureConnect"));
      return invalidCertificate as unknown as import("node:tls").TLSSocket;
    }) as unknown as typeof import("node:tls").connect,
    timeoutMs: 100,
  });
  await assert.rejects(invalidResult, { code: "EDGE_TLS_CERTIFICATE_INVALID" });
  assert.equal(invalidCertificate.destroyed, true);

  const silentSocket = new FakeTlsSocket();
  const timeoutResult = probeTls(EDGE.hosts[0], {
    connect: (() => silentSocket as unknown as import("node:tls").TLSSocket) as unknown as typeof import("node:tls").connect,
    timeoutMs: 10,
  });
  await assert.rejects(timeoutResult, { code: "EDGE_TLS_PROBE_TIMEOUT" });
  assert.equal(silentSocket.destroyed, true);
});

test("a healthy TLS listener clears failures for both public hostnames without consulting app health", async () => {
  const state = stateStore({ consecutiveFailures: 1, lastRecoveryAt: 12 });
  const inspected: string[] = [];
  const result = await reconcileEdge({
    inspect: async () => ({ id: CONTAINER_ID, status: "running" }),
    probe: async (hostname) => { inspected.push(hostname); },
    state,
    now: () => 100_000,
  });

  assert.deepEqual(result, { state: "healthy", action: "none", failures: [] });
  assert.deepEqual(inspected.sort(), [...EDGE.hosts].sort());
  assert.deepEqual(state.writes.at(-1), { consecutiveFailures: 0, lastRecoveryAt: 12 });
});

test("a stopped edge starts only the edge and waits for both TLS listeners", async () => {
  const state = stateStore();
  const actions: string[] = [];
  const inspected: string[] = [];
  const result = await reconcileEdge({
    inspect: async () => ({ id: CONTAINER_ID, status: "exited" }),
    start: (id) => actions.push(`start:${id}`),
    restart: (id) => actions.push(`restart:${id}`),
    probe: async (hostname) => { inspected.push(hostname); },
    state,
    now: () => 600_000,
  });

  assert.deepEqual(result, { state: "healthy", action: "started", failures: [] });
  assert.deepEqual(actions, [`start:${CONTAINER_ID}`]);
  assert.deepEqual(inspected.sort(), [...EDGE.hosts].sort());
  assert.deepEqual(state.writes[0], { consecutiveFailures: 0, lastRecoveryAt: 600_000 });
});

test("a paused edge is unpaused, while unsupported states fail closed", async () => {
  const actions: string[] = [];
  const resumed = await reconcileEdge({
    inspect: async () => ({ id: CONTAINER_ID, status: "paused" }),
    unpause: (id) => actions.push(`unpause:${id}`),
    probe: async () => {},
    state: stateStore(),
    now: () => 600_000,
  });
  assert.equal(resumed.action, "unpaused");
  assert.deepEqual(actions, [`unpause:${CONTAINER_ID}`]);
  await assert.rejects(reconcileEdge({
    inspect: async () => ({ id: CONTAINER_ID, status: "removing" }),
    state: stateStore(),
  }), { code: "EDGE_CONTAINER_STATE_UNSUPPORTED" });
});

test("one failure is only recorded; the second failure may restart just Caddy once", async () => {
  const state = stateStore({ consecutiveFailures: 0, lastRecoveryAt: 1 });
  const restarts: string[] = [];
  let probes = 0;
  const probe = async () => {
    probes += 1;
    if (probes <= EDGE.hosts.length * 2) throw new Error("edge TLS failure");
  };
  const options = {
    inspect: async () => ({ id: CONTAINER_ID, status: "running" }),
    restart: (id: string) => restarts.push(id),
    probe,
    state,
    now: () => 1_000_000,
  };

  const first = await reconcileEdge(options);
  assert.equal(first.state, "degraded");
  assert.deepEqual(restarts, []);
  assert.equal(state.writes.at(-1)?.consecutiveFailures, 1);

  const second = await reconcileEdge(options);
  assert.deepEqual(second, { state: "healthy", action: "restarted", failures: [...EDGE.hosts].sort() });
  assert.deepEqual(restarts, [CONTAINER_ID]);
  assert.equal(state.writes.at(-1)?.lastRecoveryAt, 1_000_000);
});

test("upstream health is not a recovery input and cooldown prevents a restart loop", async () => {
  const recoveredState = stateStore({ consecutiveFailures: 0, lastRecoveryAt: 1 });
  const upstreamHealthy = false;
  let restarts = 0;
  const healthyEdge = await reconcileEdge({
    inspect: async () => ({ id: CONTAINER_ID, status: "running" }),
    restart: () => { restarts += 1; },
    probe: async () => {},
    state: recoveredState,
    now: () => 100_000,
  });
  assert.equal(upstreamHealthy, false);
  assert.equal(healthyEdge.state, "healthy");
  assert.equal(restarts, 0);

  await recoveredState.write({ consecutiveFailures: 0, lastRecoveryAt: 600_000 });
  const cooldown = await reconcileEdge({
    inspect: async () => ({ id: CONTAINER_ID, status: "running" }),
    restart: () => { restarts += 1; },
    probe: async () => { throw new Error("listener down"); },
    state: recoveredState,
    now: () => 660_000,
  });
  assert.equal(cooldown.state, "cooldown");
  assert.equal(restarts, 0);
});

test("systemd orders the timer after Docker and restricts writes to watchdog state", () => {
  const service = readFileSync(new URL("../deploy/self-host-operations/systemd/ssartnership-edge-recovery.service", import.meta.url), "utf8");
  const timer = readFileSync(new URL("../deploy/self-host-operations/systemd/ssartnership-edge-recovery.timer", import.meta.url), "utf8");

  assert.match(service, /^Requires=docker\.service$/mu);
  assert.match(service, /^After=docker\.service network-online\.target$/mu);
  assert.match(service, /^User=root$/mu);
  assert.match(service, /^RuntimeDirectoryPreserve=yes$/mu);
  assert.match(service, /^ProtectSystem=strict$/mu);
  assert.match(service, /^ReadWritePaths=\/run\/ssartnership-edge-recovery$/mu);
  assert.match(service, /^UnsetEnvironment=DOCKER_HOST DOCKER_CONTEXT NODE_OPTIONS$/mu);
  assert.doesNotMatch(service, /ssartnership-(?:app|db|storage|backup)/u);
  assert.match(timer, /^OnBootSec=60s$/mu);
  assert.match(timer, /^OnUnitActiveSec=60s$/mu);
});

test("the executable entrypoint rejects an unprivileged caller before Docker access", () => {
  const script = path.join(ROOT, "scripts/self-host-operations/edge-recovery.mjs");
  const result = spawnSync(process.execPath, ["--import", "data:text/javascript,process.getuid%3D()%3D%3E501", script], {
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(JSON.parse(result.stderr), { component: "public-edge", state: "failed", error: "EDGE_OPERATOR_REQUIRED" });
});
