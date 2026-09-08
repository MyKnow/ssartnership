import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, statSync } from "node:fs";
import { maintenancePlan, renderDatabaseMetrics } from "../scripts/self-host-operations/maintenance.mjs";
import { previewComposeArguments } from "../scripts/self-host-ci/bootstrap-preview.mjs";
import { TIMERS, timerUnit } from "../deploy/self-host-ci/install-maintenance.mjs";

test("maintenance supports fixed operations without accepting shell commands or deleting source data", () => {
  assert.deepEqual(maintenancePlan("backup-incr", "/private/data.env", "/private/operations.env", "/private/monitoring"), ["scripts/self-host-operations/cli.mjs", "backup", "--type", "incr", "--env-file", "/private/data.env", "--operations-env-file", "/private/operations.env"]);
  assert.equal(maintenancePlan("restore", "/d", "/o", "/m")[1], "restore-drill");
  assert.throws(() => maintenancePlan("prune", "/d", "/o", "/m"));
  const wrapper = readFileSync(new URL("../deploy/self-host-ci/maintenance-run.sh", import.meta.url), "utf8");
  assert.match(wrapper, /flock --nonblock --conflict-exit-code 75/u);
  assert.doesNotMatch(wrapper, /eval|docker\.sock|down -v|prune/u);
  assert.notEqual(statSync(new URL("../deploy/self-host-ci/maintenance-run.sh", import.meta.url)).mode & 0o111, 0, "systemd maintenance wrapper must be executable");
});
test("database maintenance metrics contain only finite global aggregates", () => {
  const values = { database_bytes: 1200, oldest_transaction_seconds: 10, dead_tuples: 2, live_tuples: 20, deadlocks: 0, autovacuum_enabled: 1, table: "private-table", member: "private-member" };
  const output = renderDatabaseMetrics(values, 1000);
  assert.match(output, /ssartnership_database_collected_seconds 1/u);
  assert.doesNotMatch(output, /private-table|private-member/u);
  assert.throws(() => renderDatabaseMetrics({ ...values, database_bytes: Infinity }));
  assert.throws(() => renderDatabaseMetrics({ ...values, autovacuum_enabled: 2 }));
});
test("server Preview uses combined data, operations, monitoring and Linux resource overlays", () => {
  const args = previewComposeArguments("/release", "/private");
  assert.ok(args.includes("ssartnership-home-preview"));
  for (const name of ["compose.yaml", "compose.supabase.yaml", "compose.operations.yaml", "compose.monitoring.yaml", "compose.monitoring.host.yaml"]) assert.ok(args.includes(`/release/${name}`));
  assert.ok(args.some((item) => item.endsWith("compose.server.yaml")));
  assert.doesNotMatch(args.join(" "), /production|main|--build|prune/u);
});
test("maintenance schedules retain explicit timezone and do not enable unconfigured offhost or product Cron", () => {
  assert.equal(Object.keys(TIMERS).length, 6);
  assert.match(timerUnit("backup-full", TIMERS["backup-full"]), /Asia\/Seoul/u);
  assert.match(timerUnit("collect", TIMERS.collect), /OnUnitActiveSec=1min/u);
  assert.throws(() => timerUnit("offhost-capture", "OnBootSec=1s"));
});
