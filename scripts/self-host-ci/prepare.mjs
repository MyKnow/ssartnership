#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { REPOSITORY, SHA, validateGitTree, validateRequest, sha256File } from "./lib.mjs";

// Operator-only preparation. This creates public, reviewed input, never
// installs a runner, triggers Actions, fetches credentials or changes a ref.
export async function prepare(directory, sha, ref, platform, siteOrigin, supabaseOrigin, vapidPublicKey) {
  if (!SHA.test(sha ?? "")) throw new Error("CI_SHA_REQUIRED");
  const git = (args) => execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  if (git(["rev-parse", `${ref}^{commit}`]).trim() !== sha) throw new Error("CI_REF_SHA_MISMATCH");
  validateGitTree(git(["ls-tree", "-rz", sha]));
  const target = path.resolve(directory);
  await mkdir(target, { mode: 0o700 });
  const source = path.join(target, "source.tar");
  execFileSync("git", ["-c", "core.hooksPath=/dev/null", "archive", "--format=tar", `--output=${source}`, sha]);
  const request = validateRequest({ version: 1, repository: REPOSITORY, ref, sha, sourceHash: await sha256File(source), platform, siteOrigin, supabaseOrigin, ...(vapidPublicKey ? { vapidPublicKey } : {}), expiresAt: new Date(Date.now() + 23 * 60 * 60_000).toISOString() });
  await writeFile(path.join(target, "request.json"), `${JSON.stringify(request, null, 2)}\n`, { mode: 0o444, flag: "wx" });
  return { prepared: true, sha, sourceHash: request.sourceHash };
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  try { console.log(JSON.stringify(await prepare(...process.argv.slice(2)))); }
  catch { console.error('{"error":"CI_PREPARATION_FAILED"}'); process.exitCode = 1; }
}
