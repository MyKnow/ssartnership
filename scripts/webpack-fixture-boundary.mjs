import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";

export const FIXTURE_BUILD_MARKER = "synthetic-production-e2e-v1";
export const FIXTURE_HEADER = "X-Ssartnership-Test-Build";
export const FIXTURE_DIST = ".next-e2e";

/** @param {Record<string, string | undefined>} environment */
export function fixtureBuildProfile(environment) {
  const flag = environment.SELF_HOST_E2E_BUILD;
  if (!flag || flag === "0") return false;
  if (flag !== "1" || environment.CI !== "1" || environment.NODE_ENV !== "production"
    || environment.SELF_HOST_BUILD === "1" || environment.NEXT_DIST_DIR !== FIXTURE_DIST
    || environment.NEXT_PUBLIC_DATA_SOURCE !== "mock"
    || environment.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE !== "mock"
    || ["BASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "MM_BASE_URL"].some((key) => environment[key])) {
    throw new Error("E2E_FIXTURE_BUILD_BOUNDARY_INVALID");
  }
  return true;
}

export function assertNoFixtureDotenv(root) {
  for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
    if (existsSync(resolve(root, name))) throw new Error("E2E_FIXTURE_DOTENV_FORBIDDEN");
  }
}

// Fail closed even if a future source import accidentally reaches a test file.
export class FixtureModuleBoundaryPlugin {
  constructor(root, enabled) {
    this.directory = resolve(root, "tests/fixtures/production-runtime") + sep;
    this.policy = resolve(root, "src/lib/local-fixture-policy.mjs");
    this.enabled = enabled;
  }
  apply(compiler) {
    if (this.enabled) {
      // Match the resolved resource as well as the request: Next's path
      // resolution can replace the @/ spelling before ordinary aliases run.
      new compiler.webpack.NormalModuleReplacementPlugin(/local-fixture-policy\.mjs$/u, (data) => {
        if (data.createData?.resource === this.policy) data.createData.resource = this.directory + "policy.mjs";
        else if (data.request === this.policy) data.request = this.directory + "policy.mjs";
      }).apply(compiler);
    }
    compiler.hooks.compilation.tap("FixtureModuleBoundary", (compilation) => {
      compilation.hooks.finishModules.tap("FixtureModuleBoundary", (modules) => {
        if (!this.enabled && [...modules].some((module) => module.resource?.startsWith(this.directory))) {
          throw new Error("E2E_FIXTURE_MODULE_IN_DEPLOYABLE_BUILD");
        }
        if (this.enabled && [...modules].some((module) => module.resource === this.policy)) {
          throw new Error("E2E_FIXTURE_POLICY_REPLACEMENT_MISSING");
        }
      });
    });
  }
}

export function configureFixtureCompiler(config, { dev, root, enabled }) {
  if (enabled && dev) throw new Error("E2E_FIXTURE_PRODUCTION_COMPILER_REQUIRED");
  config.plugins.push(new FixtureModuleBoundaryPlugin(root, enabled));
}
