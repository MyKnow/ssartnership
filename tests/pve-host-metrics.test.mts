import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("PVE CPU samples avoid guest double counting and memory uses available bytes", () => {
  execFileSync(process.platform === "win32" ? "python" : "python3", [
    fileURLToPath(new URL("./fixtures/pve-host-metrics.py", import.meta.url)),
    fileURLToPath(new URL("../scripts/self-host-operations/pve-host-metrics.py", import.meta.url)),
  ], { stdio: "pipe", timeout: 15_000 });
});
