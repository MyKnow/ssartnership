import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { REPOSITORY, validateRequest, validateGitTree, assertRootlessIdentity, imageTag, validateResult } from "../scripts/self-host-ci/lib.mjs";

const request = () => ({ version: 1, repository: REPOSITORY, ref: "refs/heads/dev", sha: randomBytes(20).toString("hex"), sourceHash: randomBytes(32).toString("hex"), platform: "linux/amd64", siteOrigin: "http://127.0.0.1:3100", supabaseOrigin: "http://127.0.0.1:54321", expiresAt: new Date(Date.now() + 3600_000).toISOString() });
test("CI approval pins source, ref, platform, public origins and expiry without credentials", () => {
  assert.equal(validateRequest(request()).repository, REPOSITORY);
  for (const patch of [{ repository: "https://example.invalid/repo.git" }, { ref: "refs/pull/1/head" }, { ref: "refs/heads/main" }, { sha: "dev" }, { platform: "linux/riscv64" }, { siteOrigin: "https://user:password@example.invalid" }, { siteOrigin: "https://example.invalid/path" }, { expiresAt: "2000-01-01" }, { secret: "unexpected" }]) assert.throws(() => validateRequest({ ...request(), ...patch }));
});
test("container gate preserves full fail-closed suites and packages the single verified standalone build", () => {
  const gate = readFileSync(new URL("../deploy/self-host-ci/gate.mjs", import.meta.url), "utf8");
  const config = readFileSync(new URL("../deploy/self-host-ci/playwright.config.mjs", import.meta.url), "utf8");
  const dockerfile = readFileSync(new URL("../deploy/self-host-ci/App.Dockerfile", import.meta.url), "utf8");
  assert.match(gate, /install:trusted/u); assert.match(gate, /verify:quick/u);
  assert.match(gate, /totals\.skipped !== 0/u);
  assert.match(config, /retries: 0/u); assert.match(config, /maxFailures: 1/u);
  assert.match(config, /video: "off"/u); assert.doesNotMatch(config, /timeout:|grep:|testMatch:/u);
  assert.match(config, /mode: "retain-on-failure", screenshots: false, snapshots: true, sources: true/u);
  assert.match(config, /cwd: "\/work"/u); assert.match(config, /reportDirectory.*results\.xml/u);
  assert.match(config, /reportDirectory.*test-results/u);
  assert.match(config, /NODE_OPTIONS: "--max-old-space-size=2048"/u);
  assert.match(config, /base\.webServer\.command.*--disable-source-maps/u);
  assert.match(config, /url: "http:\/\/127\.0\.0\.1:3100\/api\/health"/u);
  assert.match(dockerfile, /COPY --chown=nextjs:nextjs \.next\/standalone/u);
  assert.doesNotMatch(dockerfile, /npm|RUN .*build/u);
});
test("CI rejects rootful Docker, a different UID/socket and source symlinks or gitlinks", () => {
  assert.doesNotThrow(() => assertRootlessIdentity(1001, "unix:///run/user/1001/docker.sock", { OSType: "linux", SecurityOptions: ["name=rootless"] }));
  for (const uid of [0, 501, 1000]) assert.throws(() => assertRootlessIdentity(uid, "unix:///run/user/1001/docker.sock", { SecurityOptions: ["name=rootless"] }));
  assert.throws(() => assertRootlessIdentity(1001, "unix:///var/run/docker.sock", { SecurityOptions: ["name=rootless"] }));
  assert.throws(() => assertRootlessIdentity(1001, "unix:///run/user/1001/docker.sock", { OSType: "linux", SecurityOptions: [] }));
  const sha = request().sha;
  assert.equal(validateGitTree(`100644 blob ${sha}\tsrc/app/(public)/page.tsx\0`), 1);
  for (const entry of [`120000 blob ${sha}\tlink`, `160000 commit ${sha}\tmodule`, `100644 blob ${sha}\t../escape`, `100644 blob ${sha}\t.git/config`]) assert.throws(() => validateGitTree(`${entry}\0`));
});
test("artifact result requires every exact component, immutable image ID, hash and successful gate", () => {
  const approved = request();
  const value = { version: 1, sha: approved.sha, sourceHash: approved.sourceHash, platform: approved.platform, requestHash: randomBytes(32).toString("hex"), gate: "release-passed", images: ["app", "telemetry", "database"].map((component) => ({ component, tag: imageTag(approved, component), id: `sha256:${randomBytes(32).toString("hex")}`, archive: `${component}.tar`, hash: randomBytes(32).toString("hex") })) };
  assert.equal(validateResult(value, approved), value);
  for (const patch of [{ gate: "failed" }, { sha: request().sha }, { images: value.images.slice(0, 2) }, { images: [...value.images].reverse() }]) assert.throws(() => validateResult({ ...value, ...patch }, approved));
});
