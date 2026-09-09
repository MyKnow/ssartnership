#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, lstat, realpath, writeFile, chmod, unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** @param {string} platform @param {string} arch */
export function ageInstallPlan(platform = process.platform, arch = process.arch) {
  const targets = {
    x64: ["amd64", "cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10"],
    arm64: ["arm64", "6b8dc4333c53a5a57c9e5834e3a48f92605d7154014cd07269ff3327db5d37f4"],
  };
  if (platform !== "linux" || !Object.hasOwn(targets, arch)) throw new Error("MIGRATION_AGE_PLATFORM_UNSUPPORTED");
  const [name, hash] = targets[arch];
  return { version: "v1.3.2", url: `https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-${name}.tar.gz`, hash };
}
export function verifyAgeArchive(data, plan) {
  if (!Buffer.isBuffer(data) || data.length > 24 * 1024 ** 2 || createHash("sha256").update(data).digest("hex") !== plan.hash) throw new Error("MIGRATION_AGE_ARCHIVE_INVALID");
}
async function download(url) {
  const hosts = new Set(["github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"]);
  for (let redirects = 0; redirects < 4; redirects++) {
    const target = new URL(url);
    if (target.protocol !== "https:" || !hosts.has(target.hostname) || target.username || target.password || target.port) throw new Error("MIGRATION_AGE_DOWNLOAD_ORIGIN");
    const response = await fetch(target, { redirect: "manual", signal: AbortSignal.timeout(60_000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location"); await response.body?.cancel();
      if (!location) throw new Error("MIGRATION_AGE_DOWNLOAD_REDIRECT");
      url = new URL(location, target).href; continue;
    }
    if (response.status !== 200 || !response.body) throw new Error("MIGRATION_AGE_DOWNLOAD_FAILED");
    const chunks = []; let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 24 * 1024 ** 2) throw new Error("MIGRATION_AGE_DOWNLOAD_LIMIT");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  throw new Error("MIGRATION_AGE_DOWNLOAD_REDIRECT");
}
export async function installAge(directory) {
  const plan = ageInstallPlan();
  if (!path.isAbsolute(directory) || path.resolve(directory) !== directory || await realpath(path.dirname(directory)) !== path.dirname(directory)) throw new Error("MIGRATION_AGE_INSTALL_PATH");
  let parent = path.dirname(directory);
  while (true) {
    const metadata = await lstat(parent);
    if (!metadata.isDirectory() || (metadata.mode & 0o022) !== 0 || ![0, process.getuid()].includes(metadata.uid)) throw new Error("MIGRATION_AGE_INSTALL_OWNERSHIP");
    if (parent === path.dirname(parent)) break;
    parent = path.dirname(parent);
  }
  await mkdir(directory, { mode: 0o755 }); // exclusive version installation
  const data = await download(plan.url); verifyAgeArchive(data, plan);
  const archive = path.join(directory, ".download.tar.gz");
  await writeFile(archive, data, { flag: "wx", mode: 0o600 });
  const run = (command, args, stage) => {
    const result = spawnSync(command, args, { env: { PATH: process.env.PATH }, timeout: 30_000, maxBuffer: 1024 * 1024, encoding: "utf8" });
    if (result.error || result.status !== 0) throw Object.assign(new Error("MIGRATION_AGE_INSTALL_COMMAND_FAILED"), { stage, exitCode: result.status, commandUnavailable: result.error?.code === "ENOENT", timedOut: result.error?.code === "ETIMEDOUT" });
    return result.stdout.trim();
  };
  run("tar", ["--extract", "--gzip", "--file", archive, "--directory", directory, "--strip-components=1", "--no-same-owner", "--no-same-permissions", "age/age", "age/age-keygen"], "extract");
  for (const name of ["age", "age-keygen"]) {
    const file = path.join(directory, name); const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.uid !== process.getuid()) throw new Error("MIGRATION_AGE_INSTALLED_FILE_INVALID");
    await chmod(file, 0o755);
    if (run(file, ["--version"], name) !== plan.version) throw new Error("MIGRATION_AGE_VERSION_MISMATCH");
  }
  await writeFile(path.join(directory, "installation.json"), JSON.stringify(plan), { mode: 0o644, flag: "wx" });
  await unlink(archive);
  return { installed: true, version: plan.version, archiveHash: plan.hash };
}
if (process.argv[1] === "-" || (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))) {
  try {
    if (process.argv.length !== 3) throw new Error("MIGRATION_AGE_INSTALL_ARGUMENTS");
    console.log(JSON.stringify(await installAge(process.argv[2])));
  } catch { console.error('{"error":"MIGRATION_AGE_INSTALL_FAILED"}'); process.exitCode = 1; }
}
