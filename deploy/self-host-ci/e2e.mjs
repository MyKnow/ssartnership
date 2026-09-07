import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compilerPlan, E2E_BATCHES, requireExactInventory, requireStableDevLog, testInventory } from "./batch-plan.mjs";

const BATCHES = E2E_BATCHES;
const cli = "/work/node_modules/@playwright/test/cli.js";
const config = "--config=/opt/ssartnership/playwright.config.mjs";
function list(batch) {
  const result = spawnSync(process.execPath, [cli, "test", config, "--list", "--reporter=json", ...(batch ? [`--shard=${batch}/${BATCHES}`] : [])], {
    encoding: "utf8", maxBuffer: 8 * 1024 ** 2, timeout: 60_000,
    env: { ...process.env, SELF_HOST_CI_E2E_BATCH: String(batch ?? 0) },
  });
  if (result.status !== 0 || result.error) throw new Error("CI_E2E_LIST_FAILED");
  return testInventory(JSON.parse(result.stdout));
}
export function runBatch(batch, planned = list(batch)) {
  if (!Number.isInteger(batch) || batch < 1 || batch > BATCHES) throw new Error("CI_E2E_BATCH_INVALID");
  const directory = `/work/.self-host-build/e2e/batch-${batch}`;
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(`${directory}/plan.json`, `${JSON.stringify(compilerPlan(planned))}\n`, { flag: "wx", mode: 0o600 });
  const started = Date.now();
  console.log(JSON.stringify({ phase: "e2e-batch", batch, totalBatches: BATCHES, plannedTests: planned.length }));
  const logFile = `${directory}/execution.log`;
  const output = openSync(logFile, "wx", 0o600);
  let result;
  try {
    result = spawnSync(process.execPath, [cli, "test", config, `--shard=${batch}/${BATCHES}`], {
      stdio: ["ignore", output, output], timeout: 10 * 60_000,
      env: { ...process.env, SELF_HOST_CI_E2E_BATCH: String(batch) },
    });
  } finally { closeSync(output); }
  if (statSync(logFile).size > 8 * 1024 ** 2) throw new Error("CI_E2E_LOG_LIMIT");
  const log = readFileSync(logFile, "utf8");
  process.stdout.write(log);
  requireStableDevLog(log);
  if (result.status !== 0 || result.error) throw new Error("CI_E2E_BATCH_FAILED");
  const actual = testInventory(JSON.parse(readFileSync(`${directory}/results.json`, "utf8")), { passed: true });
  requireExactInventory(planned, actual);
  console.log(JSON.stringify({ phase: "e2e-batch-passed", batch, tests: actual.length, durationMs: Date.now() - started }));
  return actual;
}
export function runAllBatches() {
  const inventory = list();
  const plans = Array.from({ length: BATCHES }, (_, index) => list(index + 1));
  requireExactInventory(inventory, plans.flat());
  const completed = [];
  for (let index = 0; index < BATCHES; index++) completed.push(...runBatch(index + 1, plans[index]));
  requireExactInventory(inventory, completed);
  const totals = { tests: completed.length, failures: 0, errors: 0, skipped: 0, retries: 0, batches: BATCHES };
  writeFileSync("/work/.self-host-build/e2e/complete.json", `${JSON.stringify(totals)}\n`, { flag: "wx", mode: 0o600 });
  return totals;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(runAllBatches())); }
  catch (error) { console.error(JSON.stringify({ error: /^CI_[A-Z0-9_]+$/u.test(error.message) ? error.message : "CI_E2E_FAILED" })); process.exitCode = 1; }
}
