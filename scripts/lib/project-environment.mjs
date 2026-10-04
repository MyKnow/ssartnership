import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

function currentBranch(root) {
  const result = spawnSync("git", ["branch", "--show-current"], {
    cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

/** @param {{command?: string, branch?: string, environment?: Record<string, string | undefined>}} options */
export function selectEnvironmentProfile({ command = "dev", branch = "", environment = process.env } = {}) {
  const hasDataSources = environment.NEXT_PUBLIC_DATA_SOURCE && environment.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE;
  const injected = hasDataSources && (
    ["1", "true"].includes(environment.CI) || environment.SELF_HOST_BUILD === "1"
    || (environment.NEXT_PUBLIC_DATA_SOURCE === "mock" && environment.NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE === "mock")
  );
  if (injected) return "injected";
  if (["dev", "doctor", "bootstrap"].includes(command)) return "preview";
  // A secret-free CI bootstrap may use its generated Preview mock profile.
  if (["1", "true"].includes(environment.CI)) return "preview";
  if (!branch) throw new Error("ENV_BRANCH_REQUIRED: use a named branch for local build/start.");
  return branch === "main" ? "production" : "preview";
}

/** @param {{root?: string, environment?: Record<string, string | undefined>, command?: string, branch?: string, allowMissing?: boolean}} options */
export function loadEnvironmentProfile({ root = process.cwd(), environment = process.env, command = "dev", branch, allowMissing = false } = {}) {
  const profile = selectEnvironmentProfile({ command, branch: branch ?? currentBranch(root), environment });
  if (profile === "injected") return { profile, loadedFiles: [], values: { ...environment } };
  const file = `.env.${profile}`;
  const path = join(root, file);
  if (!existsSync(path)) {
    if (!allowMissing) throw new Error(`ENV_PROFILE_MISSING: ${file}`);
    return { profile, loadedFiles: [], values: { ...environment } };
  }
  let parsed;
  try { parsed = parseEnv(readFileSync(path, "utf8")); }
  catch { throw new Error(`ENV_PROFILE_UNREADABLE: ${file}`); }
  // Explicit shell/CI values retain their normal precedence. No legacy or
  // opposite-profile file is ever merged into this environment.
  return { profile, loadedFiles: [file], values: { ...parsed, ...environment } };
}

export function nextProcessEnvironment(environment) {
  const preload = fileURLToPath(new URL("./next-environment.cjs", import.meta.url));
  const option = `--require=${JSON.stringify(preload)}`;
  const options = environment.NODE_OPTIONS ?? "";
  return {
    ...environment,
    NODE_OPTIONS: options.includes(option) ? options : `${options} ${option}`.trim(),
  };
}

export function buildEnvironmentIdentity({ profile, values }) {
  const publicValues = Object.entries(values).filter(([key]) => key.startsWith("NEXT_PUBLIC_")).toSorted(([a], [b]) => a.localeCompare(b));
  return { profile, publicHash: createHash("sha256").update(JSON.stringify(publicValues)).digest("hex") };
}

export function assertBuildEnvironment(selected, source) {
  let saved;
  try { saved = JSON.parse(source); } catch { throw new Error("ENV_BUILD_IDENTITY_MISSING: run npm run build."); }
  const expected = buildEnvironmentIdentity(selected);
  if (saved.profile !== expected.profile || saved.publicHash !== expected.publicHash) {
    throw new Error("ENV_BUILD_PROFILE_MISMATCH: rebuild for the selected environment.");
  }
}
