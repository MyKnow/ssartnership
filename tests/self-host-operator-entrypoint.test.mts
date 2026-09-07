import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
// Never let this regression reach real operator state, even in a root CI container.
const unprivileged = "data:text/javascript,process.getuid%3D()%3D%3E501";
for (const [script, error] of [["maintenance.mjs", "MAINTENANCE_FAILED"], ["export-recovery.mjs", "RECOVERY_EXPORT_FAILED"]]) {
  test(`operator ${script} executes through the current directory link and fails closed`, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "ssartnership-entrypoint-"));
    try {
      const linked = path.join(directory, "current");
      await symlink(root, linked, process.platform === "win32" ? "junction" : "dir");
      for (const base of [root, linked]) {
        const result = spawnSync(process.execPath, ["--import", unprivileged, path.join(base, "scripts/self-host-operations", script), "entrypoint-probe"], {
          input: "", encoding: "utf8", timeout: 10_000,
        });
        assert.equal(result.error, undefined);
        assert.equal(result.status, 1, `${script} must not silently return success`);
        assert.equal(result.stdout, "");
        assert.deepEqual(JSON.parse(result.stderr), { error });
      }
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
}
