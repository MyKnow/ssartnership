import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabaseEnvironment, validateDatabaseEnvironment, renderEnvironmentFile, validateProjectName } from "../self-host-database/lib.mjs";
import { createLocalRuntimeEnvironment } from "../../deploy/self-host/write-local-runtime-env.mjs";
import { createOperationsEnvironment, serializeEnvironment, readEnvironment, defaultStateDirectory } from "../self-host-operations/lib.mjs";

export const fail = (code) => { throw new Error(code); };
const secretNames = ["POSTGRES_PASSWORD", "JWT_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"];
const runtimeSecrets = ["ADMIN_SESSION_SECRET", "USER_SESSION_SECRET", "PARTNER_SESSION_SECRET", "CERTIFICATION_QR_SECRET", "MEMBER_IDENTIFIER_RESERVATION_HMAC_SECRET", "MEMBER_EMAIL_VERIFICATION_HMAC_SECRET", "GRADUATE_VERIFICATION_HMAC_SECRET", "MM_SENDER_CREDENTIALS_KEY_V1", "CRON_SECRET"];
const portValid = (value) => Number.isInteger(value) && value >= 1024 && value <= 65535;

export function createEnvironmentPair({ prefix = `ssartnership-dual-${randomUUID().slice(0, 8)}`, productionPort = 3210, previewPort = 3220, productionGatewayPort = 58110, previewGatewayPort = 58120 } = {}) {
  const create = (environment, appPort, gatewayPort) => {
    const project = validateProjectName(`${prefix}-${environment === "production" ? "prod" : "preview"}`);
    const data = createDatabaseEnvironment({ project, port: String(gatewayPort) });
    const runtime = { ...createLocalRuntimeEnvironment(data), NEXT_PUBLIC_SITE_URL: `http://${environment === "preview" ? "localhost" : "127.0.0.1"}:${appPort}`, SELF_HOST_ENVIRONMENT: environment, SELF_HOST_OUTBOUND_MODE: environment === "preview" ? "blocked" : "enabled" };
    return { environment, project, appPort, gatewayPort, data, runtime };
  };
  const pair = { version: 1, production: create("production", productionPort, productionGatewayPort), preview: create("preview", previewPort, previewGatewayPort) };
  validateEnvironmentPair(pair);
  return pair;
}

export function validateEnvironmentPair(pair) {
  try {
    if (pair?.version !== 1) fail("INVALID");
    const { production: a, preview: b } = pair;
    if (a.environment !== "production" || b.environment !== "preview" || a.project === b.project) fail("INVALID");
    const ports = [a.appPort, b.appPort, a.gatewayPort, b.gatewayPort];
    if (!ports.every(portValid) || new Set(ports).size !== 4) fail("INVALID");
    for (const env of [a, b]) {
      validateProjectName(env.project);
      validateDatabaseEnvironment(env.data);
      if (env.project !== env.data.COMPOSE_PROJECT_NAME || String(env.gatewayPort) !== env.data.SUPABASE_GATEWAY_PORT
        || env.runtime.NEXT_PUBLIC_SITE_URL !== `http://${env.environment === "preview" ? "localhost" : "127.0.0.1"}:${env.appPort}`
        || env.runtime.NEXT_PUBLIC_SUPABASE_URL !== env.data.SUPABASE_URL
        || env.runtime.SUPABASE_INTERNAL_URL !== "http://gateway:8000"
        || env.runtime.SUPABASE_SERVICE_ROLE_KEY !== env.data.SUPABASE_SERVICE_ROLE_KEY
        || env.runtime.SELF_HOST_ENVIRONMENT !== env.environment) fail("INVALID");
    }
    if (b.runtime.SELF_HOST_OUTBOUND_MODE !== "blocked") fail("INVALID");
    for (const key of secretNames) if (a.data[key] === b.data[key]) fail("INVALID");
    for (const key of runtimeSecrets) if (!a.runtime[key] || !b.runtime[key] || a.runtime[key] === b.runtime[key]) fail("INVALID");
  } catch { fail("ENVIRONMENT_PAIR_INVALID"); }
  return pair;
}

export function environmentOverlay(profile) {
  const preview = profile.environment === "preview";
  const limits = preview ? ["512m", "768m", "128m", "384m", "256m"] : ["768m", "1536m", "128m", "512m", "384m"];
  const services = Object.fromEntries(["app", "db", "rest", "storage", "gateway"].map((name, i) => [name, {
    mem_limit: limits[i], cpus: preview ? 0.5 : 1.5, pids_limit: 256,
    logging: { driver: "local", options: { "max-size": "10m", "max-file": "3" } },
    labels: { "io.ssartnership.environment": profile.environment },
  }]));
  // Preview app/gateway are removed from edge by the tagged YAML overlay.
  // Only the fixed-upstream ingress joins an external bridge.
  const result = { services: {
    app: { ...services.app, environment: { SELF_HOST_ENVIRONMENT: profile.environment, SELF_HOST_OUTBOUND_MODE: preview ? "blocked" : "enabled" } },
    db: services.db, rest: services.rest, storage: services.storage, gateway: services.gateway,
  }, networks: { edge: { internal: preview } } };
  return result;
}

export function renderEnvironmentOverlay(profile) {
  const overlay = environmentOverlay(profile);
  const preview = profile.environment === "preview";
  const lines = ["services:"];
  for (const [name, config] of Object.entries(overlay.services)) {
    lines.push(`  ${name}:`);
    for (const [key, value] of Object.entries(config)) lines.push(`    ${key}: ${JSON.stringify(value)}`);
    if (preview && ["app", "gateway"].includes(name)) lines.push("    networks: !override [default]", "    ports: !reset []");
  }
  if (preview) {
    const script = fileURLToPath(new URL("../../deploy/self-host/preview-ingress.mjs", import.meta.url));
    const ingress = {
      image: "node:24.18.1-bookworm-slim@sha256:235600a8101ab264e117b1768e925532262668dc9b581ef1dd7d96ced463b8e7",
      restart: "unless-stopped", read_only: true, user: "node", cap_drop: ["ALL"], security_opt: ["no-new-privileges:true"],
      mem_limit: "96m", cpus: 0.25, pids_limit: 64, networks: ["default", "ingress_edge"],
      volumes: [`${script}:/preview-ingress.mjs:ro`], command: ["node", "/preview-ingress.mjs"],
      ports: [`127.0.0.1:${profile.appPort}:8080`, `127.0.0.1:${profile.gatewayPort}:8081`],
      logging: { driver: "local", options: { "max-size": "5m", "max-file": "2" } },
    };
    lines.push("  preview-ingress:");
    for (const [key, value] of Object.entries(ingress)) lines.push(`    ${key}: ${JSON.stringify(value)}`);
  }
  lines.push("networks:", `  edge: {internal: ${preview}}`);
  if (preview) lines.push("  ingress_edge: {internal: false}");
  return `${lines.join("\n")}\n`;
}

export async function assertPrivatePath(file, directory = false) {
  const resolved = path.resolve(file);
  let current = path.parse(resolved).root;
  for (const part of resolved.slice(current.length).split(path.sep)) {
    current = path.join(current, part);
    const info = await lstat(current);
    if (info.isSymbolicLink()) fail("ENVIRONMENT_SYMLINK_FORBIDDEN");
  }
  const info = await lstat(resolved);
  if ((directory ? !info.isDirectory() : !info.isFile()) || (info.mode & 0o077) !== 0 || info.uid !== process.getuid()) fail("ENVIRONMENT_FILE_PERMISSIONS");
  return resolved;
}

export async function initializePair(directory, options = {}) {
  const destination = path.resolve(directory);
  await assertPrivatePath(path.dirname(destination), true);
  const pair = createEnvironmentPair(options);
  await mkdir(destination, { mode: 0o700 }); // exclusive; never reinitialize
  for (const profile of [pair.production, pair.preview]) {
    const dir = path.join(destination, profile.environment);
    await mkdir(dir, { mode: 0o700 });
    const dataFile = path.join(dir, "data.env");
    const opsFile = path.join(dir, "operations.env");
    const runtimeFile = path.join(dir, "app.env");
    const operations = { ...createOperationsEnvironment(profile.project, opsFile), SELF_HOST_APP_PORT: String(profile.appPort), SELF_HOST_RUNTIME_ENV_FILE: runtimeFile };
    await writeFile(dataFile, renderEnvironmentFile(profile.data), { mode: 0o600, flag: "wx" });
    await writeFile(opsFile, serializeEnvironment(operations), { mode: 0o600, flag: "wx" });
    await writeFile(runtimeFile, serializeEnvironment(profile.runtime), { mode: 0o600, flag: "wx" });
    await writeFile(path.join(dir, "compose.yaml"), renderEnvironmentOverlay(profile), { mode: 0o600, flag: "wx" });
  }
  await writeFile(path.join(destination, "pair.json"), JSON.stringify(pair), { mode: 0o600, flag: "wx" });
  return { directory: destination, initialized: true };
}

export async function loadPair(directory) {
  const dir = await assertPrivatePath(directory, true);
  const file = await assertPrivatePath(path.join(dir, "pair.json"));
  const pair = validateEnvironmentPair(JSON.parse(await readFile(file, "utf8")));
  for (const role of ["production", "preview"]) {
    const profile = pair[role];
    const base = await assertPrivatePath(path.join(dir, role), true);
    for (const name of ["data.env", "operations.env", "app.env", "compose.yaml"]) await assertPrivatePath(path.join(base, name));
    // Descriptor and executable files cannot silently diverge or point to Prod.
    if (await readFile(path.join(base, "data.env"), "utf8") !== renderEnvironmentFile(profile.data)
      || await readFile(path.join(base, "app.env"), "utf8") !== serializeEnvironment(profile.runtime)
      || await readFile(path.join(base, "compose.yaml"), "utf8") !== renderEnvironmentOverlay(profile)) fail("ENVIRONMENT_FILE_DRIFT");
    const ops = await readEnvironment(path.join(base, "operations.env"), { requirePrivate: true });
    const expected = { PGBACKREST_REPOSITORY_VOLUME: `${profile.project}_pgbackrest-repo`, RESTIC_REPOSITORY_VOLUME: `${profile.project}_restic-repo`, SELF_HOST_OPERATIONS_STATE_DIR: defaultStateDirectory(path.join(base, "operations.env")), SELF_HOST_APP_PORT: String(profile.appPort), SELF_HOST_RUNTIME_ENV_FILE: path.join(base, "app.env") };
    if (Object.keys(ops).sort().join() !== [...Object.keys(expected), "PGBACKREST_REPO1_CIPHER_PASS", "RESTIC_PASSWORD"].sort().join()
      || Object.entries(expected).some(([key, value]) => ops[key] !== value)
      || ["PGBACKREST_REPO1_CIPHER_PASS", "RESTIC_PASSWORD"].some(key => !/^[a-f0-9]{64}$/u.test(ops[key]))) fail("ENVIRONMENT_OPERATIONS_DRIFT");
  }
  return pair;
}

export function pairComposeArgs(root, directory, profile) {
  const base = path.join(path.resolve(directory), profile.environment);
  return ["compose", "--project-name", profile.project, "--env-file", path.join(base, "data.env"), "--env-file", path.join(base, "operations.env"),
    ...["compose.yaml", "compose.supabase.yaml", "compose.operations.yaml"].flatMap(file => ["-f", path.join(root, file)]), "-f", path.join(base, "compose.yaml")];
}
