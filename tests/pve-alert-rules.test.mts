import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { CATALOG } from "../deploy/observability/notifier.mjs";

const { load } = createRequire(import.meta.url)("js-yaml") as { load: (source: string) => unknown };

type Rule = { alert: string; expr: string; for?: string; labels?: Record<string, string> };
type RuleFile = { groups: Array<{ rules: Rule[] }> };
type ScrapeConfig = { job_name: string; static_configs: Array<{ targets: string[]; labels?: Record<string, string> }> };

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const rulesOf = (file: string) => (load(read(file)) as RuleFile).groups.flatMap((group) => group.rules);

// Every rule file the operations Prometheus loads routes through the notifier.
const OPERATIONS_RULE_FILES = [
  "deploy/pve/service-alerts.yml",
  "deploy/observability/production-backup-alerts.yml",
];

test("every operations alert has a fixed notifier catalog entry", () => {
  for (const file of OPERATIONS_RULE_FILES) {
    for (const rule of rulesOf(file)) {
      assert.ok(Object.hasOwn(CATALOG, rule.alert), `${file}: ${rule.alert} needs a notifier CATALOG entry`);
      assert.ok(["warning", "critical"].includes(rule.labels?.severity ?? ""), `${rule.alert} severity`);
    }
  }
});

test("aggregated alerts carry explicit environment and vm labels for notifier routing", () => {
  for (const rule of rulesOf("deploy/pve/service-alerts.yml")) {
    const aggregatesAway = /\b(?:sum|max|min|count|avg)\s*\(/u.test(rule.expr) && !/\bby\s*\(\s*environment\s*,\s*vm\s*\)/u.test(rule.expr);
    if (aggregatesAway) {
      assert.ok(rule.labels?.environment && rule.labels?.vm, `${rule.alert} drops target labels and must set environment/vm`);
    }
  }
});

test("operations scrape targets keep the environment/vm label contract", () => {
  const config = load(read("deploy/pve/prometheus.yml")) as { scrape_configs: ScrapeConfig[] };
  for (const job of config.scrape_configs) {
    for (const target of job.static_configs) {
      assert.ok(["production", "preview", "operations"].includes(target.labels?.environment ?? ""), `${job.job_name} environment`);
      assert.ok(["5200", "5201", "5202", "host"].includes(target.labels?.vm ?? ""), `${job.job_name} vm`);
    }
  }
  const caddy = config.scrape_configs.find((job) => job.job_name === "caddy");
  assert.deepEqual(caddy?.static_configs[0].targets, ["caddy:9180"]);
});

test("server error burst alert counts only upstream responses above a request floor", () => {
  const rule = rulesOf("deploy/pve/service-alerts.yml").find((item) => item.alert === "ServerErrorBurst");
  assert.ok(rule);
  assert.match(rule.expr, /handler="reverse_proxy",code=~"5\.\."/u);
  assert.match(rule.expr, /\) > 0\.05\s*$/u);
  assert.equal(rule.for, "5m");
  assert.deepEqual(rule.labels, { severity: "warning", environment: "operations", vm: "5202" });
});
