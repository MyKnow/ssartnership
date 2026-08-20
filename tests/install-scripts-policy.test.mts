import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import test from "node:test";

import {
  buildControlledInstallEnvironment,
  validateEffectiveNpmConfig,
  validateStaticInstallPolicy,
} from "../scripts/check-install-scripts.mjs";

const readRepoFile = (relativePath: string) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

async function loadStaticPolicyInput() {
  const [packageJsonText, packageLockText, npmConfig, vendorManifest, vendorIndex] =
    await Promise.all([
      readRepoFile("package.json"),
      readRepoFile("package-lock.json"),
      readRepoFile(".npmrc"),
      readRepoFile("vendor/archiver-cjs-compat/package.json"),
      readRepoFile("vendor/archiver-cjs-compat/index.cjs"),
    ]);

  return {
    packageJson: JSON.parse(packageJsonText),
    packageLock: JSON.parse(packageLockText),
    npmConfig,
    vendorPackageJson: JSON.parse(vendorManifest),
    vendorDigests: {
      "index.cjs": createHash("sha256").update(vendorIndex).digest("hex"),
      "package.json": createHash("sha256").update(vendorManifest).digest("hex"),
    },
  };
}

test("trusted install 정책이 registry identity와 lifecycle inventory를 고정한다", async () => {
  const input = await loadStaticPolicyInput();
  assert.doesNotThrow(() => validateStaticInstallPolicy(input));
});

test("Production nanoid 보안 수정 버전을 package와 lock 계약에 함께 고정한다", async () => {
  const { packageJson, packageLock } = await loadStaticPolicyInput();
  const nanoid = packageLock.packages["node_modules/nanoid"];

  assert.equal(packageJson.overrides.nanoid, "3.3.18");
  assert.equal(nanoid.version, "3.3.18");
  assert.equal(
    nanoid.resolved,
    "https://registry.npmjs.org/nanoid/-/nanoid-3.3.18.tgz",
  );
  assert.equal(
    nanoid.integrity,
    "sha512-DTg4MJbGMWkfi6VZFdNt2/caMbQy4Ou+Op/hJQvGEWcnVfoA1QA+xzRKAzw9jD6+GVOOeYr/mIcuDSdug6F6+w==",
  );
});

test("root lifecycle 또는 검토되지 않은 dependency source를 차단한다", async () => {
  const input = await loadStaticPolicyInput();
  const lifecycleInput = structuredClone(input);
  lifecycleInput.packageJson.scripts.postinstall = "node scripts/unreviewed.mjs";
  assert.throws(
    () => validateStaticInstallPolicy(lifecycleInput),
    /root install lifecycle scripts are forbidden/,
  );

  const sourceInput = structuredClone(input);
  sourceInput.packageJson.dependencies.unreviewed = "git+https://example.invalid/repo.git";
  assert.throws(
    () => validateStaticInstallPolicy(sourceInput),
    /unreviewed non-registry dependency source/,
  );
});

test("설치 child environment가 application secret과 전역 Home 상태를 상속하지 않는다", () => {
  const environment = buildControlledInstallEnvironment({
    CI: "1",
    GITHUB_ACTIONS: "true",
    HOME: "untrusted-home",
    PATH: "untrusted-path",
    SUPABASE_SERVICE_ROLE_KEY: "untrusted-secret",
    SystemRoot: "windows-system-root",
  });

  assert.equal(environment.CI, "1");
  assert.equal(environment.GITHUB_ACTIONS, "true");
  assert.equal(environment.SystemRoot, "windows-system-root");
  assert.equal(environment.PATH, dirname(process.execPath));
  assert.equal("HOME" in environment, false);
  assert.equal("SUPABASE_SERVICE_ROLE_KEY" in environment, false);
  assert.match(environment.NPM_CONFIG_CACHE, /\.tmp[/\\]install-state[/\\]cache$/);
});

test("GitHub Actions npm runtime과 effective lifecycle 제어를 fail-closed로 검증한다", () => {
  const config = {
    allowGit: "none",
    ignoreScripts: "true",
    omitLockfileRegistryResolved: "false",
  };
  assert.doesNotThrow(() =>
    validateEffectiveNpmConfig({
      npmVersionText: "11.16.0",
      config,
      githubActions: true,
    }),
  );
  assert.throws(
    () =>
      validateEffectiveNpmConfig({
        npmVersionText: "11.12.1",
        config,
        githubActions: true,
      }),
    /requires exact npm 11\.16\.0/,
  );
  assert.throws(
    () =>
      validateEffectiveNpmConfig({
        npmVersionText: "11.16.0",
        config: { ...config, ignoreScripts: "false" },
      }),
    /ignore-scripts must be true/,
  );
});
