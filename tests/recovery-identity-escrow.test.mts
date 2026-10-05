import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, stat, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { exportRecoveryIdentity } from "../scripts/self-host-operations/export-recovery-identity.mjs";

test("escrow exports only to a private external file, preserves keys off output and refuses overwrite", async () => {
  const temp = await realpath(await mkdtemp(join(tmpdir(), "escrow-contract-")));
  try {
    const root = join(temp, "repo"); await mkdir(root, { mode: 0o700 });
    const source = join(temp, "identity"); const destination = join(temp, "escrow.json");
    const fixture = `AGE-SECRET-KEY-${"A".repeat(58)}`;
    await writeFile(source, fixture, { mode: 0o600 });
    assert.deepEqual(await exportRecoveryIdentity({ source, destination, root }), { exported: true, version: 1 });
    assert.equal(JSON.parse(await readFile(destination, "utf8")).identity, fixture);
    assert.equal((await stat(destination)).mode & 0o777, 0o600);
    await assert.rejects(exportRecoveryIdentity({ source, destination, root }));
    await assert.rejects(exportRecoveryIdentity({ source, destination: join(root, "bad.json"), root }), /ESCROW_PRIVATE_PATH_REQUIRED/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

import { buildRestoreTiming } from "../scripts/self-host-operations/restore-production-backup.mjs";
test("restore timing distinguishes key provenance and rejects impossible durations", () => {
  assert.deepEqual(buildRestoreTiming("2026-10-05T00:00:00Z", "2026-10-05T00:02:30Z", "offline-escrow"), { startedAt: "2026-10-05T00:00:00Z", finishedAt: "2026-10-05T00:02:30Z", durationSeconds: 150, identitySource: "offline-escrow" });
  assert.throws(() => buildRestoreTiming("invalid", "invalid"), /RESTORE_TIMING_INVALID/);
  assert.throws(() => buildRestoreTiming("2026-10-05T00:02:30Z", "2026-10-05T00:00:00Z"), /RESTORE_TIMING_INVALID/);
});
