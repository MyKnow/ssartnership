#!/usr/bin/env node
import { spawn, execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, open, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertOperatorInput, assertRootlessIdentity, COMPONENTS, imageTag, sha256File, validateRequest } from "./lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cleanEnvironment = () => ({ PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/srv/ci", XDG_RUNTIME_DIR: "/run/user/1001", DOCKER_HOST: "unix:///run/user/1001/docker.sock" });
async function run(command, args, log, timeout = 1_500_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: cleanEnvironment(), stdio: ["ignore", log.fd, log.fd] });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.once("error", () => { clearTimeout(timer); reject(new Error("CI_PROCESS_UNAVAILABLE")); });
    child.once("close", (code) => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error("CI_STEP_FAILED")); });
  });
}
export async function execute(requestFile, sourceFile, output) {
  assertRootlessIdentity(process.getuid?.(), process.env.DOCKER_HOST, JSON.parse(execFileSync("docker", ["info", "--format", "{{json .}}"], { env: cleanEnvironment(), encoding: "utf8" })));
  await assertOperatorInput(requestFile);
  await assertOperatorInput(sourceFile);
  const request = validateRequest(JSON.parse(await readFile(requestFile, "utf8")));
  if (await sha256File(sourceFile) !== request.sourceHash) throw new Error("CI_SOURCE_HASH_MISMATCH");
  if (!/^\/srv\/ci\/artifacts\/ssartnership\/[a-f0-9]{40}-[a-f0-9]{12}$/u.test(output ?? "")) throw new Error("CI_OUTPUT_INVALID");
  const machine = execFileSync("docker", ["info", "--format", "{{.Architecture}}"], { env: cleanEnvironment(), encoding: "utf8" }).trim();
  if (request.platform !== `linux/${({ x86_64: "amd64", aarch64: "arm64" })[machine] ?? machine}`) throw new Error("CI_NATIVE_PLATFORM_REQUIRED");
  await mkdir(output, { mode: 0o700 });
  const work = path.join(output, "work");
  await mkdir(work, { mode: 0o700 });
  const log = await open(path.join(output, "build.log"), "wx", 0o600);
  const suffix = path.basename(output);
  const container = `ssartnership-ci-${suffix}`;
  const gateTag = `ssartnership-ci/gate:${request.sha}`;
  try {
    await run("tar", ["--extract", "--no-same-owner", "--no-same-permissions", "--file", sourceFile, "--directory", work], log);
    // The gate Dockerfile comes from the root-owned installed controller,
    // never from a mutable CI checkout. Only reviewed source enters /work.
    await run("docker", ["build", "--pull", "--tag", gateTag, path.join(root, "deploy/self-host-ci")], log);
    const gateId = execFileSync("docker", ["image", "inspect", "--format", "{{.Id}}", gateTag], { env: cleanEnvironment(), encoding: "utf8" }).trim();
    // Root inside the rootless user namespace maps to ci-builder (1001) on
    // the host, allowing its private source bind; it is never host root.
    await run("docker", ["run", "--name", container, "--label", "io.ssartnership.ci=true", "--rm", "--init", "--user", "0:0", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "768", "--memory", "3500m", "--memory-swap", "4g", "--cpus", "1.5", "--tmpfs", "/tmp:mode=1777,size=512m", "--shm-size", "256m", "--env", `CI_BUILD_SITE_ORIGIN=${request.siteOrigin}`, "--env", `CI_BUILD_SUPABASE_ORIGIN=${request.supabaseOrigin}`, "--mount", `type=bind,src=${work},dst=/work`, gateId], log);
    validateRequest(request); // Expired approval cannot publish an artifact.
    const images = [];
    for (const component of COMPONENTS) {
      const tag = imageTag(request, component);
      const dockerfile = component === "app" ? path.join(root, "deploy/self-host-ci/App.Dockerfile") : path.join(work, component === "telemetry" ? "deploy/observability/Dockerfile" : "deploy/self-host-operations/Dockerfile");
      const context = component === "database" ? path.join(work, "deploy/self-host-operations") : work;
      const args = ["build", "--pull", "--platform", request.platform, "--label", `org.opencontainers.image.revision=${request.sha}`, "--tag", tag, "--file", dockerfile];
      await run("docker", [...args, context], log);
      const inspected = JSON.parse(execFileSync("docker", ["image", "inspect", tag], { env: cleanEnvironment(), encoding: "utf8" }))[0];
      if (`${inspected.Os}/${inspected.Architecture}` !== request.platform || inspected.Config.Labels?.["org.opencontainers.image.revision"] !== request.sha) throw new Error("CI_IMAGE_IDENTITY_INVALID");
      const archive = `${component}.tar`;
      await run("docker", ["save", "--output", path.join(output, archive), tag], log);
      images.push({ component, tag, id: inspected.Id, archive, hash: await sha256File(path.join(output, archive)) });
    }
    const gateEvidence = JSON.parse(await readFile(path.join(work, ".self-host-build/gate.json"), "utf8"));
    await writeFile(path.join(output, "gate-evidence.json"), `${JSON.stringify(gateEvidence)}\n`, { mode: 0o600, flag: "wx" });
    const result = { version: 1, sha: request.sha, sourceHash: request.sourceHash, platform: request.platform, requestHash: await sha256File(requestFile), gate: "release-passed", images };
    await writeFile(path.join(output, "result.pending.json"), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await rename(path.join(output, "result.pending.json"), path.join(output, "result.json"));
    return { completed: true, sha: request.sha, platform: request.platform };
  } finally {
    // Only the exact task container may be removed. Failure logs/work/cache
    // remain for diagnosis; never global prune or delete a shared directory.
    try { execFileSync("docker", ["rm", "--force", container], { env: cleanEnvironment(), stdio: "ignore" }); } catch { /* Already --rm'ed or never created. */ }
    await log.close();
  }
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  try { console.log(JSON.stringify(await execute(...process.argv.slice(2)))); }
  catch { console.error('{"error":"CI_JOB_FAILED"}'); process.exitCode = 1; }
}
