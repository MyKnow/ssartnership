import { access, readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { spawn } from "node:child_process";

// Native ARM64 browser only; the test runner and application stay AMD64.
// Shared network namespace is private to the exact gate container. There is
// no published host port, Docker socket, secret, or runtime package install.
const deadline = Date.now() + 15 * 60_000;
while (true) {
  try { await access("/work/.self-host-build/dependencies-ready"); break; }
  catch { if (Date.now() >= deadline) throw new Error("CI_BROWSER_DEPENDENCIES_TIMEOUT"); await delay(500); }
}
if (process.arch !== "arm64" || JSON.parse(await readFile("/work/node_modules/playwright/package.json", "utf8")).version !== "1.59.1") throw new Error("CI_BROWSER_IDENTITY_INVALID");
const child = spawn(process.execPath, ["/work/node_modules/playwright/cli.js", "run-server", "--host", "127.0.0.1", "--port", "3201"], { stdio: "inherit" });
child.once("error", () => process.exit(1));
child.once("close", (code) => process.exit(code ?? 1));
