import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

mkdirSync(process.env.HOME, { recursive: true, mode: 0o700 });
const publicBuild = { SELF_HOST_BUILD: "1", NEXT_PUBLIC_DATA_SOURCE: "supabase", NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "supabase", NEXT_PUBLIC_SITE_URL: process.env.CI_BUILD_SITE_ORIGIN, NEXT_PUBLIC_SUPABASE_URL: process.env.CI_BUILD_SUPABASE_ORIGIN, NEXT_PUBLIC_VAPID_PUBLIC_KEY: "" };
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
  // Same config, projects, full suite and zero retries as test:e2e:ci. Use the
  // image-pinned bundled Chromium, not the host-only Chrome installation.
  ["node", [process.env.CI_EXECUTION_PROFILE === "mac-amd64" ? "/opt/ssartnership/e2e-desktop.mjs" : "/opt/ssartnership/e2e.mjs"]],
];
for (const [command, args, extra = {}] of steps) {
  const result = spawnSync(command, args, { stdio: "inherit", env: { ...process.env, PLAYWRIGHT_CHROMIUM_CHANNEL: "chromium", ...extra } });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
  if (args.join(" ") === "run install:trusted" && process.env.CI_NATIVE_BROWSER === "1") {
    mkdirSync("/work/.self-host-build", { recursive: true, mode: 0o700 });
    writeFileSync("/work/.self-host-build/dependencies-ready", "ready\n", { flag: "wx", mode: 0o600 });
  }
}
const totals = JSON.parse(readFileSync("/work/.self-host-build/e2e/complete.json", "utf8"));
if (!(totals.tests > 0) || totals.failures !== 0 || totals.errors !== 0 || totals.skipped !== 0) process.exit(1);
writeFileSync("/work/.self-host-build/gate.json", `${JSON.stringify({ ...totals, retries: 0, video: "off", compiledSource: "single-build" })}\n`, { flag: "wx", mode: 0o600 });
