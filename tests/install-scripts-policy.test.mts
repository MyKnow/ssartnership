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


const SECURITY_PINNED_PACKAGES = [
  {
    lockPath: "node_modules/next",
    version: "16.4.6",
    integrity:
      "sha512-QZJiYhaZLJMo2KpkQGQIwvmd79WVsAWeYIU554a8d7zArS3si/IRy3lBNV/rtYhE70oLwdLYhPAXLPx8HwcwtA==",
  },
  {
    lockPath: "node_modules/zod",
    version: "4.6.7",
    integrity:
      "sha512-g8W2D2kU6a8untc053fX1uVBKzM7yqAxW/3zwk83+6RyF2+SKOuV+c0wBDhUwzV1PaGapmZH+rmcUzPf+3CGwg==",
  },
  {
    lockPath: "node_modules/nodemailer",
    version: "10.1.7",
    integrity:
      "sha512-OQa6FDln5fLttmqSbjDiRYvFDOFNrBqfiOwHPlEbURil3b+vPB1v8xpi+Sp46drzNDlsTnNsS502vthmz56r4w==",
  },
  {
    lockPath: "node_modules/sanitize-html",
    version: "2.18.2",
    integrity:
      "sha512-LTQVNHBeKB5qIae9x2J2Fw68ORnES++8vzYaG7DFT8P4GVCJFeHffHnRUzf5Mrxfx+4GweIvMRqkBPHHodaVNg==",
  },
  {
    lockPath: "node_modules/readdir-glob",
    version: "4.0.0",
    integrity:
      "sha512-TG+tPOT85yLmgnlsp6xIu7/cOZsFYs74utMOZRahGQ1HAm3QGT63MSUD64WyzbQg/WN8hciv/+43XTzeIgn83w==",
  },
  {
    lockPath: "node_modules/readdir-glob/node_modules/minimatch",
    version: "11.0.9",
    integrity:
      "sha512-KCFkfyjqerNlSstjlhIGNXIKZGA/6O4V4RlhZ+Dsr621SPPw0mzlypE9D9ZOoPiVefHID+j7/XuMMlqfD/F60Q==",
  },
];

test("Production 2026-11 보안 권고 수정 버전을 package와 lock 계약에 함께 고정한다", async () => {
  const { packageJson, packageLock } = await loadStaticPolicyInput();

  assert.equal(packageJson.dependencies.next, "16.4.6");
  assert.equal(packageJson.dependencies.nodemailer, "10.1.7");
  assert.equal(packageJson.dependencies.zod, "^4.6.7");
  assert.equal(packageJson.dependencies["sanitize-html"], "^2.18.2");
  assert.equal(packageJson.overrides["readdir-glob"], "4.0.0");

  for (const { lockPath, version, integrity } of SECURITY_PINNED_PACKAGES) {
    const entry = packageLock.packages[lockPath];
    const name = lockPath.split("node_modules/").at(-1);
    assert.equal(entry?.version, version, lockPath);
    assert.equal(
      entry.resolved,
      `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`,
      lockPath,
    );
    assert.equal(entry.integrity, integrity, lockPath);
    assert.notEqual(entry.dev, true, lockPath);
  }
});

test("개발 도구의 2026-11 보안 수정 버전 바닥을 lock에 고정한다", async () => {
  const { packageJson, packageLock } = await loadStaticPolicyInput();
  const versionOf = (lockPath: string) => packageLock.packages[lockPath]?.version;

  assert.equal(packageJson.overrides.vite, "8.1.7");
  assert.deepEqual(
    packageJson.overrides["@joshwooding/vite-plugin-react-docgen-typescript"],
    { glob: "14.0.6" },
  );
  assert.equal(versionOf("node_modules/vite"), "8.1.7");
  assert.equal(versionOf("node_modules/glob"), "14.0.6");
  assert.equal(versionOf("node_modules/storybook"), "10.6.7");
  assert.equal(versionOf("node_modules/@storybook/addon-vitest"), "10.6.7");
  assert.equal(versionOf("node_modules/@vitest/mocker"), "4.1.12");

  const vulnerableMinimatch = Object.entries(packageLock.packages).filter(
    ([lockPath, entry]) =>
      /(^|\/)node_modules\/minimatch$/.test(lockPath) &&
      /^(7|8|9|10)\./.test((entry as { version: string }).version),
  );
  assert.deepEqual(vulnerableMinimatch, []);

  const vulnerableZod = Object.entries(packageLock.packages).filter(
    ([lockPath, entry]) =>
      /(^|\/)node_modules\/zod$/.test(lockPath) &&
      !/^4\.(6\.([6-9]|\d{2,})|([7-9]|\d{2,})\.)/.test(
        (entry as { version: string }).version,
      ),
  );
  assert.deepEqual(vulnerableZod, []);
});

test("Production sharp가 librsvg 수정 버전부터 설치된다", async () => {
  const { packageJson, packageLock } = await loadStaticPolicyInput();
  assert.equal(packageJson.dependencies.sharp, "^0.35.5");
  assert.equal(packageLock.packages["node_modules/sharp"].version, "0.35.5");
  assert.equal(packageLock.packages["node_modules/@img/sharp-libvips-linux-x64"].version, "1.3.4");
});

test("Production source-map-js 보안 수정 버전을 package와 lock 계약에 함께 고정한다", async () => {
  const { packageJson, packageLock } = await loadStaticPolicyInput();
  const sourceMap = packageLock.packages["node_modules/source-map-js"];

  assert.equal(packageJson.overrides["source-map-js"], "1.2.2");
  assert.equal(sourceMap.version, "1.2.2");
  assert.equal(
    sourceMap.resolved,
    "https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.2.tgz",
  );
  assert.equal(
    sourceMap.integrity,
    "sha512-KGj/8Y43x35aZVDtt+J4mK1hoLGHULMYfSkODJNQjNDC3oW1PqPoxMwo0pLUsWM/UEGzON/NxeHywEfNXNP3Vw==",
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
    NODE_ENV: "test",
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
  assert.ok(environment.NPM_CONFIG_CACHE);
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
