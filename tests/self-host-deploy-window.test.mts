import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { load } = require("js-yaml") as { load: (source: string) => unknown };
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
/** Drop whole-line comments so explanations never satisfy a directive check. */
const directives = (source: string) => source.replace(/^\s*#.*\n/gmu, "");

function appProxyBlock() {
  const relay = directives(read("deploy/pve/relay.Caddyfile"));
  const opener = "http://:{$APP_PORT} {";
  const start = relay.indexOf(opener);
  assert.notEqual(start, -1, "relay app site");
  let depth = 0;
  for (let index = start + opener.length - 1; index < relay.length; index += 1) {
    if (relay[index] === "{") depth += 1;
    if (relay[index] === "}") {
      depth -= 1;
      if (depth === 0) return relay.slice(start, index + 1);
    }
  }
  throw new Error("relay app site is unbalanced");
}

function seconds(value: string) {
  const match = /^(\d+)s$/u.exec(value);
  assert.ok(match, `duration ${value}`);
  return Number(match[1]);
}

test("the relay holds requests through an app recreate that drains within the window", () => {
  const app = appProxyBlock();
  const tryDuration = seconds(app.match(/lb_try_duration (\S+)/u)?.[1] ?? "");
  assert.equal(tryDuration, 20);
  assert.match(app, /lb_try_interval 250ms/u);
  // Expected container start (validate-runtime + Next ready) on the PVE VMs.
  const startupBudgetSeconds = 5;
  for (const path of ["deploy/self-host/compose.production.yaml", "deploy/self-host/compose.original-preview.yaml"]) {
    const compose = load(read(path)) as { services: { app: { stop_grace_period: string } } };
    const grace = seconds(compose.services.app.stop_grace_period);
    assert.ok(grace >= 10 && grace + startupBudgetSeconds <= tryDuration, `${path} grace ${grace}s`);
  }
});

test("the relay firewall waits for routed networking and retries a bounded number of times", () => {
  const unit = read("deploy/pve/relay-firewall.service");
  const [unitSection, serviceSection] = unit.split("[Service]");
  assert.match(unitSection, /^Before=docker\.service$/mu);
  assert.match(unitSection, /^After=network-online\.target$/mu);
  assert.match(unitSection, /^Wants=network-online\.target$/mu);
  assert.doesNotMatch(unit, /network-pre\.target/u);
  assert.match(unitSection, /^StartLimitIntervalSec=120$/mu);
  assert.match(unitSection, /^StartLimitBurst=10$/mu);
  assert.match(serviceSection, /^Type=oneshot$/mu);
  assert.match(serviceSection, /^RemainAfterExit=yes$/mu);
  assert.match(serviceSection, /^Restart=on-failure$/mu);
  assert.match(serviceSection, /^RestartSec=5$/mu);
  // Docker still refuses to start without the rules (fail closed).
  assert.match(read("deploy/pve/docker-relay.conf"), /^Requires=ssartnership-relay-firewall\.service$/mu);
});
