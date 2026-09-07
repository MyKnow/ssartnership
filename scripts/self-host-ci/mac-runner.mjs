#!/usr/bin/env node
import { spawn, execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, open, rename, realpath, lstat, statfs } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { COMPONENTS, imageTag, sha256File, validateRequest, validateGitTree } from "./lib.mjs";
import { fingerprintDeployableArtifact } from "./production-e2e-profile.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export function assertMacDesktop(platform, info, request) {
  if (platform !== "darwin" || info.OperatingSystem !== "Docker Desktop" || info.OSType !== "linux"
    || request.platform !== "linux/amd64" || info.MemTotal < 7 * 1024 ** 3) throw new Error("CI_MAC_DESKTOP_REQUIRED");
}
// Explicit operator alternative, not the server's rootless/native CI identity.
// Containers receive only public archived source, never a Docker socket,
// credentials, SSH material, host environment, or production volume.
export async function executeMac(requestFile, sourceFile, output) {
  if (process.platform !== "darwin") throw new Error("CI_MAC_DESKTOP_REQUIRED");
  const socket = path.join(os.homedir(), ".docker/run/docker.sock");
  const socketStat = await lstat(socket);
  if (!socketStat.isSocket() || socketStat.uid !== process.getuid() || await realpath(socket) !== socket) throw new Error("CI_MAC_LOCAL_SOCKET_REQUIRED");
  const dockerPrefix = ["--host", `unix://${socket}`];
  const dockerEnvironment = { ...process.env };
  for (const key of ["DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH"]) delete dockerEnvironment[key];
  const inspect = (args) => execFileSync("docker", [...dockerPrefix, ...args], { env: dockerEnvironment, encoding: "utf8" });
  const temporary = path.join(root, ".tmp");
  if (await realpath(temporary) !== temporary) throw new Error("CI_MAC_PATH_INVALID");
  for (const file of [requestFile, sourceFile]) {
    const absolute = path.resolve(file); const stat = await lstat(absolute);
    if (!absolute.startsWith(`${temporary}/`) || await realpath(absolute) !== absolute || !stat.isFile()
      || stat.uid !== process.getuid() || stat.size > 150 * 1024 ** 2) throw new Error("CI_MAC_INPUT_INVALID");
  }
  if ((await lstat(requestFile)).size > 64 * 1024) throw new Error("CI_MAC_REQUEST_LIMIT");
  const request = validateRequest(JSON.parse(await readFile(requestFile, "utf8")));
  assertMacDesktop(process.platform, JSON.parse(inspect(["info", "--format", "{{json .}}"])), request);
  output = path.resolve(output);
  if (!output.startsWith(`${temporary}/`) || await realpath(path.dirname(output)) !== path.dirname(output)) throw new Error("CI_MAC_PATH_INVALID");
  if (await sha256File(sourceFile) !== request.sourceHash) throw new Error("CI_SOURCE_HASH_MISMATCH");
  const tree = execFileSync("git", ["ls-tree", "-rz", request.sha], { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 ** 2 });
  validateGitTree(tree);
  // Bind the local operator input to an actual reviewed Git object, not just
  // a self-asserted source hash. Preparation always uses this exact archive.
  const { createHash } = await import("node:crypto");
  const archived = execFileSync("git", ["archive", "--format=tar", request.sha], { cwd: root, maxBuffer: 150 * 1024 ** 2 });
  if (createHash("sha256").update(archived).digest("hex") !== request.sourceHash) throw new Error("CI_GIT_ARCHIVE_MISMATCH");
  const disk = await statfs(temporary);
  if (disk.bavail * disk.bsize < 30 * 1024 ** 3) throw new Error("CI_MAC_DISK_HEADROOM_REQUIRED");
  await mkdir(output, { mode: 0o700 });
  const work = path.join(output, "work"); await mkdir(work, { mode: 0o700 });
  const log = await open(path.join(output, "build.log"), "wx", 0o600);
  const container = `ssartnership-mac-ci-${request.sha.slice(0, 12)}-${Date.now()}`;
  const browserContainer = `${container}-browser`;
  async function run(args, timeout = 3_000_000) {
    await new Promise((resolve, reject) => {
      const child = spawn("docker", [...dockerPrefix, ...args], { env: dockerEnvironment, stdio: ["ignore", log.fd, log.fd] });
      const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
      child.once("error", () => { clearTimeout(timer); reject(new Error("CI_MAC_PROCESS_FAILED")); });
      child.once("close", (code) => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error("CI_MAC_STEP_FAILED")); });
    });
  }
  try {
    execFileSync("tar", ["-xf", path.resolve(sourceFile), "-C", work]);
    const gateTag = `ssartnership-ci/mac-gate:${request.sha}`;
    await run(["build", "--pull", "--platform", request.platform, "--tag", gateTag, path.join(root, "deploy/self-host-ci")]);
    const gateId = inspect(["image", "inspect", "--format", "{{.Id}}", gateTag]).trim();
    const browserTag = `ssartnership-ci/mac-browser:${request.sha}`;
    await run(["build", "--pull", "--platform", "linux/arm64", "--tag", browserTag, path.join(root, "deploy/self-host-ci")]);
    const browserImage = JSON.parse(inspect(["image", "inspect", browserTag]))[0];
    if (browserImage.Architecture !== "arm64" || browserImage.Os !== "linux") throw new Error("CI_BROWSER_IDENTITY_INVALID");
    await run(["run", "-d", "--platform", request.platform, "--name", container, "--init", "--user", "0:0", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "1024", "--memory", "5g", "--memory-swap", "5g", "--cpus", "6", "--tmpfs", "/tmp:mode=1777,size=512m", "--shm-size", "256m", "--env", "CI_EXECUTION_PROFILE=mac-amd64", "--env", "CI_NATIVE_BROWSER=1", "--env", `CI_BUILD_SITE_ORIGIN=${request.siteOrigin}`, "--env", `CI_BUILD_SUPABASE_ORIGIN=${request.supabaseOrigin}`, "--mount", `type=bind,src=${work},dst=/work`, gateId]);
    await run(["run", "-d", "--platform", "linux/arm64", "--name", browserContainer, "--init", "--user", "0:0", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "512", "--memory", "768m", "--memory-swap", "768m", "--cpus", "2", "--tmpfs", "/tmp:mode=1777,size=256m", "--shm-size", "256m", "--network", `container:${container}`, "--mount", `type=bind,src=${work},dst=/work,readonly`, "--entrypoint", "node", browserImage.Id, "/opt/ssartnership/browser-server.mjs"]);
    await run(["logs", "--follow", container]);
    const gateState = JSON.parse(inspect(["inspect", "--format", "{{json .State}}", container]));
    if (gateState.Running || gateState.ExitCode !== 0 || gateState.OOMKilled) throw new Error("CI_MAC_GATE_FAILED");
    validateRequest(request);
    const gateEvidence = JSON.parse(await readFile(path.join(work, ".self-host-build/gate.json"), "utf8"));
    if (!(gateEvidence.tests > 0) || ["failures", "errors", "skipped", "retries"].some((key) => gateEvidence[key] !== 0)) throw new Error("CI_MAC_GATE_INVALID");
    if (gateEvidence.e2eRuntime !== "production-test-only" || gateEvidence.fixtureBuildDeployable !== false) throw new Error("CI_MAC_FIXTURE_EVIDENCE_INVALID");
    if (fingerprintDeployableArtifact(work) !== gateEvidence.deployableFingerprint) throw new Error("CI_MAC_DEPLOYABLE_BUILD_CHANGED");
    const images = [];
    for (const component of COMPONENTS) {
      const tag = imageTag(request, component);
      const dockerfile = component === "app" ? path.join(root, "deploy/self-host-ci/App.Dockerfile") : path.join(work, component === "telemetry" ? "deploy/observability/Dockerfile" : "deploy/self-host-operations/Dockerfile");
      const context = component === "database" ? path.join(work, "deploy/self-host-operations") : work;
      await run(["build", "--pull", "--platform", request.platform, "--label", `org.opencontainers.image.revision=${request.sha}`, "--tag", tag, "--file", dockerfile, context]);
      const inspected = JSON.parse(inspect(["image", "inspect", tag]))[0];
      if (`${inspected.Os}/${inspected.Architecture}` !== request.platform || inspected.Config.Labels?.["org.opencontainers.image.revision"] !== request.sha) throw new Error("CI_IMAGE_IDENTITY_INVALID");
      const archive = `${component}.tar`;
      await run(["save", "--output", path.join(output, archive), tag]);
      images.push({ component, tag, id: inspected.Id, archive, hash: await sha256File(path.join(output, archive)) });
    }
    validateRequest(request);
    await writeFile(path.join(output, "gate-evidence.json"), `${JSON.stringify({ ...gateEvidence, execution: "mac-docker-desktop-amd64", nativeServerCi: false, gateImage: gateId, browserPlatform: "linux/arm64", browserImage: browserImage.Id })}\n`, { flag: "wx", mode: 0o600 });
    const result = { version: 1, sha: request.sha, sourceHash: request.sourceHash, platform: request.platform, requestHash: await sha256File(requestFile), gate: "release-passed", images };
    await writeFile(path.join(output, "result.pending.json"), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    await rename(path.join(output, "result.pending.json"), path.join(output, "result.json"));
    return { completed: true, sha: request.sha, execution: "mac-docker-desktop-amd64", nativeServerCi: false };
  } finally {
    try { await run(["logs", browserContainer], 10_000); } catch { /* Preserve available diagnostic only. */ }
    try { execFileSync("docker", [...dockerPrefix, "rm", "--force", browserContainer], { env: dockerEnvironment, stdio: "ignore" }); } catch { /* Exact sidecar only. */ }
    try { execFileSync("docker", [...dockerPrefix, "rm", "--force", container], { env: dockerEnvironment, stdio: "ignore" }); } catch { /* Exact container only. */ }
    await log.close();
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await executeMac(...process.argv.slice(2)))); }
  catch { console.error('{"error":"CI_MAC_JOB_FAILED"}'); process.exitCode = 1; }
}
