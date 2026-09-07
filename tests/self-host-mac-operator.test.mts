import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { assertMacDesktop, gateTerminationEvidence } from "../scripts/self-host-ci/mac-runner.mjs";

test("Mac gate termination evidence retains failure and OOM without arbitrary Docker fields", () => {
  assert.deepEqual(gateTerminationEvidence({ Running: false, ExitCode: 137, OOMKilled: true, Error: "do-not-copy" }), {
    version: 1, running: false, exitCode: 137, oomKilled: true,
  });
  for (const state of [{}, { Running: false, ExitCode: null, OOMKilled: false }]) assert.throws(() => gateTerminationEvidence(state));
});
import { keychainOperation, validateKeyReference } from "../scripts/self-host-operations/keychain.mjs";
import { recoveryKeyMode } from "../scripts/self-host-operations/offhost.mjs";

test("Mac AMD64 alternative cannot impersonate native server CI or use a non-Desktop engine", () => {
  const info = { OperatingSystem: "Docker Desktop", OSType: "linux", MemTotal: 8 * 1024 ** 3 };
  const request = { platform: "linux/amd64" };
  assert.doesNotThrow(() => assertMacDesktop("darwin", info, request));
  assert.throws(() => assertMacDesktop("linux", info, request));
  assert.throws(() => assertMacDesktop("darwin", { ...info, OperatingSystem: "Ubuntu" }, request));
  assert.throws(() => assertMacDesktop("darwin", info, { platform: "linux/arm64" }));
  assert.throws(() => assertMacDesktop("darwin", { ...info, MemTotal: 4 * 1024 ** 3 }, request));
});

test("canonical authentication journey proves interactivity without weakening browser history assertions", async () => {
  const source = await readFile(new URL("./e2e/auth-ops.spec.ts", import.meta.url), "utf8");
  const flow = source.slice(source.indexOf('test("uses the canonical partner'), source.indexOf('test("@critical member login'));
  const canonicalReady = flow.indexOf('await page.waitForURL(/\\/partners\\/health-001$/, { timeout: 5_000 })');
  assert.ok(canonicalReady > flow.indexOf("await page.goto("));
  assert.ok(canonicalReady < flow.indexOf("await waitForPageReady("));
  assert.ok(flow.indexOf('expect(usernameTab).toHaveAttribute("aria-selected", "true")') < flow.indexOf("await signupAction.click()"));
  assert.ok(flow.indexOf('expect(graduateTab).toHaveAttribute("aria-selected", "true")') < flow.indexOf("await page.goBack()"));
  assert.ok(flow.includes("await page.goBack()"));
  assert.ok(!flow.includes("waitForTimeout"));
  assert.ok(!flow.includes("test.setTimeout"));
});

test("Mac restore never serializes real backup keys and removes only its fresh drill container", async () => {
  const keys = { PGBACKREST_REPO1_CIPHER_PASS: "a".repeat(64), RESTIC_PASSWORD: "b".repeat(64) };
  const mode = recoveryKeyMode(keys, true);
  assert.deepEqual(mode.runtimeKeys, keys);
  assert.ok(!JSON.stringify(mode.fileKeys).includes(keys.RESTIC_PASSWORD));
  assert.ok(!JSON.stringify(mode.fileKeys).includes(keys.PGBACKREST_REPO1_CIPHER_PASS));
  assert.deepEqual(recoveryKeyMode(keys, false).fileKeys, keys);
  assert.throws(() => recoveryKeyMode({ ...keys, RESTIC_PASSWORD: "invalid" }, true));
  const cli = await readFile(new URL("../scripts/self-host-operations/cli.mjs", import.meta.url), "utf8");
  assert.ok(cli.includes('["rm", "--force", "--stop", "restore-drill-db"], { projectName: drillProject }'));
  const entry = await readFile(new URL("../scripts/self-host-operations/rehearse-pulled-recovery.mjs", import.meta.url), "utf8");
  assert.ok(entry.includes("runtimeKeysOnly: true"));
});

test("Keychain reference is public exact-schema metadata and recovery keys cannot be deleted through the helper", () => {
  const reference = { version: 1, custody: "macos-login-keychain", account: "12345678-1234-4234-8234-123456789abc", fingerprint: "a".repeat(64), synchronizable: false };
  assert.equal(validateKeyReference(reference), reference);
  for (const bad of [{ ...reference, privateKey: "secret" }, { ...reference, synchronizable: true }, { ...reference, account: "../key" }, { ...reference, custody: "pem" }]) assert.throws(() => validateKeyReference(bad));
  assert.throws(() => keychainOperation("unused", "delete-test", reference.account, undefined, "recovery"));
});

test("recovery pull never writes private PEM and helper keeps secrets out of argv and environment", async () => {
  const pull = await readFile(new URL("../scripts/self-host-operations/pull-recovery.mjs", import.meta.url), "utf8");
  const helper = await readFile(new URL("../scripts/self-host-operations/keychain.mjs", import.meta.url), "utf8");
  const swift = await readFile(new URL("../scripts/self-host-operations/keychain-helper.swift", import.meta.url), "utf8");
  assert.ok(!pull.includes("recipient-private.pem"));
  assert.ok(pull.includes("recipient-keychain.json"));
  assert.ok(helper.includes('[operation, namespace, account], { input, stdio: ["pipe", "pipe", "pipe"]'));
  assert.ok(!helper.includes("add-generic-password"));
  assert.ok(swift.includes("SecItemAdd"));
  assert.ok(!swift.includes("SecItemUpdate"));
  assert.ok(swift.includes('guard args[2] == "test"'));
});

test("desktop CI keeps every base test and deadline without cold-page preparation or native CI changes", async () => {
  const config = await readFile(new URL("../deploy/self-host-ci/playwright.desktop.config.mjs", import.meta.url), "utf8");
  const runner = await readFile(new URL("../deploy/self-host-ci/e2e-desktop.mjs", import.meta.url), "utf8");
  const native = await readFile(new URL("../scripts/self-host-ci/runner.mjs", import.meta.url), "utf8");
  const mac = await readFile(new URL("../scripts/self-host-ci/mac-runner.mjs", import.meta.url), "utf8");
  assert.ok(config.includes("...base,"));
  assert.ok(config.includes("retries: 0"));
  assert.ok(config.includes("forbidOnly: true"));
  assert.ok(!/globalSetup|testMatch|testIgnore|timeout:|grep:/u.test(config));
  assert.ok(runner.includes("requireExactInventory(expected, actual)"));
  assert.ok(runner.includes("requireStableDevLog(output)"));
  assert.ok(runner.includes("{ passed: true }"));
  assert.ok(native.includes("assertRootlessIdentity"));
  assert.ok(native.includes('"CI_NATIVE_PLATFORM_REQUIRED"'));
  assert.ok(mac.includes('const dockerPrefix = ["--host", `unix://${socket}`]'));
  assert.ok(mac.includes("socketStat.isSocket()"));
  assert.ok(mac.includes('"DOCKER_CONTEXT"'));
  assert.ok(mac.indexOf('CI_MAC_REQUEST_LIMIT') < mac.indexOf('JSON.parse(await readFile(requestFile'));
  assert.ok(mac.includes('"--network", `container:${container}`'));
  assert.ok(mac.includes('"--platform", "linux/arm64"'));
  assert.ok(mac.includes("gateState.ExitCode !== 0"));
  assert.ok(!mac.includes('"--publish"'));
  const browser = await readFile(new URL("../deploy/self-host-ci/browser-server.mjs", import.meta.url), "utf8");
  assert.ok(browser.includes('process.arch !== "arm64"'));
  assert.ok(browser.includes('version !== "1.59.1"'));
  assert.ok(browser.includes("dependencies-ready"));
  assert.ok(runner.includes('"ws://127.0.0.1:3201/"'));
  assert.ok(runner.includes("CI_E2E_BROWSER_ERROR"));
});
