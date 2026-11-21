import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDashboard, renderDashboard } from "../deploy/pve/grafana/build-dashboard.mjs";

const committed = readFileSync(new URL("../deploy/pve/grafana/dashboards/ssartnership.json", import.meta.url), "utf8");

test("the committed Grafana dashboard is exactly the generator output", () => {
  assert.equal(renderDashboard(), committed, "run `node deploy/pve/grafana/build-dashboard.mjs` and commit the JSON");
  assert.deepEqual(buildDashboard(), JSON.parse(committed));
});

test("dashboard generation is deterministic and ids are unique", () => {
  assert.deepEqual(buildDashboard(), buildDashboard());
  const ids = buildDashboard().panels.map((panel: { id: number }) => panel.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("dashboard shows the readiness, edge error, cron and receiver signals", () => {
  const expressions = buildDashboard().panels.flatMap((panel: { targets?: Array<{ expr: string }> }) => panel.targets?.map((target) => target.expr) ?? []).join("\n");
  for (const metric of ["ssartnership_app_ready_success", "caddy_http_request_duration_seconds_count", "ssartnership_production_cron_last_success_seconds", "ssartnership_release_receiver_last_success_seconds", "pg_settings_max_connections", "ssartnership_external_monitor_configured"]) {
    assert.ok(expressions.includes(metric), metric);
  }
});
