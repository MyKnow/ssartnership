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
for (const [script, error] of [
  ["maintenance.mjs", "MAINTENANCE_FAILED"],
  ["export-recovery.mjs", "RECOVERY_EXPORT_FAILED"],
  ["restore-production-backup.mjs", "ORIGINAL_RESTORE_FAILED"],
  ["rehearse-pulled-recovery.mjs", "RECOVERY_REHEARSAL_FAILED"],
  ["pull-recovery.mjs", "RECOVERY_PULL_FAILED"],
]) {
  test(`operator ${script} executes through the current directory link and fails closed`, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "ssartnership-entrypoint-"));
    try {
      const linked = path.join(directory, "current");
      await symlink(root, linked, process.platform === "win32" ? "junction" : "dir");
      for (const base of [root, linked]) {
        const result = spawnSync(process.execPath, ["--import", unprivileged, path.join(base, "scripts/self-host-operations", script), "entrypoint-probe"], {
          input: "", encoding: "utf8", timeout: 10_000, cwd: directory,
        });
        assert.equal(result.error, undefined);
        assert.equal(result.status, 1, `${script} must not silently return success`);
        assert.equal(result.stdout, "");
        const failure = JSON.parse(result.stderr);
        if (script === "restore-production-backup.mjs") {
          assert.equal(failure.error, error);
          assert.equal(failure.stage, "preflight");
          assert.match(failure.container, /^ssartnership-production-recovery-[a-f0-9-]{36}$/u);
          assert.deepEqual(Object.keys(failure).sort(), ["container", "error", "stage"]);
        } else {
          assert.deepEqual(failure, { error });
        }
      }
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
}

test("Mac recovery modules imported from stdin do not execute their CLIs", () => {
  for (const script of ["pull-recovery.mjs", "rehearse-pulled-recovery.mjs"]) {
    const url = new URL(`../scripts/self-host-operations/${script}`, import.meta.url).href;
    const result = spawnSync(process.execPath, ["--input-type=module", "-"], {
      input: `await import(${JSON.stringify(url)});`, encoding: "utf8", timeout: 10_000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  }
});
