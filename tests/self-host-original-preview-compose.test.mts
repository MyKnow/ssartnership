import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const compose = readFileSync(new URL("../deploy/self-host/compose.original-preview.yaml", import.meta.url), "utf8");
const receiver = readFileSync(new URL("../scripts/self-host-ci/receive-release.mjs", import.meta.url), "utf8");
const service = readFileSync(new URL("../deploy/self-host-ci/ssartnership-preview-receiver.service", import.meta.url), "utf8");
const timer = readFileSync(new URL("../deploy/self-host-ci/ssartnership-preview-receiver.timer", import.meta.url), "utf8");

test("original Preview overlay keeps restored data isolated and bounded", () => {
  assert.doesNotMatch(compose, /^\s+build:/mu);
  assert.match(compose, /original_default:\s*\n\s+external: true/u);
  assert.match(compose, /name: ssartnership-original-preview-34141078185_default/u);
  assert.match(compose, /127\.0\.0\.1:3108:3000/u);
  assert.match(compose, /env_file: \["\$\{MONITORING_ENV_FILE:\?monitoring env file required\}"\]/u);
  assert.match(compose, /--collector\.textfile\.directory=\/textfile/u);
  assert.match(compose, /\$\{MONITORING_TEXTFILE_DIR:\?monitoring textfile directory required\}:\/textfile:ro/u);
  assert.doesNotMatch(compose, /SELF_HOST_VITALS_TOKEN: \$\{/u);
  assert.doesNotMatch(compose, /OPS_ALERT_RELAY_TOKEN: \$\{/u);
  for (const serviceName of ["app", "telemetry", "prometheus", "alertmanager", "grafana", "postgres-exporter", "node-exporter"]) {
    const block = compose.match(new RegExp(`\\n  ${serviceName}:([\\s\\S]*?)(?=\\n  [a-z-]+:|\\nvolumes:)`, "u"))?.[1] ?? "";
    assert.match(block, /mem_limit:/u, `${serviceName} memory bound`);
    assert.match(block, /pids_limit:/u, `${serviceName} PID bound`);
    assert.match(block, /logging: \*bounded-logs/u, `${serviceName} log bound`);
  }
});

test("release receiver is installed as a root-only locked poller", () => {
  assert.match(service, /Type=oneshot/u);
  assert.match(service, /User=root/u);
  assert.match(service, /UMask=0077/u);
  assert.match(service, /flock --nonblock --conflict-exit-code 75/u);
  assert.match(service, /receive-release\.mjs/u);
  assert.match(timer, /OnUnitActiveSec=5min/u);
  assert.match(timer, /Persistent=true/u);
  assert.match(receiver, /SELF_HOST_\(\?:IMAGE\|TELEMETRY_IMAGE\)/u);
  assert.match(receiver, /--platform", "linux\/amd64/u);
});
