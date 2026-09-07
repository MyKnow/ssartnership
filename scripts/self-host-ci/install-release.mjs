#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { assertOperatorInput, sha256File, validateRequest } from "./lib.mjs";
import { runOperatorCommand } from "./deployment.mjs";

export async function installRelease(requestFile, sourceFile) {
  if (process.getuid?.() !== 0) throw new Error("DEPLOY_OPERATOR_REQUIRED");
  await assertOperatorInput(requestFile); await assertOperatorInput(sourceFile);
  const request = validateRequest(JSON.parse(await readFile(requestFile, "utf8")));
  if (await sha256File(sourceFile) !== request.sourceHash) throw new Error("DEPLOY_SOURCE_HASH_MISMATCH");
  await assertOperatorInput("/srv/services", { directory: true });
  await mkdir("/srv/services/ssartnership", { mode: 0o750, recursive: true });
  await mkdir("/srv/services/ssartnership/releases", { mode: 0o750, recursive: true });
  await assertOperatorInput("/srv/services/ssartnership/releases", { directory: true });
  const release = `/srv/services/ssartnership/releases/${request.sha}`;
  await mkdir(release, { mode: 0o750 });
  await runOperatorCommand("tar", ["--extract", "--no-same-owner", "--no-same-permissions", "--file", sourceFile, "--directory", release]);
  await writeFile(`${release}/.approved-source.json`, `${JSON.stringify({ sha: request.sha, sourceHash: request.sourceHash })}\n`, { flag: "wx", mode: 0o600 });
  return { installed: true, sha: request.sha, sourceHash: request.sourceHash };
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  try { console.log(JSON.stringify(await installRelease(...process.argv.slice(2)))); }
  catch { console.error('{"error":"RELEASE_INSTALL_FAILED"}'); process.exitCode = 1; }
}
