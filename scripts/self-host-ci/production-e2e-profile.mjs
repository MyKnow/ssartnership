import { existsSync, readFileSync, readdirSync, lstatSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { FIXTURE_BUILD_MARKER, FIXTURE_DIST, FIXTURE_HEADER, fixtureBuildProfile } from "../webpack-fixture-boundary.mjs";

/** @param {Record<string, string> | undefined} base
 * @param {string} port
 * @param {Record<string, string | undefined>} inherited */
export function productionFixtureEnvironment(base, port, inherited = process.env) {
  if (!base || !/^[1-9][0-9]{3,4}$/u.test(port) || Number(port) > 65535) throw new Error("E2E_FIXTURE_CONFIGURATION_INVALID");
  // No host/provider environment or dotenv credentials enter the test build.
  const allowed = ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "SystemRoot", "COMSPEC", "PATHEXT"];
  /** @type {Record<string, string>} */
  const environment = {};
  for (const key of allowed) {
    const value = inherited[key];
    if (typeof value === "string") environment[key] = value;
  }
  Object.assign(environment, base, {
    CI: "1", NODE_ENV: "production", SELF_HOST_E2E_BUILD: "1",
    NEXT_DIST_DIR: FIXTURE_DIST, NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`, NEXT_PUBLIC_VAPID_PUBLIC_KEY: "",
    NODE_OPTIONS: "--max-old-space-size=3072",
  });
  fixtureBuildProfile(environment);
  return environment;
}

export function assertProductionFixtureArtifact(root) {
  const directory = resolve(root, FIXTURE_DIST);
  const marker = JSON.parse(readFileSync(resolve(directory, "ssartnership-test-only.json"), "utf8"));
  const { config } = JSON.parse(readFileSync(resolve(directory, "required-server-files.json"), "utf8"));
  const routes = JSON.parse(readFileSync(resolve(directory, "routes-manifest.json"), "utf8"));
  if (marker.kind !== FIXTURE_BUILD_MARKER || marker.deployable !== false || Object.keys(marker).length !== 2 || config.distDir !== FIXTURE_DIST || config.output
    || existsSync(resolve(directory, "standalone"))
    || !routes.headers?.some((route) => route.headers?.some((item) => item.key === FIXTURE_HEADER && item.value === FIXTURE_BUILD_MARKER))) {
    throw new Error("E2E_FIXTURE_ARTIFACT_INVALID");
  }
}

export function assertDeployableArtifact(root) {
  const directory = resolve(root, ".next");
  const { config } = JSON.parse(readFileSync(resolve(directory, "required-server-files.json"), "utf8"));
  const routes = JSON.parse(readFileSync(resolve(directory, "routes-manifest.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(resolve(root, ".self-host-build/build-env.json"), "utf8"));
  if (config.distDir !== ".next" || config.output !== "standalone"
    || !Array.isArray(routes.headers)
    || !existsSync(resolve(directory, "standalone/server.js"))
    || existsSync(resolve(directory, "ssartnership-test-only.json"))
    || routes.headers?.some((route) => route.headers?.some((item) => item.key.toLowerCase() === FIXTURE_HEADER.toLowerCase()))
    || manifest.publicEnvironment?.NEXT_PUBLIC_DATA_SOURCE !== "supabase"
    || manifest.publicEnvironment?.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE !== "supabase") {
    throw new Error("E2E_FIXTURE_ARTIFACT_NOT_DEPLOYABLE");
  }
}

export function fingerprintDeployableArtifact(root) {
  assertDeployableArtifact(root);
  const hash = createHash("sha256");
  let count = 0; let bytes = 0;
  const visit = (name) => {
    const path = resolve(root, name);
    const stat = lstatSync(path);
    if (++count > 50_000 || (!stat.isFile() && !stat.isDirectory())) throw new Error("CI_DEPLOYABLE_TREE_INVALID");
    hash.update(`${name}\0${stat.mode & 0o777}\0`);
    if (stat.isDirectory()) {
      for (const child of readdirSync(path).sort()) visit(`${name}/${child}`);
    } else {
      bytes += stat.size;
      if (stat.size > 64 * 1024 ** 2 || bytes > 2 * 1024 ** 3) throw new Error("CI_DEPLOYABLE_TREE_LIMIT");
      hash.update(`${stat.size}\0`); hash.update(readFileSync(path));
    }
  };
  for (const name of [".next/standalone", ".next/static", ".next/required-server-files.json", ".next/routes-manifest.json", ".self-host-build/build-env.json"]) visit(name);
  return hash.digest("hex");
}
