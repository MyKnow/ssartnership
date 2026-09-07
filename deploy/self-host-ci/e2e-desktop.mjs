import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { requireExactInventory, requireStableDevLog, testInventory } from "./batch-plan.mjs";

const directory = "/work/.self-host-build/e2e/desktop";
mkdirSync(directory, { recursive: true, mode: 0o700 });
const args = ["/work/node_modules/@playwright/test/cli.js", "test", "--config=/opt/ssartnership/playwright.desktop.config.mjs"];
if (process.env.CI_NATIVE_BROWSER === "1") process.env.PW_TEST_CONNECT_WS_ENDPOINT = "ws://127.0.0.1:3201/";
const listed = spawnSync(process.execPath, [...args, "--list", "--reporter=json"], { encoding: "utf8", maxBuffer: 8 * 1024 ** 2, timeout: 60_000 });
if (listed.status !== 0 || listed.error) throw new Error("CI_E2E_LIST_FAILED");
const expected = testInventory(JSON.parse(listed.stdout));
const baseline = spawnSync(process.execPath, ["/work/node_modules/@playwright/test/cli.js", "test", "--config=/work/playwright.config.ts", "--list", "--reporter=json"], { encoding: "utf8", maxBuffer: 8 * 1024 ** 2, timeout: 60_000 });
if (baseline.status !== 0 || baseline.error) throw new Error("CI_E2E_BASELINE_LIST_FAILED");
requireExactInventory(testInventory(JSON.parse(baseline.stdout)), expected);
const logFile = `${directory}/execution.log`;
const log = openSync(logFile, "wx", 0o600);
let result;
try { result = spawnSync(process.execPath, args, { stdio: ["ignore", log, log], timeout: 20 * 60_000 }); }
finally { closeSync(log); }
if (statSync(logFile).size > 8 * 1024 ** 2) throw new Error("CI_E2E_LOG_LIMIT");
const output = readFileSync(logFile, "utf8");
process.stdout.write(output);
requireStableDevLog(output);
if (/Can't perform a React state update on a component that hasn't mounted yet|\[browser\].*Uncaught/u.test(output.replace(/\x1b\[[0-9;]*m/gu, ""))) throw new Error("CI_E2E_BROWSER_ERROR");
if (result.status !== 0 || result.error) throw new Error("CI_E2E_DESKTOP_FAILED");
const actual = testInventory(JSON.parse(readFileSync(`${directory}/results.json`, "utf8")), { passed: true });
requireExactInventory(expected, actual);
const totals = { tests: actual.length, failures: 0, errors: 0, skipped: 0, retries: 0, batches: 1 };
writeFileSync("/work/.self-host-build/e2e/complete.json", `${JSON.stringify(totals)}\n`, { flag: "wx", mode: 0o600 });
