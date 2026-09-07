// Explicit Docker integration fixture; not part of the ordinary Node suite.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import yaml from "js-yaml";
import { DATABASE_PASSWORD_ROLES, assertRotationRoles, createPasswordVerifier, renderPasswordRotationSql } from "../../scripts/self-host-operations/database-credentials.mjs";

const image = process.argv[2];
if (!/^sha256:[a-f0-9]{64}$/u.test(image ?? "")) throw new Error("IMMUTABLE_DATABASE_IMAGE_REQUIRED");
const name = `ssartnership-rotation-${randomUUID()}`;
const network = `${name}-net`;
const password = randomBytes(32).toString("hex");
const next = randomBytes(32).toString("hex");
const canary = randomBytes(32).toString("hex");
const environment = { PATH: process.env.PATH, HOME: process.env.HOME, DOCKER_HOST: process.env.DOCKER_HOST };
function docker(args, input, extra = {}) {
  const r = spawnSync("docker", args, { env: { ...environment, ...extra }, input, encoding: "utf8", timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
  if (r.error) throw new Error("DOCKER_PROCESS_FAILED");
  return r;
}
function ok(args, input, extra) { const r = docker(args, input, extra); if (r.status !== 0) throw new Error("DOCKER_COMMAND_FAILED"); return r.stdout; }
const sql = (input) => ok(["exec", "-i", "--user", "postgres", name, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "supabase_admin", "-d", "postgres"], input);
let created = false;
let networkCreated = false;
try {
  const command = yaml.load(await readFile(new URL("../../compose.supabase.yaml", import.meta.url), "utf8")).services.db.command;
  ok(["network", "create", "--internal", network]); networkCreated = true;
  ok(["run", "-d", "--name", name, "--platform", "linux/amd64", "--network", network, "--memory", "1g", "--memory-swap", "1g", "--cpus", "1", "--pids-limit", "256",
    "--tmpfs", "/var/lib/postgresql/data:rw,size=256m", "--env", "POSTGRES_PASSWORD", "--env", "PGPASSWORD", "--env", "POSTGRES_USER=supabase_admin", "--env", "POSTGRES_DB=postgres", "--env", "POSTGRES_HOST=/var/run/postgresql",
    "--mount", `type=bind,src=${process.cwd()}/deploy/supabase/init/99-local-credentials.sql,dst=/docker-entrypoint-initdb.d/init-scripts/99-local-credentials.sql,readonly`, image, ...command], undefined, { POSTGRES_PASSWORD: password, PGPASSWORD: password }); created = true;
  const deadline = Date.now() + 180_000;
  let ready = false;
  while (Date.now() < deadline) {
    const logs = docker(["logs", name]);
    if ((logs.stdout + logs.stderr).includes("PostgreSQL init process complete") && docker(["exec", name, "pg_isready", "-U", "supabase_admin", "-d", "postgres"]).status === 0) { ready = true; break; }
    if (!JSON.parse(ok(["inspect", "--format", "{{json .State.Running}}", name]))) throw new Error("DATABASE_STARTUP_EXIT");
    await delay(1000);
  }
  assert(ready, "DATABASE_READY_DEADLINE");
  assertRotationRoles(JSON.parse(sql("SELECT json_agg(json_build_object('name',rolname,'password',rolpassword)) FROM pg_authid WHERE rolcanlogin;")), password);
  const verifiers = Object.fromEntries(DATABASE_PASSWORD_ROLES.map((role) => [role, createPasswordVerifier(next)]));
  sql(renderPasswordRotationSql(verifiers));
  assertRotationRoles(JSON.parse(sql("SELECT json_agg(json_build_object('name',rolname,'password',rolpassword)) FROM pg_authid WHERE rolcanlogin;")), next);
  // Use another network namespace: loopback is trust-authenticated upstream.
  for (const role of DATABASE_PASSWORD_ROLES) {
    const args = ["run", "--rm", "--platform", "linux/amd64", "--network", network, "--read-only", "--cap-drop", "ALL", "--memory", "128m", "--pids-limit", "64", "--env", "PGPASSWORD", "--entrypoint", "psql", image, "-X", "-w", "-h", name, "-U", role, "-d", "postgres", "-c", "SELECT 1"];
    assert.equal(docker(args, undefined, { PGPASSWORD: next }).status, 0, "NEW_PASSWORD_MUST_AUTHENTICATE");
    assert.notEqual(docker(args, undefined, { PGPASSWORD: password }).status, 0, "OLD_PASSWORD_MUST_FAIL");
  }
  const failure = docker(["exec", "-i", "--user", "postgres", name, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "supabase_admin", "-d", "postgres"], `ALTER ROLE ssartnership_missing_rotation_role PASSWORD '${canary}';`);
  assert.notEqual(failure.status, 0);
  const logs = docker(["logs", name]); const raw = logs.stdout + logs.stderr;
  assert([password, next, canary, ...Object.values(verifiers)].every((value) => !raw.includes(value)), "CREDENTIAL_LOG_BOUNDARY");
  assert(raw.split("\n").some((line) => line.includes("ERROR:") && line.includes("ssartnership_missing_rotation_role")), "ERROR_RETAINED");
  console.log(JSON.stringify({ verified: true, roles: 4, newPasswordAccepted: 4, oldPasswordRejected: 4, startupAndFailureCredentialMatches: 0, errorRetained: true, platform: "linux/amd64", privateNetwork: true, publishedPorts: 0 }));
} finally {
  if (created) ok(["rm", "--force", name]);
  if (networkCreated) ok(["network", "rm", network]);
}
