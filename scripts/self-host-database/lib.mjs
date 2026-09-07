import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile, stat } from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";
export const DATABASE_ENVIRONMENT_NAMES = Object.freeze(["POSTGRES_PASSWORD", "JWT_SECRET", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL", "SUPABASE_INTERNAL_URL", "SUPABASE_GATEWAY_PORT", "COMPOSE_PROJECT_NAME"]);
const PROJECT = /^ssartnership-[a-z0-9][a-z0-9_-]{0,50}$/u;
const BEGIN = /^(?:begin|start\s+transaction)\s*;\s*(?:\r?\n)?/iu;
const COMMIT = /(?:^|\r?\n)commit\s*;\s*$/iu;
const CONTROL = /^(?:begin|start\s+transaction|commit(?:\s+(?:work|and\s+chain))?|rollback(?:\s+(?:work|and\s+(?:no\s+)?chain|to(?:\s+savepoint)?\s+\S+))?|savepoint\s+\S+|release\s+savepoint\s+\S+)\s*;\s*$/gimu;
const LOCK = "658697132457291";
const error = code => new Error(`self-host database configuration error: ${code}`);
const b64 = value => Buffer.from(value).toString("base64url");
const random = () => randomBytes(48).toString("base64url");
function key(role, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64(JSON.stringify({
    alg: "HS256",
    typ: "JWT"
  }));
  const payload = b64(JSON.stringify({
    role,
    iss: "ssartnership-self-host",
    iat: now,
    exp: now + 157680000
  }));
  const input = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(input).digest("base64url");
  return `${input}.${signature}`;
}
function role(value, secret) {
  try {
    const [header, payload, signature] = value.split(".");
    const expected = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
    if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role ?? null;
  } catch {
    return null;
  }
}
export function deriveProjectName(file) {
  const suffix = basename(file).toLowerCase().replace(/\.env$/iu, "").replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 40) || "local";
  return `ssartnership-${suffix}`;
}
export function validateProjectName(value) {
  if (typeof value !== "string" || !PROJECT.test(value)) {
    throw error("compose_project_name_invalid");
  }
  return value;
}
export function parseGatewayPort(value) {
  if (!/^[1-9]\d{3,4}$/u.test(String(value))) throw error("gateway_port_invalid");
  const port = Number(value);
  if (port < 1024 || port > 65535) throw error("gateway_port_invalid");
  return port;
}
export function createDatabaseEnvironment({
  environmentFile = "dev.env",
  port = "58000",
  project
} = {}) {
  const gatewayPort = parseGatewayPort(port);
  const jwt = random();
  const postgres = random();
  const name = validateProjectName(project ?? deriveProjectName(environmentFile));
  const environment = {
    POSTGRES_PASSWORD: postgres,
    JWT_SECRET: jwt,
    SUPABASE_ANON_KEY: key("anon", jwt),
    SUPABASE_SERVICE_ROLE_KEY: key("service_role", jwt),
    SUPABASE_URL: `http://127.0.0.1:${gatewayPort}`,
    SUPABASE_INTERNAL_URL: "http://gateway:8000",
    SUPABASE_GATEWAY_PORT: String(gatewayPort),
    COMPOSE_PROJECT_NAME: name
  };
  return validateDatabaseEnvironment(environment);
}
export function parseEnvironmentText(text) {
  const result = {};
  for (const raw of text.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    const name = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (index < 1 || !/^[A-Z][A-Z0-9_]*$/u.test(name) || Object.hasOwn(result, name)) {
      throw error("environment_key_invalid");
    }
    if (!value || /[\u0000-\u001F\u007F]/u.test(value)) throw error("environment_value_invalid");
    result[name] = value;
  }
  return result;
}
export function validateDatabaseEnvironment(env) {
  for (const name of DATABASE_ENVIRONMENT_NAMES) {
    if (typeof env[name] !== "string" || !env[name].trim()) {
      throw error(`environment_value_required:${name}`);
    }
  }
  const port = parseGatewayPort(env.SUPABASE_GATEWAY_PORT);
  validateProjectName(env.COMPOSE_PROJECT_NAME);
  if (env.POSTGRES_PASSWORD.length < 32 || env.JWT_SECRET.length < 32) throw error("environment_secret_too_short");
  if (role(env.SUPABASE_ANON_KEY, env.JWT_SECRET) !== "anon") throw error("anon_key_invalid");
  if (role(env.SUPABASE_SERVICE_ROLE_KEY, env.JWT_SECRET) !== "service_role") throw error("service_role_key_invalid");
  if (env.SUPABASE_URL !== `http://127.0.0.1:${port}`) throw error("supabase_public_url_invalid");
  if (env.SUPABASE_INTERNAL_URL !== "http://gateway:8000") throw error("supabase_internal_url_invalid");
  return env;
}
export function renderEnvironmentFile(env) {
  validateDatabaseEnvironment(env);
  return `${DATABASE_ENVIRONMENT_NAMES.map(name => `${name}=${env[name]}`).join("\n")}\n`;
}
export function assertSafeEnvironmentOutputPath(file, root) {
  const output = resolve(file);
  const path = relative(resolve(root), output);
  if (!path || path === ".env" || path === ".." || path.startsWith(`..${sep}`) || !(path === ".tmp" || path.startsWith(`.tmp${sep}`))) throw error("environment_output_path_not_ignored");
  return output;
}
export async function writeNewEnvironmentFile(file, env, root) {
  const output = assertSafeEnvironmentOutputPath(file, root);
  await mkdir(dirname(output), {
    recursive: true,
    mode: 0o700
  });
  const handle = await open(output, "wx", 0o600);
  try {
    await handle.writeFile(renderEnvironmentFile(env), "utf8");
  } finally {
    await handle.close();
  }
  if (((await stat(output)).mode & 0o777) !== 0o600) throw error("environment_output_mode_invalid");
  return output;
}
export async function loadDatabaseEnvironment(file) {
  try {
    return validateDatabaseEnvironment(parseEnvironmentText(await readFile(resolve(file), "utf8")));
  } catch (cause) {
    if (String(cause).includes("configuration error")) throw cause;
    throw error("environment_file_unavailable");
  }
}
export function composeEnvironment(parent = process.env) {
  const result = {
    ...parent
  };
  for (const name of Object.keys(result)) {
    if (DATABASE_ENVIRONMENT_NAMES.includes(name) || /^(?:SELF_HOST|SUPABASE|POSTGRES|PGRST|KONG|STORAGE|JWT)_/u.test(name) || ["ANON_KEY", "SERVICE_ROLE_KEY", "PGPASSWORD", "PGDATABASE", "PGPORT"].includes(name) || name.startsWith("COMPOSE_")) delete result[name];
  }
  return result;
}
export function normalizeMigrationTransaction(source) {
  if (/^\s*\\/mu.test(source)) throw new Error("self-host database migration contains a psql directive");
  const controls = [...source.matchAll(CONTROL)];
  if (controls.length === 0) return source;
  if (!BEGIN.test(source) || !COMMIT.test(source) || controls.length !== 2) throw new Error("self-host database migration has unsupported top-level transaction control");
  return source.replace(BEGIN, "").replace(COMMIT, "").trim();
}
export function createMigrationPlan(migrations) {
  const seen = new Set();
  return [...migrations].sort((a, b) => a.name.localeCompare(b.name)).map(({
    name,
    source
  }) => {
    if (!/^(?:[0-9]{8}|[0-9]{14})_[a-z0-9_]+\.sql$/u.test(name) || seen.has(name)) throw new Error("self-host database migration name invalid");
    seen.add(name);
    return {
      name,
      checksum: createHash("sha256").update(source, "utf8").digest("hex"),
      source: normalizeMigrationTransaction(source)
    };
  });
}
export function evaluateMigrationLedger(plan, ledger = new Map()) {
  const pending = [];
  for (const migration of plan) {
    const stored = ledger.get(migration.name);
    if (stored === undefined) pending.push(migration);else if (stored !== migration.checksum) throw new Error(`self-host database migration checksum drift: ${migration.name}`);
  }
  return pending;
}
export function resolveSignedStorageUrl(storageBase, signedUrl) {
  if (typeof signedUrl !== "string" || !signedUrl.startsWith("/object/sign/") || signedUrl.startsWith("//") || /[\u0000-\u001F\u007F]/u.test(signedUrl)) throw error("storage_signed_url_invalid");
  const base = new URL(storageBase);
  if (base.pathname !== "/storage/v1" || base.search || base.hash || base.username || base.password) throw error("storage_base_url_invalid");
  return `${base.origin}${base.pathname}${signedUrl}`;
}
const literal = value => `'${value.replaceAll("'", "''")}'`;
export function renderMigrationRunnerSql(plan) {
  const lines = ["\\set ON_ERROR_STOP on", `select pg_advisory_lock(${LOCK});`, "begin;", "create schema if not exists self_host;", "create table if not exists self_host.migration_ledger (name text primary key, checksum text not null check (checksum ~ '^[0-9a-f]{64}$'), applied_at timestamp with time zone not null default now());", "commit;"];
  for (const migration of plan) {
    const name = literal(migration.name);
    const checksum = literal(migration.checksum);
    lines.push(
      `\\echo self_host_migration:${migration.name}`,
      "do $self_host_migration_drift$",
      "declare stored_checksum text;",
      "begin",
      `select checksum into stored_checksum from self_host.migration_ledger where name = ${name};`,
      `if stored_checksum is not null and stored_checksum <> ${checksum} then raise exception 'self_host_migration_checksum_drift:%', ${name}; end if;`,
      "end",
      "$self_host_migration_drift$;",
      `select case when exists (select 1 from self_host.migration_ledger where name = ${name}) then 'false' else 'true' end as self_host_pending \\gset`,
      "\\if :self_host_pending",
      "begin;",
      migration.source,
      `insert into self_host.migration_ledger (name, checksum) values (${name}, ${checksum});`,
      "commit;",
      "\\endif",
    );
  }
  return `${lines.concat(`select pg_advisory_unlock(${LOCK});`).join("\n")}\n`;
}
