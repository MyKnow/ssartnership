#!/usr/bin/env node
import { readFile, writeFile, rename, realpath } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { assertOperatorInput } from "../self-host-ci/lib.mjs";
import { runOperatorCommand } from "../self-host-ci/deployment.mjs";

const secrets = "/etc/myknow/secrets/ssartnership-preview";
const COMMANDS = ["backup-full", "backup-incr", "check", "restore", "collect", "db-check", "status", "offhost-capture", "offhost-check"];
export function maintenancePlan(command, data, operations, monitoring) {
  const common = ["--env-file", data, "--operations-env-file", operations];
  if (command === "backup-full" || command === "backup-incr") return ["scripts/self-host-operations/cli.mjs", "backup", "--type", command.slice(7), ...common];
  if (command === "check" || command === "restore" || command === "status") return ["scripts/self-host-operations/cli.mjs", command === "restore" ? "restore-drill" : command, ...common];
  if (command === "collect") return ["scripts/self-host-operations/monitoring.mjs", "collect", monitoring, data, operations];
  if (command === "offhost-capture" || command === "offhost-check") return ["scripts/self-host-operations/offhost.mjs", command.slice(8), ...common, "--offhost-env-file", path.join(path.dirname(data), "offhost.env")];
  throw new Error("MAINTENANCE_COMMAND_INVALID");
}
export function renderDatabaseMetrics(value, now = Date.now()) {
  const fields = ["database_bytes", "oldest_transaction_seconds", "dead_tuples", "live_tuples", "deadlocks", "autovacuum_enabled"];
  if (!value || fields.some((key) => !Number.isFinite(value[key]) || value[key] < 0) || ![0, 1].includes(value.autovacuum_enabled)) throw new Error("MAINTENANCE_METRIC_INVALID");
  return [`ssartnership_database_collected_seconds ${Math.floor(now / 1000)}`, ...fields.map((key) => `ssartnership_database_${key} ${value[key]}`), ""].join("\n");
}
async function databaseCheck(release, directory, dataFile, operationsFile) {
  const lib = await import(pathToFileURL(path.join(release, "scripts/self-host-operations/lib.mjs")));
  const context = await lib.loadOperationsContext({ dataEnvFile: dataFile, operationsEnvFile: operationsFile });
  const sql = "BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; SELECT json_build_object('database_bytes',pg_database_size(current_database()),'oldest_transaction_seconds',COALESCE((SELECT MAX(EXTRACT(EPOCH FROM now()-xact_start)) FROM pg_stat_activity WHERE xact_start IS NOT NULL AND pid<>pg_backend_pid()),0),'dead_tuples',COALESCE((SELECT SUM(n_dead_tup) FROM pg_stat_user_tables),0),'live_tuples',COALESCE((SELECT SUM(n_live_tup) FROM pg_stat_user_tables),0),'deadlocks',(SELECT deadlocks FROM pg_stat_database WHERE datname=current_database()),'autovacuum_enabled',CASE WHEN current_setting('autovacuum')='on' THEN 1 ELSE 0 END); COMMIT;";
  const result = await runOperatorCommand("docker", [...lib.composeArguments(context), "exec", "-T", "--user", "postgres", "db", "psql", "-v", "ON_ERROR_STOP=1", "-qAt", "-U", "supabase_admin", "-d", "postgres"], { cwd: release, input: sql, timeout: 15_000 });
  const metric = renderDatabaseMetrics(JSON.parse(result.stdout.trim()));
  const target = path.join(directory, "textfile");
  const temporary = path.join(target, `database-${randomUUID()}.tmp`);
  await writeFile(temporary, metric, { mode: 0o644, flag: "wx" });
  await rename(temporary, path.join(target, "database.prom"));
  return { checked: true, readOnly: true };
}
export async function maintain(command) {
  if (process.getuid?.() !== 0 || process.env.DOCKER_HOST || !COMMANDS.includes(command)) throw new Error("MAINTENANCE_OPERATOR_REQUIRED");
  const stateFile = path.join(secrets, "deployment.json");
  await assertOperatorInput(stateFile);
  const state = JSON.parse(await readFile(stateFile, "utf8"));
  if (!/^[a-f0-9]{40}$/u.test(state.sha) || state.environment !== "synthetic-preview" || state.release !== `/srv/services/ssartnership/releases/${state.sha}`) throw new Error("MAINTENANCE_STATE_INVALID");
  await assertOperatorInput(state.release, { directory: true });
  const data = path.join(secrets, "data.env");
  const operations = path.join(secrets, "operations.env");
  const monitoring = path.join(secrets, "monitoring");
  if (command === "db-check") return databaseCheck(state.release, monitoring, data, operations);
  const response = await runOperatorCommand(process.execPath, maintenancePlan(command, data, operations, monitoring), { cwd: state.release, timeout: 25 * 60_000 });
  const result = JSON.parse(response.stdout.trim());
  return { command, completed: true, healthy: result.healthy ?? null };
}
if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
  try { console.log(JSON.stringify(await maintain(process.argv[2]))); }
  catch { console.error('{"error":"MAINTENANCE_FAILED"}'); process.exitCode = 1; }
}
