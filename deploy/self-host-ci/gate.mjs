import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fingerprintDeployableArtifact } from "/work/scripts/self-host-ci/production-e2e-profile.mjs";

mkdirSync(process.env.HOME, { recursive: true, mode: 0o700 });
const productionFixture = ["mac-amd64", "github-amd64"].includes(process.env.CI_EXECUTION_PROFILE);
const publicBuild = { SELF_HOST_BUILD: "1", NEXT_PUBLIC_DATA_SOURCE: "supabase", NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "supabase", NEXT_PUBLIC_SITE_URL: process.env.CI_BUILD_SITE_ORIGIN, NEXT_PUBLIC_SUPABASE_URL: process.env.CI_BUILD_SUPABASE_ORIGIN, NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.CI_BUILD_VAPID_PUBLIC_KEY ?? "" };
// The source archive has no Git config, hooks or credentials. A fresh index
// enables the repository's tracked-file checks; it is not a fake source SHA.
const steps = [
  ["git", ["init", "--quiet"]],
  ["git", ["-c", "core.hooksPath=/dev/null", "add", "--all"]],
  ["npm", ["run", "install:trusted"]],
  ["npm", ["run", "check:docs"]],
  ["npm", ["run", "verify:quick"]],
  ["node", ["deploy/self-host/write-build-env-manifest.mjs", "/work/.self-host-build/build-env.json"], publicBuild],
  ["npm", ["run", "build"], publicBuild],
  ...(productionFixture
    ? [["node", ["scripts/self-host-ci/build-production-e2e.mjs"]]] : []),
  // Same config, projects, full suite and zero retries as test:e2e:ci. Use the
  // image-pinned bundled Chromium, not the host-only Chrome installation.
  ["node", [productionFixture ? "/opt/ssartnership/e2e-desktop.mjs" : "/opt/ssartnership/e2e.mjs"]],
];
let deployableFingerprint;
for (const [command, args, extra = {}] of steps) {
  const result = spawnSync(command, args, { stdio: "inherit", env: { ...process.env, PLAYWRIGHT_CHROMIUM_CHANNEL: "chromium", ...extra } });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
  if (args.join(" ") === "run build") deployableFingerprint = fingerprintDeployableArtifact("/work");
  if (args.join(" ") === "run install:trusted" && process.env.CI_NATIVE_BROWSER === "1") {
    mkdirSync("/work/.self-host-build", { recursive: true, mode: 0o700 });
    writeFileSync("/work/.self-host-build/dependencies-ready", "ready\n", { flag: "wx", mode: 0o600 });
  }
}
const totals = JSON.parse(readFileSync("/work/.self-host-build/e2e/complete.json", "utf8"));
if (!(totals.tests > 0) || totals.failures !== 0 || totals.errors !== 0 || totals.skipped !== 0) process.exit(1);
if (!deployableFingerprint || fingerprintDeployableArtifact("/work") !== deployableFingerprint) throw new Error("CI_DEPLOYABLE_BUILD_CHANGED_AFTER_TESTS");
writeFileSync("/work/.self-host-build/gate.json", `${JSON.stringify({ ...totals, retries: 0, video: "off", compiledSource: "single-deployable-build", deployableFingerprint, e2eRuntime: productionFixture ? "production-test-only" : "development", fixtureBuildDeployable: false })}\n`, { flag: "wx", mode: 0o600 });
