import assert from "node:assert/strict";
import { lstat, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import {
  previousProductionCronSuccess,
  productionCronIntervalSeconds,
  recordProductionCronOutcome,
  renderProductionCronMetrics,
} from "../scripts/self-host-operations/production-cron-metrics.mjs";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("every scheduled Production job has a supported expected interval", () => {
  const { crons } = JSON.parse(read("deploy/self-host-operations/production-cron/schedules.json")) as { crons: Array<{ schedule: string }> };
  for (const { schedule } of crons) assert.ok(productionCronIntervalSeconds(schedule) >= 300, schedule);
  assert.equal(productionCronIntervalSeconds("2-59/15 * * * *"), 900);
  assert.equal(productionCronIntervalSeconds("1-59/5 * * * *"), 300);
  assert.equal(productionCronIntervalSeconds("10 * * * *"), 3600);
  assert.equal(productionCronIntervalSeconds("40 18 * * *"), 86400);
  for (const invalid of ["*/5 * * * *", "0 0 * * 1", "1-59/0 * * * *"]) assert.throws(() => productionCronIntervalSeconds(invalid));
});

test("metrics keep the last success across failures and use a non-reserved label", () => {
  const success = renderProductionCronMetrics({ job: "rss", schedule: "2-59/15 * * * *", success: true, now: 1_791_000_000_500 });
  assert.match(success, /ssartnership_production_cron_last_success_seconds\{cron="rss"\} 1791000000/u);
  assert.match(success, /ssartnership_production_cron_last_result\{cron="rss"\} 1/u);
  assert.match(success, /ssartnership_production_cron_interval_seconds\{cron="rss"\} 900/u);
  assert.doesNotMatch(success, /\bjob=/u);
  assert.equal(previousProductionCronSuccess(success, "rss"), 1_791_000_000);
  assert.equal(previousProductionCronSuccess(success, "partner-billing"), 0);
  const failure = renderProductionCronMetrics({ job: "rss", schedule: "2-59/15 * * * *", success: false, now: 1_791_000_900_000, previousSuccess: 1_791_000_000 });
  assert.match(failure, /last_success_seconds\{cron="rss"\} 1791000000/u);
  assert.match(failure, /last_result\{cron="rss"\} 0/u);
  assert.match(failure, /last_run_seconds\{cron="rss"\} 1791000900/u);
  assert.throws(() => renderProductionCronMetrics({ job: 'rss"} 1\nforged{x="', schedule: "10 * * * *", success: true, now: 0 }));
});

test("textfile writes are atomic, world-readable and preserve the last success", async () => {
  const directory = await mkdtemp(join(tmpdir(), "production-cron-metrics-"));
  const previousUmask = process.umask(0o077);
  try {
    await recordProductionCronOutcome({ job: "rss", schedule: "2-59/15 * * * *", success: true, now: 1_791_000_000_000, directory });
    await recordProductionCronOutcome({ job: "rss", schedule: "2-59/15 * * * *", success: false, now: 1_791_000_900_000, directory });
    assert.deepEqual(await readdir(directory), ["production-cron-rss.prom"]);
    const content = await readFile(join(directory, "production-cron-rss.prom"), "utf8");
    assert.match(content, /last_success_seconds\{cron="rss"\} 1791000000/u);
    assert.match(content, /last_result\{cron="rss"\} 0/u);
    assert.equal((await lstat(join(directory, "production-cron-rss.prom"))).mode & 0o777, 0o644);
    await assert.rejects(recordProductionCronOutcome({ job: "../escape", schedule: "10 * * * *", success: true, directory }));
  } finally {
    process.umask(previousUmask);
    await rm(directory, { recursive: true, force: true });
  }
});

test("cron unit may write only its lock and the monitoring textfile directory", () => {
  const unit = read("deploy/self-host-operations/production-cron/ssartnership-production-cron@.service");
  assert.match(unit, /^ReadWritePaths=\/run\/lock \/etc\/myknow\/secrets\/ssartnership-production\/monitoring\/textfile$/mu);
  assert.match(unit, /ProtectSystem=strict/u);
  const runner = read("scripts/self-host-operations/production-cron.mjs");
  assert.match(runner, /recordProductionCronOutcome\(\{ job: process\.argv\[2\], schedule: entry\.schedule, success \}\)\.catch\(/u);
});

test("cron failure notice accepts every delivery mode the operations notifier supports", () => {
  const source = read("scripts/self-host-operations/notify-cron-failure.mjs");
  assert.match(source, /if \(!config\) throw Error\('ALERT_CONFIG_INVALID'\)/u);
  assert.doesNotMatch(source, /kind !== 'email'/u);
});

test("ProductionCronStale compares each job with three expected intervals", () => {
  const { load } = createRequire(import.meta.url)("js-yaml") as { load: (source: string) => { groups: Array<{ rules: Array<{ alert: string; expr: string }> }> } };
  const rule = load(read("deploy/pve/service-alerts.yml")).groups.flatMap((group) => group.rules).find((item) => item.alert === "ProductionCronStale");
  assert.equal(rule?.expr, "time() - ssartnership_production_cron_last_success_seconds > 3 * ssartnership_production_cron_interval_seconds");
});

test("alert relay mounts only the token that the single notifier verifies", () => {
  const compose = read("deploy/pve/compose.operations.yaml");
  const alertmanager = read("deploy/pve/alertmanager.yml");
  assert.doesNotMatch(compose, /preview-alert-relay-token/u);
  for (const file of alertmanager.match(/credentials_file: (\S+)/gu) ?? []) {
    assert.ok(compose.includes(`:${file.replace("credentials_file: ", "")}:ro`), file);
  }
});
