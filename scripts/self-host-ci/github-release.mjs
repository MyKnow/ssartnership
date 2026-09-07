#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, lstat, realpath, chmod } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMPONENTS, sha256File, validateGitTree } from "./lib.mjs";
import { sanitizeDockerArchive } from "./archive.mjs";
import { cleanOperatorEnvironment } from "./deployment.mjs";
import { fingerprintDeployableArtifact } from "./production-e2e-profile.mjs";
import { githubContext, imageReference, validateBundle, validatePublishedRelease, SITE_ORIGIN, API_ORIGIN } from "./github-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fail = code => { throw new Error(code); };
const run = (command, args, { env = {}, visible = false, combined = false } = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, env: cleanOperatorEnvironment(env), stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", all = "", failed = false, killer;
  const stop = () => { failed = true; child.kill("SIGTERM"); killer ??= setTimeout(() => child.kill("SIGKILL"), 5000); };
  const timer = setTimeout(stop, 3_000_000);
  child.stdout.on("data", chunk => { if (visible) process.stdout.write(chunk); if (all.length + chunk.length > 8 * 1024 ** 2) stop(); else { stdout += chunk; all += chunk; } });
  child.stderr.on("data", chunk => { if (visible) process.stderr.write(chunk); if (all.length + chunk.length > 8 * 1024 ** 2) stop(); else all += chunk; });
  const close = () => { clearTimeout(timer); clearTimeout(killer); };
  child.once("error", () => { close(); reject(new Error("GITHUB_COMMAND_UNAVAILABLE")); });
  child.once("close", code => { close(); if (code === 0 && !failed) resolve(combined ? all : stdout); else reject(new Error("GITHUB_COMMAND_FAILED")); });
});
async function json(file) {
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 64 * 1024 || await realpath(file) !== file) fail("GITHUB_INPUT_INVALID");
  return JSON.parse(await readFile(file, "utf8"));
}
async function newDirectory(relative) {
  if (!/^\.tmp\/[a-z][a-z0-9-]*$/u.test(relative)) fail("GITHUB_DIRECTORY_INVALID");
  const temporary = path.join(root, ".tmp");
  await mkdir(temporary, { recursive: true, mode: 0o700 });
  if (await realpath(temporary) !== temporary) fail("GITHUB_DIRECTORY_INVALID");
  const directory = path.join(root, relative);
  await mkdir(directory, { mode: 0o700 });
  return directory;
}
async function inspectImage(tag, sha) {
  const data = JSON.parse(await run("docker", ["image", "inspect", tag]))[0];
  if (data.Os !== "linux" || data.Architecture !== "amd64" || data.Config.Labels?.["org.opencontainers.image.revision"] !== sha
    || !/^sha256:[a-f0-9]{64}$/u.test(data.Id)) fail("GITHUB_IMAGE_IDENTITY_INVALID");
  return data;
}
async function build(context, output) {
  const directory = await newDirectory(output);
  const work = path.join(directory, "work"); await mkdir(work, { mode: 0o700 });
  const payload = path.join(directory, "payload"); await mkdir(payload, { mode: 0o700 });
  if ((await run("git", ["rev-parse", "HEAD"])).trim() !== context.sha) fail("GITHUB_CHECKOUT_MISMATCH");
  validateGitTree(await run("git", ["ls-tree", "-rz", context.sha]));
  const source = path.join(directory, "source.tar");
  await run("git", ["archive", "--format=tar", "--output", source, context.sha]);
  await run("tar", ["-xf", source, "-C", work]);
  const sourceHash = await sha256File(source);
  const gateTag = `ssartnership-github-gate:${context.sha}`;
  await run("docker", ["build", "--pull", "--platform", "linux/amd64", "--tag", gateTag, path.join(work, "deploy/self-host-ci")], { visible: true });
  const gateImage = JSON.parse(await run("docker", ["image", "inspect", gateTag]))[0].Id;
  const container = `ssartnership-github-${context.runId}`;
  try {
    // Only archived public source enters the gate. No Docker socket, registry
    // login, host environment, SSH, DB credentials or operational volume.
    await run("docker", ["run", "--name", container, "--init", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", `${process.getuid()}:${process.getgid()}`, "--pids-limit", "1024", "--memory", "5g", "--memory-swap", "5g", "--cpus", "2", "--tmpfs", "/tmp:mode=1777,size=512m", "--shm-size", "256m", "--env", "CI_EXECUTION_PROFILE=github-amd64", "--env", `CI_BUILD_SITE_ORIGIN=${SITE_ORIGIN}`, "--env", `CI_BUILD_SUPABASE_ORIGIN=${API_ORIGIN}`, "--mount", `type=bind,src=${work},dst=/work`, gateImage], { visible: true });
    const state = JSON.parse(await run("docker", ["inspect", "--format", "{{json .State}}", container]));
    if (state.Running || state.ExitCode !== 0 || state.OOMKilled) fail("GITHUB_GATE_FAILED");
  } finally {
    // Preserve bounded gate output even when run() rejects. No deployment
    // manifest is written on failure, and only this job's container is removed.
    try { await writeFile(path.join(directory, "gate.log"), await run("docker", ["logs", container], { combined: true }), { flag: "wx", mode: 0o600 }); } catch { /* original failure remains fatal */ }
    try {
      const state = JSON.parse(await run("docker", ["inspect", "--format", "{{json .State}}", container]));
      await writeFile(path.join(directory, "gate-termination.json"), JSON.stringify({ running: state.Running, exitCode: state.ExitCode, oomKilled: state.OOMKilled }), { flag: "wx", mode: 0o600 });
    } catch { /* Missing state never creates approval evidence. */ }
    await run("docker", ["rm", "--force", container]);
  }
  const evidence = await json(path.join(work, ".self-host-build/gate.json"));
  if (fingerprintDeployableArtifact(work) !== evidence.deployableFingerprint) fail("GITHUB_DEPLOYABLE_CHANGED");
  const gate = Object.fromEntries(["tests", "failures", "errors", "skipped", "retries", "e2eRuntime", "fixtureBuildDeployable"].map(key => [key, evidence[key]]));
  const images = [];
  for (const component of COMPONENTS) {
    const tag = imageReference(component, context.sha);
    const dockerfile = path.join(work, component === "app" ? "deploy/self-host-ci/App.Dockerfile" : component === "telemetry" ? "deploy/observability/Dockerfile" : "deploy/self-host-operations/Dockerfile");
    const buildContext = component === "database" ? path.join(work, "deploy/self-host-operations") : work;
    process.stdout.write(`Packaging ${component}\n`);
    await run("docker", ["build", "--pull", "--platform", "linux/amd64", "--label", `org.opencontainers.image.revision=${context.sha}`, "--label", "org.opencontainers.image.source=https://github.com/MyKnow/ssartnership", "--tag", tag, "--file", dockerfile, buildContext], { visible: true });
    const image = await inspectImage(tag, context.sha);
    const archive = `${component}.tar`;
    await run("docker", ["save", "--output", path.join(payload, archive), tag]);
    images.push({ component, tag, id: image.Id, archive, hash: await sha256File(path.join(payload, archive)) });
  }
  if (fingerprintDeployableArtifact(work) !== evidence.deployableFingerprint) fail("GITHUB_DEPLOYABLE_CHANGED");
  const bundle = validateBundle({ version: 1, ...context, platform: "linux/amd64", sourceHash, gate, images }, context);
  await writeFile(path.join(payload, "bundle.json"), JSON.stringify(bundle), { flag: "wx", mode: 0o600 });
  return { built: true, sha: context.sha, payload };
}
async function assertCurrentDev(context) {
  if (!process.env.GH_TOKEN) fail("GITHUB_READ_TOKEN_REQUIRED");
  const sha = (await run("gh", ["api", "repos/MyKnow/ssartnership/git/ref/heads/dev", "--jq", ".object.sha"], { env: { GH_TOKEN: process.env.GH_TOKEN } })).trim();
  if (sha !== context.sha) fail("GITHUB_STALE_DEV");
}
async function publish(context, input, output) {
  if (!/^\.tmp\/[a-z][a-z0-9-]*$/u.test(input)) fail("GITHUB_DIRECTORY_INVALID");
  const source = path.join(root, input);
  if (await realpath(source) !== source) fail("GITHUB_DIRECTORY_INVALID");
  const bundle = validateBundle(await json(path.join(source, "bundle.json")), context);
  const directory = await newDirectory(output);
  await assertCurrentDev(context);
  const images = [];
  for (const item of bundle.images) {
    const archive = path.join(source, item.archive);
    const meta = await lstat(archive);
    if (!meta.isFile() || meta.isSymbolicLink() || meta.size > 3 * 1024 ** 3 || await realpath(archive) !== archive || await sha256File(archive) !== item.hash) fail("GITHUB_ARCHIVE_INVALID");
    const sanitized = path.join(directory, `${item.component}.approved.tar`);
    await sanitizeDockerArchive(archive, sanitized, item, { sha: context.sha, platform: "linux/amd64" });
    await run("docker", ["load", "--input", sanitized], { visible: true });
    const image = await inspectImage(item.tag, context.sha);
    // Sanitization may change a containerd index ID into the config ID. Its
    // config/layer closure was already verified by sanitizeDockerArchive.
    await assertCurrentDev(context);
    await run("docker", ["push", item.tag], { visible: true });
    const pushed = await inspectImage(item.tag, context.sha);
    const name = item.tag.split(":")[0];
    const refs = pushed.RepoDigests.filter(ref => ref.startsWith(`${name}@sha256:`));
    if (refs.length !== 1) fail("GITHUB_PUBLISHED_DIGEST_AMBIGUOUS");
    images.push({ component: item.component, id: image.Id, digest: refs[0].split("@")[1], reference: refs[0] });
  }
  await assertCurrentDev(context);
  const published = validatePublishedRelease({ ...bundle, images }, context);
  const manifest = path.join(directory, "release.json");
  await writeFile(manifest, JSON.stringify(published), { flag: "wx", mode: 0o600 });
  await chmod(manifest, 0o600);
  return { published: true, sha: context.sha, manifestHash: createHash("sha256").update(JSON.stringify(published)).digest("hex") };
}
async function main() {
  const context = githubContext();
  if (process.platform !== "linux" || process.arch !== "x64" || process.getuid() === 0 || process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT || process.env.DOCKER_TLS_VERIFY) fail("GITHUB_HOSTED_LINUX_REQUIRED");
  process.umask(0o077);
  const [command, ...args] = process.argv.slice(2);
  if (command === "build" && args.length === 1) return build(context, args[0]);
  if (command === "publish" && args.length === 2) return publish(context, ...args);
  fail("GITHUB_ARGUMENTS_INVALID");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(result => console.log(JSON.stringify(result))).catch(() => { console.error('{"error":"GITHUB_RELEASE_FAILED"}'); process.exitCode = 1; });
}
