import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  ALERTMANAGER_CONFIGS,
  alertCheckCommands,
  changesAlertRules,
  pinnedImages,
  RULE_TESTS,
} from "../scripts/check-alert-rules.mjs";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("alert checks use the operations VM's digest-pinned images without network", () => {
  const images = pinnedImages(read("deploy/pve/compose.operations.yaml"));
  assert.match(images.prometheus, /^prom\/prometheus:v[0-9.]+@sha256:[a-f0-9]{64}$/u);
  assert.match(images.alertmanager, /^prom\/alertmanager:v[0-9.]+@sha256:[a-f0-9]{64}$/u);
  assert.throws(() => pinnedImages("image: prom/prometheus:latest"), /UNPINNED/u);
  const commands = alertCheckCommands(images, "/repo");
  assert.equal(commands.length, RULE_TESTS.length + ALERTMANAGER_CONFIGS.length);
  for (const command of commands) {
    assert.ok(command.args.includes("--read-only"));
    assert.deepEqual(command.args.slice(command.args.indexOf("--network"), command.args.indexOf("--network") + 2), ["--network", "none"]);
    assert.ok(command.args.includes("/repo/deploy:/deploy:ro"));
  }
  assert.deepEqual(commands[0].args.slice(-4), [images.prometheus, "test", "rules", "service-alerts.test.yml"]);
});

test("every rule file with a unit test is covered and exists", () => {
  for (const file of [...RULE_TESTS, ...ALERTMANAGER_CONFIGS]) assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), file);
});

test("verify-change runs the alert check only for rule, Alertmanager or scrape config changes", () => {
  assert.equal(changesAlertRules(["deploy/pve/service-alerts.yml"]), true);
  assert.equal(changesAlertRules(["deploy/observability/production-backup-alerts.test.yml"]), true);
  assert.equal(changesAlertRules(["deploy/pve/alertmanager.yml"]), true);
  assert.equal(changesAlertRules(["deploy/pve/prometheus.yml"]), true);
  assert.equal(changesAlertRules(["deploy/pve/edge.Caddyfile", "src/app/page.tsx", "docs/alerts.md"]), false);
  const verify = read("scripts/verify-change.mjs");
  assert.match(verify, /if \(changesAlertRules\([\s\S]*?\)\) \{\s*runRequired\("check:alerts"\);/u);
  assert.match(read("package.json"), /"check:alerts": "node scripts\/check-alert-rules\.mjs"/u);
});
