import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const { load } = createRequire(import.meta.url)("js-yaml") as { load: (source: string) => unknown };

const operations = load(readFileSync(new URL("../deploy/pve/compose.operations.yaml", import.meta.url), "utf8")) as {
  services: Record<string, { mem_limit: string }>;
};

function memoryMiB(service: string): number {
  const limit = operations.services[service]?.mem_limit;
  assert.match(limit ?? "", /^\d+m$/u, `${service} must have an explicit MiB ceiling`);
  const value = Number(limit.slice(0, -1));
  assert.ok(value > 0, `${service} must have a positive ceiling`);
  return value;
}

test("Grafana leaves memory headroom above the observed full-dashboard workload", () => {
  // The real 51-panel QA peaked at 629 MiB. Round the workload up and leave
  // room for query/plugin growth; the vendor's 512 MB floor is insufficient.
  const observedWorkloadMiB = 640;
  const queryHeadroomMiB = 64;
  assert.ok(memoryMiB("grafana") >= observedWorkloadMiB + queryHeadroomMiB);
});

test("all monitoring service ceilings leave at least 384 MiB for the existing 2 GiB VM", () => {
  const total = Object.keys(operations.services).reduce((sum, name) => sum + memoryMiB(name), 0);
  assert.ok(total <= 2048 - 384, `monitoring ceilings total ${total} MiB and exceed the VM reserve`);
});
