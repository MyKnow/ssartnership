import assert from "node:assert/strict";
import test from "node:test";
import { allowsLocalFixtures } from "../src/lib/local-fixture-policy.mjs";
import { fixtureBuildProfile, configureFixtureCompiler, FIXTURE_BUILD_MARKER, FIXTURE_HEADER, assertNoFixtureDotenv } from "../scripts/webpack-fixture-boundary.mjs";
import { productionFixtureEnvironment, assertDeployableArtifact, assertProductionFixtureArtifact, fingerprintDeployableArtifact } from "../scripts/self-host-ci/production-e2e-profile.mjs";
import { validateSelfHostRuntimeEnvironment } from "../deploy/self-host/runtime-env.mjs";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import type { webpack } from "next/dist/compiled/webpack/webpack";

const fixtureEnvironment = {
  CI: "1", NODE_ENV: "production", SELF_HOST_E2E_BUILD: "1",
  NEXT_DIST_DIR: ".next-e2e", NEXT_PUBLIC_DATA_SOURCE: "mock",
  NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "mock",
};

test("production Playwright config preserves projects and binds server commands to the repository root", () => {
  const code = "const {default:base}=await import('./playwright.config.ts'); const {default:config}=await import('./deploy/self-host-ci/playwright.production.config.ts'); console.log(JSON.stringify({cwd:config.webServer.cwd,testDir:config.testDir,projects:JSON.stringify(config.projects)===JSON.stringify(base.projects),retries:config.retries,command:config.webServer.command}));";
  const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", code], { cwd: new URL("..", import.meta.url), encoding: "utf8" }));
  assert.equal(result.cwd, fileURLToPath(new URL("..", import.meta.url)));
  assert.equal(result.testDir, fileURLToPath(new URL("./e2e", import.meta.url)));
  assert.equal(result.projects, true);
  assert.equal(result.retries, 0);
  assert.ok(result.command.includes("start-production-e2e.mjs"));
});

test("normal production policy cannot enable fixture bypasses with runtime flags", () => {
  assert.equal(allowsLocalFixtures({ NODE_ENV: "production", ...{ SELF_HOST_E2E_BUILD: "1", E2E_MOCK_MUTATIONS: "1" } }), false);
  assert.equal(allowsLocalFixtures({ NODE_ENV: "development" }), true);
  assert.equal(allowsLocalFixtures({ NODE_ENV: "test" }), true);
});

test("only the explicit fixture build bounds static worker concurrency", () => {
  for (const enabled of [false, true]) {
    const code = "const {default:config}=await import('./next.config.ts'); console.log(JSON.stringify({workers:config.experimental.cpus??null}));";
    const env = { ...process.env, SELF_HOST_E2E_BUILD: "0", ...(enabled ? fixtureEnvironment : {}), NODE_ENV: "production" as const };
    const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", code], { cwd: new URL("..", import.meta.url), env, encoding: "utf8" }));
    assert.equal(result.workers, enabled ? 2 : null);
  }
});

test("production fixture build requires explicit CI, isolated output and only mock providers", () => {
  assert.equal(fixtureBuildProfile({}), false);
  assert.equal(fixtureBuildProfile(fixtureEnvironment), true);
  for (const patch of [
    { SELF_HOST_E2E_BUILD: "true" }, { CI: "0" }, { NODE_ENV: "development" },
    { SELF_HOST_BUILD: "1" }, { NEXT_DIST_DIR: ".next" },
    { NEXT_PUBLIC_DATA_SOURCE: "supabase" }, { NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "supabase" },
    { SUPABASE_SERVICE_ROLE_KEY: "synthetic-not-real" }, { BASE_URL: "https://example.test" },
  ]) assert.throws(() => fixtureBuildProfile({ ...fixtureEnvironment, ...patch }));
});

test("fixture environment excludes inherited provider credentials and deployment flags", () => {
  const result = productionFixtureEnvironment({ ...fixtureEnvironment, E2E_MOCK_MUTATIONS: "1" }, "3150", {
    PATH: "/usr/bin", SUPABASE_SERVICE_ROLE_KEY: "synthetic-secret", SELF_HOST_BUILD: "1", MM_BASE_URL: "https://example.test", NODE_OPTIONS: "--require=untrusted",
  });
  assert.equal(result.PATH, "/usr/bin");
  assert.equal(result.SUPABASE_SERVICE_ROLE_KEY, undefined);
  assert.equal(result.SELF_HOST_BUILD, undefined);
  assert.equal(result.NEXT_PUBLIC_SITE_URL, "http://127.0.0.1:3150");
  assert.equal(result.NODE_ENV, "production");
  for (const port of ["80", "65536", "3150 --hostname 0.0.0.0", "../3100"]) assert.throws(() => productionFixtureEnvironment({}, port));
});

test("the pinned webpack compiler replaces only the isolated test policy and rejects fixture leakage", async () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const temporary = await mkdtemp(join(tmpdir(), "ssartnership-fixture-webpack-"));
  const { webpack: compile } = createRequire(import.meta.url)("next/dist/compiled/webpack/webpack");
  try {
    for (const [enabled, leak] of [[false, false], [true, false], [false, true]]) {
      const output = join(temporary, `${enabled}-${leak}`);
      const options = {
        mode: "production", target: "node", devtool: false, optimization: { minimize: false },
        entry: leak ? resolve(root, "tests/fixtures/production-runtime/policy.mjs") : resolve(root, "src/lib/local-fixture-policy.mjs"),
        output: { path: output, filename: "policy.cjs", library: { type: "commonjs2" } },
        resolve: { alias: { "@/lib/local-fixture-policy.mjs$": resolve(root, "src/lib/local-fixture-policy.mjs") } },
        plugins: [],
      };
      configureFixtureCompiler(options, { dev: false, root, enabled });
      const compiler = compile(options);
      try {
        const execution = new Promise<void>((yes, no) => compiler.run((error: Error | null, stats: webpack.Stats) => {
          if (error) no(error); else if (stats.hasErrors()) no(new Error(stats.toString({ all: false, errors: true }))); else yes();
        }));
        if (leak) await assert.rejects(execution, /E2E_FIXTURE_MODULE_IN_DEPLOYABLE_BUILD/u);
        else {
          await execution;
          const policy = createRequire(import.meta.url)(join(output, "policy.cjs"));
          assert.equal(policy.allowsLocalFixtures({ NODE_ENV: "production", SELF_HOST_E2E_BUILD: "1" }), enabled);
        }
      } finally { await new Promise<void>((yes, no) => compiler.close((error: Error | null) => error ? no(error) : yes())); }
    }
    assert.throws(() => configureFixtureCompiler({ plugins: [] }, { dev: true, root, enabled: true }));
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

test("fixture marker, output, headers and real-provider manifest are distinct artifact boundaries", async () => {
  const root = await mkdtemp(join(tmpdir(), "ssartnership-fixture-artifact-"));
  const json = (name: string, value: unknown) => writeFile(join(root, name), JSON.stringify(value));
  try {
    await mkdir(join(root, ".next/standalone"), { recursive: true });
    await mkdir(join(root, ".next/static"));
    await mkdir(join(root, ".self-host-build"));
    await mkdir(join(root, ".next-e2e"));
    await json(".next/required-server-files.json", { config: { distDir: ".next", output: "standalone" } });
    await json(".next/routes-manifest.json", { headers: [] });
    await json(".next/standalone/server.js", {});
    await json(".self-host-build/build-env.json", { publicEnvironment: { NEXT_PUBLIC_DATA_SOURCE: "supabase", NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "supabase" } });
    assert.doesNotThrow(() => assertDeployableArtifact(root));
    const original = fingerprintDeployableArtifact(root);
    assert.equal(fingerprintDeployableArtifact(root), original);
    await json(".next/standalone/server.js", { changed: true });
    assert.notEqual(fingerprintDeployableArtifact(root), original);
    await json(".next-e2e/required-server-files.json", { config: { distDir: ".next-e2e" } });
    await json(".next-e2e/ssartnership-test-only.json", { kind: FIXTURE_BUILD_MARKER, deployable: false });
    const headers = { headers: [{ headers: [{ key: FIXTURE_HEADER, value: FIXTURE_BUILD_MARKER }] }] };
    await json(".next-e2e/routes-manifest.json", headers);
    assert.doesNotThrow(() => assertProductionFixtureArtifact(root));
    await json(".next/routes-manifest.json", headers);
    assert.throws(() => assertDeployableArtifact(root));
    await mkdir(join(root, ".next-e2e/standalone"));
    assert.throws(() => assertProductionFixtureArtifact(root));
    await writeFile(join(root, ".env.production.local"), "SYNTHETIC=1");
    assert.throws(() => assertNoFixtureDotenv(root));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("deployable runtime refuses E2E flags and packaging never copies the test output", async () => {
  for (const name of ["SELF_HOST_E2E_BUILD", "E2E_MOCK_MUTATIONS", "E2E_ADMIN_AUTH"]) {
    const result = validateSelfHostRuntimeEnvironment({ SELF_HOST_MODE: "real", [name]: "1" }, {});
    assert.ok(result.some((item: { code: string; subject: string }) => item.code === "e2e_fixture_flag_forbidden" && item.subject === name));
  }
  const dockerfile = await readFile(new URL("../deploy/self-host-ci/App.Dockerfile", import.meta.url), "utf8");
  assert.ok(!dockerfile.includes(".next-e2e"));
  assert.ok(dockerfile.includes(".next/standalone"));
  const ignore = await readFile(new URL("../deploy/self-host-ci/App.Dockerfile.dockerignore", import.meta.url), "utf8");
  assert.ok(ignore.startsWith("**\n"));
  assert.ok(!ignore.includes("!.next-e2e"));
});
