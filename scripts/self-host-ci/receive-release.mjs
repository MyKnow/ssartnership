#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { mkdir, readFile, writeFile, lstat, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { verifyRemoteJobs, verifyRemoteRelease } from "./github-contract.mjs";
import { switchApplication } from "./deployment.mjs";

const API_ORIGIN = "https://api.github.com";
const REPOSITORY = "MyKnow/ssartnership";
const WORKFLOW_PATH = ".github/workflows/self-host-preview.yml";
const ARTIFACT_NAME = "ssartnership-preview-release";
const SHA = /^[a-f0-9]{40}$/u;
const HASH = /^sha256:[a-f0-9]{64}$/u;
const MAX_API_BYTES = 4 * 1024 * 1024;
const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 128 * 1024;
const requiresRootOwnership = process.getuid?.() === 0;

export const RECEIVER_CONFIG = {
  tokenFile: "/etc/myknow/secrets/ssartnership-original-preview/github-token",
  stateFile: "/var/lib/ssartnership-ci/original-preview/receiver-state.json",
  releaseRoot: "/var/lib/ssartnership-ci/original-preview/releases",
  composeFile: "/opt/ssartnership/control/current/deploy/self-host/compose.original-preview.yaml",
  composeCwd: "/opt/ssartnership/control/current",
  runtimeEnvFile: "/etc/myknow/secrets/ssartnership-original-preview/app.env",
  composeProject: "ssartnership-original-preview",
  healthOrigin: "http://127.0.0.1:3108",
};

function fail(code) {
  throw new Error(code);
}

function assertAbsolutePath(file) {
  if (typeof file !== "string" || !path.isAbsolute(file) || file.includes("\0")) fail("RECEIVER_PATH_INVALID");
  return file;
}

async function readRootToken(file) {
  assertAbsolutePath(file);
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.uid !== 0 || (metadata.mode & 0o077) !== 0 || metadata.size < 20 || metadata.size > 512) fail("RECEIVER_TOKEN_INVALID");
  if (await realpath(file) !== file) fail("RECEIVER_TOKEN_INVALID");
  const token = (await readFile(file, "utf8")).trim();
  if (token.length < 20 || token.length > 256 || /[\s\u0000-\u001f\u007f]/u.test(token)) fail("RECEIVER_TOKEN_INVALID");
  return token;
}

async function readBody(response, limit) {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > limit) fail("RECEIVER_RESPONSE_TOO_LARGE");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body ?? []) {
    bytes += chunk.length;
    if (bytes > limit) fail("RECEIVER_RESPONSE_TOO_LARGE");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function apiUrl(relative) {
  if (typeof relative !== "string" || !relative.startsWith("/repos/MyKnow/ssartnership/")) fail("RECEIVER_API_PATH_INVALID");
  const url = new URL(relative, API_ORIGIN);
  if (url.origin !== API_ORIGIN) fail("RECEIVER_API_PATH_INVALID");
  return url;
}

async function fetchApi(relative, token, fetcher = fetch) {
  const response = await fetcher(apiUrl(relative), {
    redirect: "error",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ssartnership-self-host-receiver/1",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    fail("RECEIVER_GITHUB_API_FAILED");
  }
  try {
    return JSON.parse((await readBody(response, MAX_API_BYTES)).toString("utf8"));
  } catch {
    fail("RECEIVER_GITHUB_JSON_INVALID");
  }
}

function allowedArtifactRedirect(url) {
  return url.protocol === "https:"
    && (url.hostname === "pipelines.actions.githubusercontent.com" || url.hostname.endsWith(".blob.core.windows.net"));
}

async function fetchArtifact(urlValue, token, fetcher = fetch) {
  let url;
  try { url = new URL(urlValue); } catch { fail("RECEIVER_ARTIFACT_URL_INVALID"); }
  if (url.origin !== API_ORIGIN || url.username || url.password) fail("RECEIVER_ARTIFACT_URL_INVALID");
  let response = await fetcher(url, {
    redirect: "manual",
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "User-Agent": "ssartnership-self-host-receiver/1" },
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) fail("RECEIVER_ARTIFACT_REDIRECT_INVALID");
    try { url = new URL(location, url); } catch { fail("RECEIVER_ARTIFACT_REDIRECT_INVALID"); }
    if (!allowedArtifactRedirect(url)) fail("RECEIVER_ARTIFACT_REDIRECT_INVALID");
    // Do not forward the GitHub token to the object-storage redirect target.
    response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
  }
  if (!response.ok) {
    await response.body?.cancel();
    fail("RECEIVER_ARTIFACT_DOWNLOAD_FAILED");
  }
  return readBody(response, MAX_ARTIFACT_BYTES);
}

function validateArtifactDigest(bytes, artifact) {
  if (artifact?.digest !== undefined && (!HASH.test(artifact.digest) || artifact.digest !== `sha256:${createHash("sha256").update(bytes).digest("hex")}`)) fail("RECEIVER_ARTIFACT_DIGEST_INVALID");
  if (!Number.isSafeInteger(artifact?.size_in_bytes) || artifact.size_in_bytes !== bytes.length || artifact.size_in_bytes < 1 || artifact.size_in_bytes > MAX_ARTIFACT_BYTES) fail("RECEIVER_ARTIFACT_SIZE_INVALID");
}

const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_CENTRAL_FILE_HEADER = 0x02014b50;
const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_MAX_COMMENT_BYTES = 0xffff;
const ZIP_RELEASE_NAME = Buffer.from("release.json", "ascii");

function zipUint16(bytes, offset) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset + 2 > bytes.length) fail("RECEIVER_ARTIFACT_ZIP_INVALID");
  return bytes.readUInt16LE(offset);
}

function zipUint32(bytes, offset) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset + 4 > bytes.length) fail("RECEIVER_ARTIFACT_ZIP_INVALID");
  return bytes.readUInt32LE(offset);
}

function zipCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = ZIP_CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const ZIP_CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) === 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  return value >>> 0;
});

function findZipEndOfCentralDirectory(bytes) {
  const earliest = Math.max(0, bytes.length - (22 + ZIP_MAX_COMMENT_BYTES));
  for (let offset = bytes.length - 22; offset >= earliest; offset -= 1) {
    if (zipUint32(bytes, offset) !== ZIP_END_OF_CENTRAL_DIRECTORY) continue;
    const commentLength = zipUint16(bytes, offset + 20);
    if (offset + 22 + commentLength === bytes.length) return offset;
  }
  fail("RECEIVER_ARTIFACT_ZIP_INVALID");
}

function parseSingleReleaseZip(bytes) {
  const endOffset = findZipEndOfCentralDirectory(bytes);
  const disk = zipUint16(bytes, endOffset + 4);
  const centralDisk = zipUint16(bytes, endOffset + 6);
  const entriesOnDisk = zipUint16(bytes, endOffset + 8);
  const totalEntries = zipUint16(bytes, endOffset + 10);
  const centralSize = zipUint32(bytes, endOffset + 12);
  const centralOffset = zipUint32(bytes, endOffset + 16);
  if (disk !== 0 || centralDisk !== 0 || centralSize === 0xffffffff || centralOffset === 0xffffffff
    || centralOffset + centralSize !== endOffset) fail("RECEIVER_ARTIFACT_ZIP_INVALID");
  if (entriesOnDisk !== 1 || totalEntries !== 1) fail("RECEIVER_ARTIFACT_CONTENT_INVALID");

  const central = centralOffset;
  if (zipUint32(bytes, central) !== ZIP_CENTRAL_FILE_HEADER) fail("RECEIVER_ARTIFACT_ZIP_INVALID");
  const madeBy = zipUint16(bytes, central + 4);
  const flags = zipUint16(bytes, central + 8);
  const method = zipUint16(bytes, central + 10);
  const crc = zipUint32(bytes, central + 16);
  const compressedSize = zipUint32(bytes, central + 20);
  const uncompressedSize = zipUint32(bytes, central + 24);
  const nameLength = zipUint16(bytes, central + 28);
  const extraLength = zipUint16(bytes, central + 30);
  const commentLength = zipUint16(bytes, central + 32);
  const externalAttributes = zipUint32(bytes, central + 38);
  const localOffset = zipUint32(bytes, central + 42);
  const centralEnd = central + 46 + nameLength + extraLength + commentLength;
  if (centralEnd !== endOffset || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff
    || (flags & 0x1) !== 0 || ![0, 8].includes(method)) fail("RECEIVER_ARTIFACT_ZIP_INVALID");
  if (nameLength !== ZIP_RELEASE_NAME.length || !bytes.subarray(central + 46, central + 46 + nameLength).equals(ZIP_RELEASE_NAME)) fail("RECEIVER_ARTIFACT_CONTENT_INVALID");

  const unixMode = (madeBy >>> 8) === 3 ? (externalAttributes >>> 16) & 0xffff : 0;
  if ((unixMode & 0o170000) === 0o120000 || (unixMode & 0o170000) === 0o040000 || ((madeBy >>> 8) !== 3 && (externalAttributes & 0x10) !== 0)) fail("RECEIVER_ARTIFACT_CONTENT_INVALID");
  if (uncompressedSize > MAX_MANIFEST_BYTES || compressedSize > MAX_ARTIFACT_BYTES) fail("RECEIVER_MANIFEST_TOO_LARGE");

  if (zipUint32(bytes, localOffset) !== ZIP_LOCAL_FILE_HEADER) fail("RECEIVER_ARTIFACT_ZIP_INVALID");
  const localFlags = zipUint16(bytes, localOffset + 6);
  const localMethod = zipUint16(bytes, localOffset + 8);
  const localNameLength = zipUint16(bytes, localOffset + 26);
  const localExtraLength = zipUint16(bytes, localOffset + 28);
  const localNameEnd = localOffset + 30 + localNameLength;
  const dataStart = localNameEnd + localExtraLength;
  const dataEnd = dataStart + compressedSize;
  if (localFlags !== flags || localMethod !== method || localNameLength !== nameLength
    || !bytes.subarray(localOffset + 30, localNameEnd).equals(ZIP_RELEASE_NAME)
    || dataStart < 0 || dataEnd > centralOffset || dataEnd < dataStart) fail("RECEIVER_ARTIFACT_ZIP_INVALID");

  let content;
  try {
    content = method === 0 ? bytes.subarray(dataStart, dataEnd) : inflateRawSync(bytes.subarray(dataStart, dataEnd), { maxOutputLength: MAX_MANIFEST_BYTES });
  } catch {
    fail("RECEIVER_ARTIFACT_ZIP_INVALID");
  }
  if (content.length !== uncompressedSize || zipCrc32(content) !== crc) fail("RECEIVER_ARTIFACT_ZIP_INVALID");
  return content;
}

export async function parseReleaseArtifact(bytes, artifact) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 22 || bytes.length > MAX_ARTIFACT_BYTES) fail("RECEIVER_ARTIFACT_SIZE_INVALID");
  validateArtifactDigest(bytes, artifact);
  const content = parseSingleReleaseZip(bytes);
  try { return JSON.parse(content.toString("utf8")); } catch { fail("RECEIVER_MANIFEST_INVALID"); }
}

export function selectFirstAttemptRun(payload, sha) {
  if (!SHA.test(sha) || !payload || !Array.isArray(payload.workflow_runs)) fail("RECEIVER_RUN_LIST_INVALID");
  const matching = payload.workflow_runs.filter((run) => run?.head_sha === sha);
  const approved = matching.filter((run) => run?.status === "completed" && run?.conclusion === "success" && run?.run_attempt === 1);
  if (approved.length > 1) fail("RECEIVER_RUN_AMBIGUOUS");
  return approved[0] ?? null;
}

function validateArtifactMetadata(artifacts, runId) {
  if (!Array.isArray(artifacts?.artifacts)) fail("RECEIVER_ARTIFACT_LIST_INVALID");
  const matching = artifacts.artifacts.filter((artifact) => artifact?.name === ARTIFACT_NAME);
  if (matching.length !== 1) fail("RECEIVER_ARTIFACT_AMBIGUOUS");
  const artifact = matching[0];
  if (artifact.expired || artifact.workflow_run?.id !== runId || typeof artifact.archive_download_url !== "string") fail("RECEIVER_ARTIFACT_NOT_APPROVED");
  return artifact;
}

async function dockerProcess(args, { input, allowFailure = false, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const extra = Object.fromEntries(Object.entries(env).filter(([key, value]) => /^SELF_HOST_(?:IMAGE|TELEMETRY_IMAGE)$/u.test(key) && /^sha256:[a-f0-9]{64}$/u.test(String(value))));
    const child = spawn("docker", args, {
      env: { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", HOME: "/root", LANG: "C", ...extra },
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), 120_000);
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-2 * 1024 * 1024); });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-64 * 1024); });
    child.once("error", () => { clearTimeout(timer); reject(new Error("RECEIVER_DOCKER_UNAVAILABLE")); });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0 || allowFailure) resolve({ code: code ?? 1, stdout, stderr });
      else reject(new Error("RECEIVER_DOCKER_FAILED"));
    });
    if (input !== undefined) child.stdin.end(input);
  });
}

export function validatePulledImage(inspected, expected, sha) {
  if (!inspected || expected?.component === undefined || !SHA.test(sha) || !HASH.test(expected.digest) || !/^sha256:[a-f0-9]{64}$/u.test(expected.id)
    || inspected.Id !== expected.id || inspected.Os !== "linux" || inspected.Architecture !== "amd64"
    || inspected.Config?.Labels?.["org.opencontainers.image.revision"] !== sha
    || !Array.isArray(inspected.RepoDigests) || inspected.RepoDigests.length !== 1 || inspected.RepoDigests[0] !== expected.reference) fail("RECEIVER_IMAGE_NOT_APPROVED");
  return true;
}

async function writeAtomic(file, value) {
  assertAbsolutePath(file);
  const parent = path.dirname(file);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const temporary = path.join(parent, `.${path.basename(file)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await rename(temporary, file);
  } finally { await rm(temporary, { force: true }); }
}

async function loadState(file) {
  try {
    const metadata = await lstat(file);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.uid !== 0 || (metadata.mode & 0o077) !== 0 || await realpath(file) !== file) fail("RECEIVER_STATE_INVALID");
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    if (error?.message?.startsWith("RECEIVER_STATE")) throw error;
    fail("RECEIVER_STATE_INVALID");
  }
}

export function isMainModule(argvPath = process.argv[1], moduleUrl = import.meta.url) {
  if (typeof argvPath !== "string") return false;
  try { return realpathSync(argvPath) === realpathSync(fileURLToPath(moduleUrl)); } catch { return false; }
}

async function saveManifest(root, sha, manifest) {
  assertAbsolutePath(root);
  if (!SHA.test(sha)) fail("RECEIVER_SHA_INVALID");
  await mkdir(root, { recursive: true, mode: 0o700 });
  const rootMetadata = await lstat(root);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink() || (requiresRootOwnership && rootMetadata.uid !== 0) || (rootMetadata.mode & 0o077) !== 0) fail("RECEIVER_RELEASE_ROOT_INVALID");
  const canonicalRoot = await realpath(root);
  const directory = path.join(canonicalRoot, sha);
  await mkdir(directory, { mode: 0o700 }).catch((error) => { if (error?.code !== "EEXIST") throw error; });
  const directoryMetadata = await lstat(directory);
  if (!directoryMetadata.isDirectory() || directoryMetadata.isSymbolicLink() || (requiresRootOwnership && directoryMetadata.uid !== 0) || (directoryMetadata.mode & 0o077) !== 0) fail("RECEIVER_RELEASE_DIRECTORY_INVALID");
  const file = path.join(directory, "release.json");
  try { await writeFile(file, `${JSON.stringify(manifest)}\n`, { mode: 0o600, flag: "wx" }); }
  catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const fileMetadata = await lstat(file);
    if (!fileMetadata.isFile() || fileMetadata.isSymbolicLink() || (requiresRootOwnership && fileMetadata.uid !== 0) || (fileMetadata.mode & 0o077) !== 0) fail("RECEIVER_MANIFEST_CONFLICT");
    let existing;
    try { existing = JSON.parse(await readFile(file, "utf8")); } catch { fail("RECEIVER_MANIFEST_CONFLICT"); }
    if (JSON.stringify(existing) !== JSON.stringify(manifest)) fail("RECEIVER_MANIFEST_CONFLICT");
  }
  return file;
}

async function pullImages(manifest, token, docker = dockerProcess) {
  let loggedIn = false;
  try {
    await docker(["login", "ghcr.io", "--username", "github-receiver", "--password-stdin"], { input: `${token}\n` });
    loggedIn = true;
    const pulled = [];
    for (const expected of manifest.images) {
      await docker(["pull", "--platform", "linux/amd64", expected.reference]);
      const inspected = JSON.parse((await docker(["image", "inspect", "--format", "{{json .}}", expected.reference])).stdout);
      validatePulledImage(inspected, expected, manifest.sha);
      pulled.push({ component: expected.component, id: inspected.Id, digest: expected.digest, reference: expected.reference });
    }
    return pulled;
  } finally {
    if (loggedIn) await docker(["logout", "ghcr.io"], { allowFailure: true });
  }
}

async function deployApp(image, previousImage, config, docker = dockerProcess, images = []) {
  const composeArgs = ["compose", "--project-name", config.composeProject, "--env-file", config.runtimeEnvFile, "--file", config.composeFile];
  const run = (command, args, options) => command === "docker" ? docker([...args], options) : fail("RECEIVER_COMMAND_INVALID");
  const telemetry = images.find((item) => item.component === "telemetry");
  return switchApplication({ composeArgs, cwd: config.composeCwd, nextImage: image, previousImage, origin: config.healthOrigin, environment: telemetry ? { SELF_HOST_TELEMETRY_IMAGE: telemetry.id } : {} }, run);
}

export async function receiveRelease({ config = RECEIVER_CONFIG, fetcher = fetch, docker = dockerProcess, readToken = readRootToken, deploy = deployApp, now = () => new Date().toISOString(), operator = process.getuid?.() === 0 } = {}) {
  if (!operator) fail("RECEIVER_OPERATOR_REQUIRED");
  const token = await readToken(config.tokenFile);
  const ref = await fetchApi("/repos/MyKnow/ssartnership/git/ref/heads/dev", token, fetcher);
  const liveSha = ref?.object?.sha;
  if (!SHA.test(liveSha)) fail("RECEIVER_DEV_REF_INVALID");
  const runs = await fetchApi(`/repos/MyKnow/ssartnership/actions/workflows/self-host-preview.yml/runs?branch=dev&event=push&head_sha=${liveSha}&per_page=10`, token, fetcher);
  const run = selectFirstAttemptRun(runs, liveSha);
  if (!run) return { status: "pending", sha: liveSha };
  const jobs = await fetchApi(`/repos/MyKnow/ssartnership/actions/runs/${run.id}/jobs?per_page=100`, token, fetcher);
  verifyRemoteJobs(jobs.jobs, { runId: run.id, sha: liveSha });
  const artifact = validateArtifactMetadata(await fetchApi(`/repos/MyKnow/ssartnership/actions/runs/${run.id}/artifacts?per_page=100`, token, fetcher), run.id);
  const manifest = verifyRemoteRelease(await parseReleaseArtifact(await fetchArtifact(artifact.archive_download_url, token, fetcher), artifact), run, liveSha);
  await saveManifest(config.releaseRoot, liveSha, manifest);
  const previous = await loadState(config.stateFile);
  const app = manifest.images.find((item) => item.component === "app");
  if (!app) fail("RECEIVER_APP_IMAGE_MISSING");
  if (previous?.sha === manifest.sha && previous?.appImage === app.id && previous?.manifestHash === createHash("sha256").update(JSON.stringify(manifest)).digest("hex")) return { status: "unchanged", sha: liveSha, image: app.id };
  const images = await pullImages(manifest, token, docker);
  const appImage = images.find((item) => item.component === "app")?.id;
  if (!appImage) fail("RECEIVER_APP_IMAGE_MISSING");
  await deploy(appImage, previous?.appImage ?? null, config, docker, images);
  const state = { version: 1, repository: REPOSITORY, workflow: WORKFLOW_PATH, sha: manifest.sha, runId: run.id, attempt: 1, platform: manifest.platform, sourceHash: manifest.sourceHash, manifestHash: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"), appImage, images, appliedAt: now() };
  await writeAtomic(config.stateFile, state);
  return { status: "deployed", sha: liveSha, image: appImage };
}

if (isMainModule()) {
  receiveRelease().then((result) => process.stdout.write(`${JSON.stringify(result)}\n`)).catch(() => { process.stderr.write('{"error":"RECEIVER_FAILED"}\n'); process.exitCode = 1; });
}
