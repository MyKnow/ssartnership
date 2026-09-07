import { spawnSync } from "node:child_process";
import { fixtureBuildProfile } from "../webpack-fixture-boundary.mjs";
import { assertProductionFixtureArtifact, productionFixtureEnvironment } from "./production-e2e-profile.mjs";
import base from "../../playwright.config.ts";

const port = process.argv[2];
if (!/^[1-9][0-9]{3,4}$/u.test(port ?? "") || Number(port) > 65535
  || !fixtureBuildProfile(process.env)) throw new Error("E2E_FIXTURE_START_INVALID");
assertProductionFixtureArtifact(process.cwd());
const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port], {
  stdio: "inherit", env: productionFixtureEnvironment(base.webServer?.env, port),
});
process.exit(result.status || 1);
