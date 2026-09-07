import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import base from "../../playwright.config.ts";
import { assertNoFixtureDotenv, FIXTURE_BUILD_MARKER, FIXTURE_DIST } from "../webpack-fixture-boundary.mjs";
import { productionFixtureEnvironment, assertProductionFixtureArtifact } from "./production-e2e-profile.mjs";

const root = process.cwd();
assertNoFixtureDotenv(root);
const marker = resolve(root, FIXTURE_DIST, "ssartnership-test-only.json");
if (existsSync(marker)) throw new Error("E2E_FIXTURE_FRESH_BUILD_REQUIRED");
const environment = productionFixtureEnvironment(base.webServer?.env, process.env.E2E_PORT ?? "3100");
const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build", "--webpack"], { env: environment, stdio: "inherit" });
if (result.error || result.status !== 0) process.exit(result.status || 1);
writeFileSync(marker, `${JSON.stringify({ kind: FIXTURE_BUILD_MARKER, deployable: false })}\n`, { flag: "wx", mode: 0o600 });
assertProductionFixtureArtifact(root);
