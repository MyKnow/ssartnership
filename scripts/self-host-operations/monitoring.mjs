#!/usr/bin/env node
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile, readFile, rename, lstat } from "node:fs/promises";
import path from "node:path";
import { composeArguments, defaultManifestPath, loadOperationsContext, readManifest, serializeEnvironment } from "./lib.mjs";
import { createProcessRunner, performStatus } from "./cli.mjs";

const OPERATIONS = ["backup", "check", "restore-drill", "offhost-capture", "offhost-check", "offhost-rehearse"];

export function renderOperationsMetrics(records, status, now = Date.now()) {
  const lines = [
    "# TYPE ssartnership_operations_collected_seconds gauge",
    `ssartnership_operations_collected_seconds ${Math.floor(now / 1000)}`,
    "# TYPE ssartnership_operations_archive_healthy gauge",
    `ssartnership_operations_archive_healthy ${status.archive?.healthy === true ? 1 : 0}`,
    "# TYPE ssartnership_operations_last_success_seconds gauge",
    "# TYPE ssartnership_operations_last_result gauge",
  ];
  for (const operation of OPERATIONS) {
    const matching = records.filter((record) => record.kind === operation);
    const lastSuccess = matching.findLast((record) => record.result === "success");
    const timestamp = Date.parse(lastSuccess?.finishedAt ?? "");
    lines.push(`ssartnership_operations_last_success_seconds{operation="${operation}"} ${Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0}`);
    lines.push(`ssartnership_operations_last_result{operation="${operation}"} ${matching.at(-1)?.result === "success" ? 1 : 0}`);
  }
  return `${lines.join("\n")}\n`;
}

export async function initializeMonitoring(directory) {
  const target = path.resolve(directory);
  await mkdir(target, { mode: 0o700 });
  const textfiles = path.join(target, "textfile");
  const secrets = path.join(target, "secrets");
  await mkdir(textfiles, { mode: 0o755 });
  await mkdir(secrets, { mode: 0o700 });
  const relay = randomBytes(32).toString("hex");
  // Parent 0700 protects host access; individual bind mounts are readable by
  // different non-root container UIDs, with no directory traversal exposure.
  for (const [name, value] of [["alert-relay-token", relay], ["grafana-password", randomBytes(32).toString("hex")], ["postgres-monitor-password", randomBytes(32).toString("hex")]]) {
    await writeFile(path.join(secrets, name), `${value}\n`, { mode: 0o444, flag: "wx" });
  }
  await writeFile(path.join(target, "monitoring.env"), serializeEnvironment({
    MONITORING_SECRETS_DIR: secrets, MONITORING_TEXTFILE_DIR: textfiles,
    SELF_HOST_VITALS_TOKEN: randomBytes(32).toString("hex"), OPS_ALERT_RELAY_TOKEN: relay,
  }), { mode: 0o600, flag: "wx" });
  return { initialized: true };
}

export async function installMonitorRole(context, directory) {
  const credential = (await readFile(path.join(directory, "secrets", "postgres-monitor-password"), "utf8")).trim();
  if (!/^[a-f0-9]{64}$/u.test(credential)) throw new Error("MONITOR_CREDENTIAL_INVALID");
  const sql = `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ssartnership_monitor') THEN CREATE ROLE ssartnership_monitor; END IF; END $$;
ALTER ROLE ssartnership_monitor LOGIN PASSWORD '${credential}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 3;
GRANT CONNECT ON DATABASE postgres TO ssartnership_monitor;
GRANT pg_monitor TO ssartnership_monitor;`;
  const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:COMPOSE_|SELF_HOST_|SUPABASE_|POSTGRES_|PGBACKREST_|RESTIC_)/u.test(key)));
  execFileSync("docker", [...composeArguments(context), "exec", "-T", "--user", "postgres", "db", "psql", "-v", "ON_ERROR_STOP=1", "-U", "supabase_admin", "-d", "postgres"], {
    input: sql, stdio: ["pipe", "pipe", "pipe"], env: clean, timeout: 15_000, maxBuffer: 1024 * 1024,
  });
  return { roleInstalled: true };
}

export async function collectOperationsMetrics(context, directory, run = createProcessRunner()) {
  const target = path.resolve(directory, "textfile");
  const metadata = await lstat(target);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error("METRIC_DIRECTORY_INVALID");
  const status = await performStatus(context, run);
  const records = await readManifest(defaultManifestPath(context.operationsEnvFile));
  const temporary = path.join(target, `operations-${randomUUID()}.tmp`);
  await writeFile(temporary, renderOperationsMetrics(records, status), { mode: 0o644, flag: "wx" });
  await rename(temporary, path.join(target, "operations.prom"));
  return { collected: true, healthy: status.healthy };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    const [command, directory, data, operations] = process.argv.slice(2);
    if (!directory || (command !== "init" && (!data || !operations)) || !["init", "install-role", "collect"].includes(command)) throw new Error("USAGE");
    const result = command === "init" ? await initializeMonitoring(directory)
      : await (command === "install-role" ? installMonitorRole : collectOperationsMetrics)(await loadOperationsContext({ dataEnvFile: data, operationsEnvFile: operations }), directory);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch { process.stderr.write('{"error":"MONITORING_COMMAND_FAILED"}\n'); process.exitCode = 1; }
}
