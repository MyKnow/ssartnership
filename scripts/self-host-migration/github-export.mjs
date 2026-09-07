#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, realpath, lstat, readFile, appendFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installAge } from "./install-age.mjs";
import { captureDatabase, currentStorageInventory, cloudDatabaseClient } from "./database.mjs";
import { exportStorage, PREVIEW_PROJECT } from "./storage.mjs";
import { sealMigrationFile } from "./transfer.mjs";
import { SUPABASE_POSTGRES_DUMP_IMAGE } from "../supabase-sync-preview-dump-lib.mjs";

export const EXPORT_BRANCH = "feat/self-host-compose-foundation-20260906";
export const EXPORT_WORKFLOW = ".github/workflows/self-host-preview-export.yml";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** @returns {never} */
const fail = code => { throw new Error(`MIGRATION_GITHUB_${code}`); };
/** @param {Record<string, string | undefined>} env */
export function exportContext(env = process.env) {
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_EVENT_NAME !== "push" || env.GITHUB_REPOSITORY !== "MyKnow/ssartnership"
    || env.GITHUB_REF !== `refs/heads/${EXPORT_BRANCH}` || env.GITHUB_WORKFLOW_REF !== `MyKnow/ssartnership/${EXPORT_WORKFLOW}@refs/heads/${EXPORT_BRANCH}`
    || env.GITHUB_RUN_ATTEMPT !== "1" || !/^[a-f0-9]{40}$/u.test(env.GITHUB_SHA)
    || !/^[1-9][0-9]*$/u.test(env.GITHUB_RUN_ID) || !Number.isSafeInteger(Number(env.GITHUB_RUN_ID))) fail("CONTEXT_INVALID");
  return { sourceProject: PREVIEW_PROJECT, sha: env.GITHUB_SHA, runId: Number(env.GITHUB_RUN_ID) };
}
export function validateExportRequest(value, now = Date.now()) {
  if (!value || Object.keys(value).sort().join() !== "expiresAt,sourceProject,version" || value.version !== 1 || value.sourceProject !== PREVIEW_PROJECT
    || !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= now || Date.parse(value.expiresAt) - now > 86_400_000) fail("REQUEST_INVALID");
  return value;
}
export function validatePreviewApi(url, key) {
  if (url !== `https://${PREVIEW_PROJECT}.supabase.co` || typeof key !== "string" || key.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(key)) fail("API_IDENTITY_INVALID");
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
    if (payload.ref !== PREVIEW_PROJECT || payload.role !== "service_role") fail("API_IDENTITY_INVALID");
  } catch { fail("API_IDENTITY_INVALID"); }
  // This is only an early configuration check; the pinned Supabase endpoint
  // must independently authenticate the JWT signature on every actual GET.
}
const run = (command, args, visible = false) => {
  const result = spawnSync(command, args, { cwd: root, env: { PATH: process.env.PATH, HOME: homedir() },
    stdio: visible ? ["ignore", "inherit", "inherit"] : "pipe", encoding: "utf8", timeout: 600_000, maxBuffer: 4 * 1024 ** 2 });
  if (result.error || result.status !== 0) fail("COMMAND_FAILED");
  return result.stdout?.trim();
};
async function json(file) {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 4096 || await realpath(file) !== file) fail("FILE_INVALID");
  return JSON.parse(await readFile(file, "utf8"));
}
async function validateSource(context) {
  if (run("git", ["rev-parse", "HEAD"]) !== context.sha || run("git", ["status", "--porcelain", "--untracked-files=normal"])) fail("CHECKOUT_INVALID");
  validateExportRequest(await json(path.join(root, "deploy/self-host-migration/export-request.json")));
  if (!process.env.GH_TOKEN) fail("TOKEN_MISSING");
  const response = await fetch(`https://api.github.com/repos/MyKnow/ssartnership/git/ref/heads/${EXPORT_BRANCH}`, {
    headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
    redirect: "error", signal: AbortSignal.timeout(20_000),
  });
  if (response.status !== 200) { await response.body?.cancel(); fail("REF_READ_FAILED"); }
  if ((await response.json()).object?.sha !== context.sha) fail("STALE_SOURCE");
}
async function prepare(context) {
  await validateSource(context);
  // Install only into a new versioned task directory under the runner's home,
  // not under a potentially group-writable Actions workspace or global PATH.
  const toolsDirectory = path.join(homedir(), "ssartnership-preview-migration-age");
  await installAge(toolsDirectory);
  if (!process.env.GITHUB_PATH) fail("RUNNER_PATH_MISSING");
  await appendFile(process.env.GITHUB_PATH, `${toolsDirectory}\n`);
  // No Cloud/application secrets are present in this preparation step.
  run("docker", ["pull", SUPABASE_POSTGRES_DUMP_IMAGE], true);
  return { prepared: true, sha: context.sha, age: "1.3.2" };
}
async function capture(context) {
  await validateSource(context);
  validatePreviewApi(process.env.SUPABASE_PREVIEW_URL, process.env.SUPABASE_PREVIEW_SERVICE_ROLE_KEY);
  const planFor = cloudDatabaseClient(process.env.SUPABASE_PREVIEW_DB_URL);
  const publicKey = await json(path.join(root, "deploy/self-host-migration/preview-recipient.json"));
  if (publicKey.version !== 1 || publicKey.sourceProject !== PREVIEW_PROJECT) fail("RECIPIENT_INVALID");
  const temporary = path.join(root, ".tmp");
  await mkdir(temporary, { recursive: true, mode: 0o700 });
  const parent = await lstat(temporary);
  if (await realpath(temporary) !== temporary || parent.uid !== process.getuid() || (parent.mode & 0o077) !== 0) fail("PRIVATE_WORKSPACE_REQUIRED");
  const directory = path.join(temporary, "preview-cloud-export"); await mkdir(directory, { mode: 0o700 });
  const payload = path.join(directory, "payload"); await mkdir(payload, { mode: 0o700 });
  console.log('{"stage":"database-capture"}');
  const database = await captureDatabase(path.join(payload, "database"), planFor);
  console.log('{"stage":"storage-capture"}');
  let reads = 0;
  const storage = await exportStorage({ directory: path.join(payload, "storage"), serviceKey: process.env.SUPABASE_PREVIEW_SERVICE_ROLE_KEY,
    readInventory: () => ++reads === 1 ? Promise.resolve(database.storageInventory) : currentStorageInventory(planFor) });
  console.log('{"stage":"encrypt-complete-snapshot"}');
  const archive = path.join(directory, "snapshot.tar");
  run("tar", ["--create", "--format=ustar", "--file", archive, "--directory", payload, "database", "storage"]);
  const receipt = await sealMigrationFile({ source: archive, directory: path.join(directory, "encrypted"), recipient: publicKey.recipient, context });
  // Do not publish even a fully encrypted result for a stale/expired request.
  await validateSource(context);
  return { captured: true, ...context, databaseBytes: database.receipt.bytes, storage, ciphertextBytes: receipt.bytes, restoreApproved: false };
}
async function main() {
  if (process.platform !== "linux" || process.arch !== "x64" || process.getuid() === 0 || process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT || process.env.DOCKER_TLS_VERIFY) fail("HOSTED_LINUX_REQUIRED");
  process.umask(0o077);
  const context = exportContext();
  if (process.argv.length !== 3) fail("ARGUMENTS_INVALID");
  if (process.argv[2] === "prepare") return prepare(context);
  if (process.argv[2] === "capture") return capture(context);
  fail("ARGUMENTS_INVALID");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(result => console.log(JSON.stringify(result))).catch(error => {
    const message = String(error.message);
    console.error(JSON.stringify({ failed: true, code: /^MIGRATION_[A-Z_]+$/u.test(message) ? message : "MIGRATION_GITHUB_EXPORT_FAILED" }));
    process.exitCode = 1;
  });
}
