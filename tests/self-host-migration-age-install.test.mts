import assert from "node:assert/strict";
import test from "node:test";
import { ageInstallPlan, verifyAgeArchive } from "../scripts/self-host-migration/install-age.mjs";
test("migration age installer pins supported Linux release assets and SHA256", () => {
  const plan = ageInstallPlan("linux", "x64");
  assert.equal(plan.url, "https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-amd64.tar.gz");
  assert.equal(plan.hash, "cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10");
  assert.match(ageInstallPlan("linux", "arm64").url, /linux-arm64/);
  for (const [platform, architecture] of [["darwin", "arm64"], ["win32", "x64"], ["linux", "arm"]]) assert.throws(() => ageInstallPlan(platform, architecture));
  assert.throws(() => verifyAgeArchive(Buffer.from("modified release archive"), plan));
});
