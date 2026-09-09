#!/usr/bin/env node
import { constants } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdir, open, readFile, writeFile, statfs } from "node:fs/promises";
import path from "node:path";
import { assertOperatorInput, sha256File, validateRequest, validateResult } from "./lib.mjs";
import { sanitizeDockerArchive } from "./archive.mjs";

// The privileged operator never follows a builder-owned symlink, reads a
// device/FIFO, or loads a file while the builder can replace its contents.
export async function copyRegularArtifact(source, destination, maxSize, expectedOwner) {
  const input = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let output;
  try {
    const stat = await input.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > maxSize || (expectedOwner !== undefined && stat.uid !== expectedOwner)) throw new Error("CI_ARTIFACT_FILE_INVALID");
    output = await open(destination, "wx", 0o600);
    const buffer = Buffer.alloc(1024 ** 2);
    let copied = 0;
    while (copied < stat.size) {
      const { bytesRead } = await input.read(buffer, 0, Math.min(buffer.length, stat.size - copied), copied);
      if (!bytesRead) throw new Error("CI_ARTIFACT_TRUNCATED");
      await output.writeFile(buffer.subarray(0, bytesRead));
      copied += bytesRead;
    }
    if ((await output.stat()).size !== stat.size || (await input.stat()).size !== stat.size) throw new Error("CI_ARTIFACT_CHANGED");
    await output.sync();
  } finally { await input.close(); await output?.close(); }
}
export function validateLoadedImage(inspected, proof, request) {
  if (`${inspected.Os}/${inspected.Architecture}` !== request.platform || inspected.Config?.Labels?.["org.opencontainers.image.revision"] !== request.sha) throw new Error("CI_LOADED_IDENTITY_INVALID");
  const canonical = (value) => JSON.stringify(value, (_, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
  for (const [key, value] of Object.entries(proof.config)) if (canonical(inspected.Config[key]) !== canonical(value)) throw new Error("CI_LOADED_CONFIG_INVALID");
  if (canonical(inspected.RootFS?.Layers) !== canonical(proof.diffIds) || !/^sha256:[a-f0-9]{64}$/u.test(inspected.Id)) throw new Error("CI_LOADED_LAYERS_INVALID");
  return inspected.Id;
}
export async function importArtifacts(requestFile, artifactDirectory, stageDirectory) {
  if (process.getuid?.() !== 0 || process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT) throw new Error("CI_DEPLOY_OPERATOR_REQUIRED");
  await assertOperatorInput(requestFile);
  const request = validateRequest(JSON.parse(await readFile(requestFile, "utf8")));
  if (!/^\/srv\/ci\/artifacts\/ssartnership\/[a-f0-9]{40}-[a-f0-9]{12}$/u.test(artifactDirectory ?? "") || !/^\/var\/lib\/ssartnership-ci\/releases\/[a-f0-9]{40}-[a-f0-9]{12}$/u.test(stageDirectory ?? "")) throw new Error("CI_ARTIFACT_DIRECTORY_INVALID");
  if (![artifactDirectory, stageDirectory].every((directory) => path.basename(directory).startsWith(`${request.sha}-`))) throw new Error("CI_ARTIFACT_JOB_MISMATCH");
  await assertOperatorInput(path.dirname(stageDirectory), { directory: true });
  const disk = await statfs(path.dirname(stageDirectory));
  if (disk.bavail * disk.bsize < 25 * 1024 ** 3) throw new Error("CI_IMPORT_DISK_HEADROOM_REQUIRED");
  const directory = await open(artifactDirectory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
  if ((await directory.stat()).uid !== 1001) throw new Error("CI_ARTIFACT_OWNER_INVALID");
  // A pinned directory FD also closes the parent-symlink/rename race. The
  // Linux operator can read only regular files owned by the dedicated builder.
  const sourceRoot = `/proc/self/fd/${directory.fd}`;
  await mkdir(stageDirectory, { mode: 0o700 });
  await copyRegularArtifact(path.join(sourceRoot, "result.json"), path.join(stageDirectory, "result.json"), 64 * 1024, 1001);
  const result = validateResult(JSON.parse(await readFile(path.join(stageDirectory, "result.json"), "utf8")), request);
  if (result.requestHash !== await sha256File(requestFile)) throw new Error("CI_APPROVAL_HASH_MISMATCH");
  const verified = new Map();
  for (const expected of result.images) {
    const archive = path.join(stageDirectory, expected.archive);
    await copyRegularArtifact(path.join(sourceRoot, expected.archive), archive, 3 * 1024 ** 3, 1001);
    if (await sha256File(archive) !== expected.hash) throw new Error("CI_ARTIFACT_HASH_MISMATCH");
    verified.set(expected.component, await sanitizeDockerArchive(archive, path.join(stageDirectory, `verified-${expected.archive}`), expected, request));
  }
  // All three archives must pass before touching the operational image store.
  const loaded = [];
  for (const expected of result.images) {
    execFileSync("docker", ["--host", "unix:///var/run/docker.sock", "load", "--input", path.join(stageDirectory, `verified-${expected.archive}`)], { stdio: "pipe", timeout: 300_000, maxBuffer: 1024 * 1024 });
    const inspected = JSON.parse(execFileSync("docker", ["--host", "unix:///var/run/docker.sock", "image", "inspect", expected.tag], { encoding: "utf8" }))[0];
    const proof = verified.get(expected.component);
    validateLoadedImage(inspected, proof, request);
    loaded.push({ component: expected.component, id: inspected.Id, sourceImageId: expected.id, configDigest: proof.configDigest });
  }
  await writeFile(path.join(stageDirectory, "loaded.json"), `${JSON.stringify(loaded, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  const environment = loaded.map((item) => `${({ app: "SELF_HOST_IMAGE", telemetry: "SELF_HOST_TELEMETRY_IMAGE", database: "SELF_HOST_PGBACKREST_IMAGE" })[item.component]}=${item.id}`).join("\n");
  await writeFile(path.join(stageDirectory, "images.env"), `${environment}\n`, { mode: 0o600, flag: "wx" });
  return { imported: true, sha: request.sha, platform: request.platform };
  } finally { await directory.close(); }
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  try { console.log(JSON.stringify(await importArtifacts(...process.argv.slice(2)))); }
  catch { console.error('{"error":"CI_ARTIFACT_IMPORT_FAILED"}'); process.exitCode = 1; }
}
