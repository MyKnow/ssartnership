import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { lstat, realpath, mkdir, writeFile, readFile, link, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import path from "node:path";
import { sha256File } from "../self-host-ci/lib.mjs";

import { PREVIEW_PROJECT, PRODUCTION_PROJECT } from "./storage.mjs";

const MAX_BYTES = 2 * 1024 ** 3;
const RECIPIENT = /^age1[023456789acdefghjklmnpqrstuvwxyz]{58}$/u;
/** @returns {never} */
const fail = code => { throw new Error(code); };
function validateContext(value) {
  if (!value || Object.keys(value).sort().join() !== "runId,sha,sourceProject" || ![PREVIEW_PROJECT, PRODUCTION_PROJECT].includes(value.sourceProject)
    || !/^[a-f0-9]{40}$/u.test(value.sha) || !Number.isSafeInteger(value.runId) || value.runId < 1) fail("MIGRATION_CONTEXT_INVALID");
}
export function validateTransferReceipt(value, context) {
  validateContext(context);
  if (!value || Object.keys(value).sort().join() !== ["version", "sourceProject", "sha", "runId", "recipient", "bytes", "plaintextBytes", "sha256", "file"].sort().join()
    || value.version !== 1 || value.sourceProject !== context.sourceProject || value.sha !== context.sha || value.runId !== context.runId
    || !RECIPIENT.test(value.recipient) || value.file !== "snapshot.tar.age" || !/^[a-f0-9]{64}$/u.test(value.sha256)
    || !Number.isSafeInteger(value.bytes) || value.bytes < 100 || value.bytes > MAX_BYTES
    || !Number.isSafeInteger(value.plaintextBytes) || value.plaintextBytes < 1 || value.plaintextBytes > MAX_BYTES) fail("MIGRATION_RECEIPT_INVALID");
  return value;
}
async function privatePath(file, directory = false) {
  if (!path.isAbsolute(file) || path.resolve(file) !== file || await realpath(file) !== file) fail("MIGRATION_PATH_INVALID");
  const info = await lstat(file);
  if (info.uid !== process.getuid() || (info.mode & 0o077) !== 0 || info.isSymbolicLink()
    || (directory ? !info.isDirectory() : (!info.isFile() || info.nlink !== 1 || info.size > MAX_BYTES))) fail("MIGRATION_PRIVATE_INPUT_REQUIRED");
  if (!directory) await privatePath(path.dirname(file), true);
  return info;
}
async function newDirectory(directory) {
  if (!path.isAbsolute(directory) || path.resolve(directory) !== directory) fail("MIGRATION_PATH_INVALID");
  await privatePath(path.dirname(directory), true);
  await mkdir(directory, { mode: 0o700 });
}
// age handles cryptography. The operator controls PATH; only classic native
// recipients are accepted, so this command cannot select an external plugin.
// stdout always goes to an exclusive private file, never a terminal or log.
async function runAge(args, output) {
  const child = spawn("age", args, { env: { PATH: process.env.PATH }, stdio: ["ignore", "pipe", "pipe"] });
  let bytes = 0, timedOut = false, killer;
  const stop = () => { child.kill("SIGTERM"); killer ??= setTimeout(() => child.kill("SIGKILL"), 5000); };
  const timer = setTimeout(() => { timedOut = true; stop(); }, 600_000);
  child.stderr.resume(); // Tool errors can contain paths; emit only a fixed code.
  const exit = new Promise((resolve, reject) => {
    child.once("error", () => reject(new Error("MIGRATION_AGE_UNAVAILABLE")));
    child.once("close", code => code === 0 && !timedOut ? resolve() : reject(new Error("MIGRATION_AGE_FAILED")));
  });
  const limiter = new Transform({ transform(chunk, _encoding, done) {
    bytes += chunk.length;
    done(bytes > MAX_BYTES ? new Error("MIGRATION_SIZE_LIMIT") : null, chunk);
  } });
  const copy = pipeline(child.stdout, limiter, createWriteStream(output, { flags: "wx", mode: 0o600 }));
  try {
    await Promise.all([exit, copy]);
  } catch {
    stop(); child.stdout.destroy(); await Promise.allSettled([exit, copy]); fail("MIGRATION_AGE_FAILED");
  } finally { clearTimeout(timer); clearTimeout(killer); }
}
// Public encryption is not sender authentication. Callers must independently
// approve the GitHub run/SHA/artifact digest before trusting this receipt.
export async function sealMigrationFile({ source, directory, recipient, context }, transform = runAge) {
  validateContext(context);
  if (!RECIPIENT.test(recipient)) fail("MIGRATION_RECIPIENT_INVALID");
  const input = await privatePath(source);
  if (input.size < 1) fail("MIGRATION_SOURCE_EMPTY");
  await newDirectory(directory);
  const partial = path.join(directory, "snapshot.tar.age.partial");
  const file = path.join(directory, "snapshot.tar.age");
  // A failed encryption may leave only ciphertext diagnostics. No receipt is
  // issued, and a new attempt must use a fresh directory.
  await transform(["--encrypt", "--recipient", recipient, source], partial);
  const current = await privatePath(source);
  if (current.size !== input.size || current.mtimeMs !== input.mtimeMs || current.ino !== input.ino) fail("MIGRATION_SOURCE_CHANGED");
  const info = await privatePath(partial);
  const receipt = validateTransferReceipt({ version: 1, ...context, recipient, bytes: info.size, plaintextBytes: input.size, sha256: await sha256File(partial), file: "snapshot.tar.age" }, context);
  await link(partial, file); await unlink(partial); // no overwrite on publication
  await writeFile(path.join(directory, "receipt.json"), JSON.stringify(receipt), { mode: 0o600, flag: "wx" });
  return receipt;
}
export async function openMigrationFile({ directory, destination, identity, context }, transform = runAge) {
  await privatePath(directory, true); await privatePath(identity);
  const receiptFile = path.join(directory, "receipt.json");
  if ((await privatePath(receiptFile)).size > 4096) fail("MIGRATION_RECEIPT_TOO_LARGE");
  const receipt = validateTransferReceipt(JSON.parse(await readFile(receiptFile, "utf8")), context);
  const input = path.join(directory, "snapshot.tar.age");
  if ((await privatePath(input)).size !== receipt.bytes || await sha256File(input) !== receipt.sha256) fail("MIGRATION_CIPHERTEXT_CHANGED");
  await newDirectory(destination);
  const partial = path.join(destination, "snapshot.tar.partial");
  const file = path.join(destination, "snapshot.tar");
  try {
    await transform(["--decrypt", "--identity", identity, input], partial);
    if ((await privatePath(partial)).size !== receipt.plaintextBytes) fail("MIGRATION_PLAINTEXT_SIZE_MISMATCH");
    await link(partial, file); await unlink(partial);
    return { decrypted: true, file, bytes: receipt.plaintextBytes };
  } catch {
    // Only our fresh destination's fixed partial name is removed. No original
    // encrypted artifact, key, source data or pre-existing directory is erased.
    await unlink(partial).catch(error => { if (error.code !== "ENOENT") fail("MIGRATION_PARTIAL_CLEANUP_FAILED"); });
    fail("MIGRATION_DECRYPT_FAILED");
  }
}
