import assert from "node:assert/strict";
import { lstat, mkdtemp, readdir, readFile, rm, symlink } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  previousReceiverSuccess,
  recordReceiverOutcome,
  renderReceiverMetrics,
} from "../scripts/self-host-ci/receiver-metrics.mjs";
import { RECEIVER_PROFILES } from "../scripts/self-host-ci/receive-release.mjs";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("receiver units treat a heavy-lock conflict (exit 75) as a skipped poll", () => {
  for (const name of ["production", "preview"]) {
    const unit = read(`deploy/self-host-ci/ssartnership-${name}-receiver.service`);
    assert.match(unit, /--conflict-exit-code 75 /u);
    assert.match(unit, /^SuccessExitStatus=75$/mu);
  }
});

test("receiver metrics keep the last success across failures", () => {
  const success = renderReceiverMetrics({ success: true, now: 1_791_000_000_900 });
  assert.match(success, /^ssartnership_release_receiver_last_success_seconds 1791000000$/mu);
  assert.match(success, /^ssartnership_release_receiver_last_result 1$/mu);
  assert.equal(previousReceiverSuccess(success), 1_791_000_000);
  const failure = renderReceiverMetrics({ success: false, now: 1_791_000_600_000, previousSuccess: 1_791_000_000 });
  assert.match(failure, /^ssartnership_release_receiver_last_success_seconds 1791000000$/mu);
  assert.match(failure, /^ssartnership_release_receiver_last_result 0$/mu);
});

test("receiver metrics are atomic, world-readable and skip a missing or linked directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "receiver-metrics-"));
  const previousUmask = process.umask(0o077);
  try {
    assert.deepEqual(await recordReceiverOutcome({ directory: join(root, "missing"), success: true }), { recorded: false });
    assert.deepEqual(await recordReceiverOutcome({ directory: "relative/path", success: true }), { recorded: false });
    await symlink(root, join(root, "linked"));
    assert.deepEqual(await recordReceiverOutcome({ directory: join(root, "linked"), success: true }), { recorded: false });
    await recordReceiverOutcome({ directory: root, success: true, now: 1_791_000_000_000 });
    await recordReceiverOutcome({ directory: root, success: false, now: 1_791_000_300_000 });
    assert.deepEqual((await readdir(root)).sort(), ["linked", "release-receiver.prom"]);
    const content = await readFile(join(root, "release-receiver.prom"), "utf8");
    assert.match(content, /last_success_seconds 1791000000/u);
    assert.match(content, /last_result 0/u);
    assert.equal((await lstat(join(root, "release-receiver.prom"))).mode & 0o777, 0o644);
  } finally {
    process.umask(previousUmask);
    await rm(root, { recursive: true, force: true });
  }
});

test("each receiver profile writes into its own environment's textfile directory", () => {
  assert.equal(RECEIVER_PROFILES.production.config.metricsDirectory, "/etc/myknow/secrets/ssartnership-production/monitoring/textfile");
  assert.equal(RECEIVER_PROFILES.preview.config.metricsDirectory, "/etc/myknow/secrets/ssartnership-original-preview/monitoring/textfile");
  const source = read("scripts/self-host-ci/receive-release.mjs");
  assert.match(source, /recordReceiverOutcome\(\{ directory: profile\.config\.metricsDirectory, success \}\)/u);
  assert.match(source, /\.catch\(\(\) => process\.stderr\.write\('\{"metrics":"RECEIVER_METRICS_FAILED"\}\\n'\)\)/u);
});
