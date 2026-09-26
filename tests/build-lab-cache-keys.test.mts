import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync, chmodSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { labBuildKey } from "../scripts/build-lab/cache-keys.mjs";

test("lab cache keys are opt-in, isolated by artifact, private and reusable", () => {
  const root = mkdtempSync(join(tmpdir(), "build-lab-key-"));
  try {
    assert.deepEqual(labBuildKey(root, "real", {}), {});
    const env = { SSARTNERSHIP_BUILD_LAB_CACHE: "1" };
    const real = labBuildKey(root, "real", env);
    const fixture = labBuildKey(root, "fixture", env);
    assert.equal(Buffer.from(real.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY!, "base64").length, 32);
    assert.notDeepEqual(real, fixture);
    assert.deepEqual(labBuildKey(root, "real", env), real);
    const path = join(root, ".tmp/build-lab-keys/real.key");
    assert.equal(statSync(path).mode & 0o777, 0o600);
    chmodSync(path, 0o644);
    assert.throws(() => labBuildKey(root, "real", env), /BUILD_LAB_KEY_INVALID/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("lab key directory cannot redirect writes outside the workspace", () => {
  const root = mkdtempSync(join(tmpdir(), "build-lab-key-"));
  const outside = mkdtempSync(join(tmpdir(), "build-lab-outside-"));
  try {
    symlinkSync(outside, join(root, ".tmp"));
    assert.throws(() => labBuildKey(root, "real", { SSARTNERSHIP_BUILD_LAB_CACHE: "1" }), /BUILD_LAB_KEY_INVALID/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
