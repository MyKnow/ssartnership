import path from "node:path";
import { createHash } from "node:crypto";
import { mkdir, realpath, lstat, open, link, unlink, writeFile } from "node:fs/promises";
import { sha256File } from "../self-host-ci/lib.mjs";

export const PREVIEW_PROJECT = "uuxzzanpxzvhauzxufuk";
export const PRODUCTION_PROJECT = "jlcrhzmiuygqnkwmzfyr";
export function migrationSource(project = PREVIEW_PROJECT) {
  if (![PREVIEW_PROJECT, PRODUCTION_PROJECT].includes(project)) throw new Error("MIGRATION_SOURCE_INVALID");
  return project;
}
const MAX_OBJECT_BYTES = 50 * 1024 ** 2;
const MAX_TOTAL_BYTES = 1024 ** 3;
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
/** @returns {never} */
const fail = code => { throw new Error(`MIGRATION_STORAGE_${code}`); };

// Run inside the database export snapshot initially, then in fresh read-only
// transactions twice. No API pagination, bucket filter or sanitizer is used.
// This is private snapshot content, never safe terminal/log output.
export const STORAGE_INVENTORY_SQL = `SELECT jsonb_build_object(
 'buckets', (SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.id), '[]') FROM storage.buckets b),
 'objects', (SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.id), '[]') FROM storage.objects o)
);`;

const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
function safeSegment(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 1024
    && value !== "." && value !== ".." && !/[\\/\u0000-\u001f\u007f]/u.test(value) && value.isWellFormed();
}
function safeObjectPath(value) {
  return typeof value === "string" && Buffer.byteLength(value) <= 4096 && value.split("/").every(safeSegment);
}
export function storageDownloadUrl(object, sourceProject = PREVIEW_PROJECT) {
  const origin = `https://${migrationSource(sourceProject)}.supabase.co`;
  if (!safeSegment(object.bucket_id) || !safeObjectPath(object.name)) fail("PATH_INVALID");
  // Encode each segment exactly once; never interpret a source name as a URL
  // or as a filesystem path. Dot segments are rejected before URL parsing.
  return `${origin}/storage/v1/object/authenticated/${encodeURIComponent(object.bucket_id)}/${object.name.split("/").map(encodeURIComponent).join("/")}`;
}
export function validateStorageInventory(input) {
  if (!record(input) || Object.keys(input).sort().join() !== "buckets,objects"
    || !Array.isArray(input.buckets) || !Array.isArray(input.objects)
    || input.buckets.length > 1000 || input.objects.length > 20000) fail("INVENTORY_INVALID");
  // Snapshot the caller's result so later database reads cannot mutate it.
  const serialized = JSON.stringify(input);
  if (Buffer.byteLength(serialized) > 64 * 1024 ** 2) fail("INVENTORY_TOO_LARGE");
  const value = JSON.parse(serialized);
  const buckets = new Set(), ids = new Set(), names = new Set();
  for (const bucket of value.buckets) {
    if (!record(bucket) || !safeSegment(bucket.id) || typeof bucket.name !== "string"
      || typeof bucket.public !== "boolean" || buckets.has(bucket.id)) fail("BUCKET_INVALID");
    buckets.add(bucket.id);
  }
  let bytes = 0;
  for (const object of value.objects) {
    if (!record(object) || !UUID.test(object.id) || ids.has(object.id) || !buckets.has(object.bucket_id)
      || !safeSegment(object.version) || !safeObjectPath(object.name) || !record(object.metadata)
      || !Number.isSafeInteger(object.metadata.size) || object.metadata.size < 0
      || object.metadata.size > MAX_OBJECT_BYTES) fail("OBJECT_INVALID");
    const name = JSON.stringify([object.bucket_id, object.name]);
    if (names.has(name)) fail("OBJECT_DUPLICATE");
    names.add(name); ids.add(object.id); bytes += object.metadata.size;
    if (bytes > MAX_TOTAL_BYTES) fail("SIZE_LIMIT");
  }
  value.buckets.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  value.objects.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return value;
}
const canonical = value => Array.isArray(value) ? value.map(canonical) : record(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
function inventoryFingerprint(value) {
  // GET may update this observation timestamp. Preserve the original in the
  // encrypted ledger but exclude only this field from source-change detection.
  const objects = value.objects.map(object => Object.fromEntries(Object.entries(object).filter(([key]) => key !== "last_accessed_at")));
  return createHash("sha256").update(JSON.stringify(canonical({ ...value, objects }))).digest("hex");
}
async function privateDirectory(directory) {
  if (!path.isAbsolute(directory) || path.resolve(directory) !== directory
    || await realpath(path.dirname(directory)) !== path.dirname(directory)) fail("DIRECTORY_INVALID");
  const parent = await lstat(path.dirname(directory));
  if (!parent.isDirectory() || parent.uid !== process.getuid() || (parent.mode & 0o077) !== 0) fail("DIRECTORY_INVALID");
  await mkdir(directory, { mode: 0o700 }); // exclusive: never reuse a partial job
}
async function download(object, key, output, request, signal, sourceProject) {
  let file, created = false;
  try {
    const response = await request(storageDownloadUrl(object, sourceProject), {
      method: "GET", headers: { apikey: key, authorization: `Bearer ${key}`, "accept-encoding": "identity", "cache-control": "no-cache" },
      redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
    });
    // 206 would be an incomplete range, not a successful full object export.
    if (response.status !== 200 || !response.body) { await response.body?.cancel(); fail("HTTP_FAILED"); }
    if (output) { file = await open(output, "wx", 0o600); created = true; }
    const hash = createHash("sha256"); let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > object.metadata.size) fail("BODY_SIZE_MISMATCH");
      hash.update(chunk); if (file) await file.writeFile(chunk);
    }
    if (bytes !== object.metadata.size) fail("BODY_SIZE_MISMATCH");
    if (file) await file.sync();
    return { bytes, sha256: hash.digest("hex") };
  } catch {
    // Underlying fetch/fs errors may contain object paths or provider data.
    if (file) { await file.close(); file = undefined; }
    if (created) await unlink(output);
    fail("DOWNLOAD_FAILED");
  } finally { if (file) await file.close(); }
}

// This module does not read cloud credentials from local dotenv or accept a
// target URL. GET requests use only the explicitly selected, pinned Cloud project.
// Plaintext is allowed only in an approved private export workspace (ephemeral
// Actions runner/server); on an unencrypted Mac use synthetic fixtures only.
// Two reads detect observed races, not an atomic DB+Storage snapshot: final
// source write-quiesce/reconciliation remains mandatory before traffic cutover.
/**
 * @param {{directory: string, serviceKey: string, sourceProject?: string, readInventory: () => Promise<unknown>, concurrency?: number, timeoutMs?: number, onProgress?: (value: {phase: string, completed: number, total: number}) => void}} options
 * @param {(url: string, options: RequestInit) => Promise<Response>} request
 */
export async function exportStorage(options, request = fetch) {
  const { directory, serviceKey, readInventory, sourceProject = PREVIEW_PROJECT, concurrency = 1, timeoutMs = 20 * 60_000, onProgress = () => {} } = options;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4
    || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20 * 60_000) fail("LIMITS_INVALID");
  migrationSource(sourceProject);
  const deadline = AbortSignal.timeout(timeoutMs), cancellation = new AbortController();
  const signal = AbortSignal.any([deadline, cancellation.signal]);
  const read = async () => {
    try {
      signal.throwIfAborted(); const value = await readInventory(); signal.throwIfAborted();
      return validateStorageInventory(value);
    }
    catch { fail("INVENTORY_FAILED"); }
  };
  try {
    if (typeof serviceKey !== "string" || !serviceKey || /\s/u.test(serviceKey)) fail("KEY_INVALID");
    const inventory = await read(), fingerprint = inventoryFingerprint(inventory);
    await privateDirectory(directory);
    const startedAt = new Date().toISOString(), files = [];
    // Keep the two verification passes separated by a fresh inventory read.
    // Workers share a bounded cursor, but each file and ledger slot is unique.
    const pass = async (phase, processObject) => {
      let next = 0, completed = 0, failure;
      await Promise.all(Array.from({ length: Math.min(concurrency, inventory.objects.length) }, async () => {
        while (!failure && next < inventory.objects.length) {
          const index = next++;
          try {
            signal.throwIfAborted();
            await processObject(inventory.objects[index], index);
            completed++;
            if (completed % 100 === 0 || completed === inventory.objects.length) onProgress({ phase, completed, total: inventory.objects.length });
          } catch (error) { failure ??= error; cancellation.abort(); }
        }
      }));
      // Settle every in-flight request before returning a failure. No retry,
      // next pass, inventory read or success ledger may race failed workers.
      if (failure) throw failure;
      signal.throwIfAborted();
    };
    await pass("download", async (object, index) => {
      signal.throwIfAborted();
      const name = `${String(index).padStart(6, "0")}.bin`;
      const partial = path.join(directory, `${name}.partial`);
      const result = await download(object, serviceKey, partial, request, signal, sourceProject);
      await link(partial, path.join(directory, name)); await unlink(partial);
      files[index] = { id: object.id, file: name, ...result };
    });
    if (inventoryFingerprint(await read()) !== fingerprint) fail("INVENTORY_CHANGED");
    await pass("verify", async (object, index) => {
      signal.throwIfAborted();
      const result = await download(object, serviceKey, null, request, signal, sourceProject);
      if (result.sha256 !== files[index].sha256 || await sha256File(path.join(directory, files[index].file)) !== result.sha256) fail("CONTENT_CHANGED");
    });
    if (inventoryFingerprint(await read()) !== fingerprint) fail("INVENTORY_CHANGED");
    const summary = { buckets: inventory.buckets.length, objects: files.length, bytes: files.reduce((total, item) => total + item.bytes, 0), verifiedPasses: 2, inventoryReads: 3 };
    await writeFile(path.join(directory, "ledger.json"), JSON.stringify({ version: 1, sourceProject, startedAt, completedAt: new Date().toISOString(), inventory, files, summary }), { mode: 0o600, flag: "wx" });
    return summary; // Only aggregate counts are safe for public diagnostics.
  } catch (error) {
    if (deadline.aborted) fail("TIMEOUT");
    const code = String(error.message);
    if (/^MIGRATION_STORAGE_[A-Z_]+$/u.test(code)) throw new Error(code);
    fail("EXPORT_FAILED");
  }
}
