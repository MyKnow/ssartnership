import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import path from "node:path";

const SHA = /^[a-f0-9]{40}$/u;
const FIELDS = ["version", "repository", "environment", "project", "migrationTree", "verifiedSourceSha", "migrationCount", "verifiedAt"];
const fail = (code) => { throw new Error(code); };

export function validateSchemaApproval(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join() !== [...FIELDS].sort().join()
    || value.version !== 1 || value.repository !== "MyKnow/ssartnership"
    || value.environment !== "original-preview" || value.project !== "ssartnership-original-preview-34141078185"
    || !SHA.test(value.migrationTree) || !SHA.test(value.verifiedSourceSha)
    || !Number.isSafeInteger(value.migrationCount) || value.migrationCount < 1
    || typeof value.verifiedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/u.test(value.verifiedAt)
    || !Number.isFinite(Date.parse(value.verifiedAt))) fail("RECEIVER_SCHEMA_APPROVAL_INVALID");
  return Object.freeze({ ...value });
}

export function validateSchemaFileMetadata(metadata) {
  if (!metadata?.isFile() || metadata.uid !== 0 || (metadata.mode & 0o077) !== 0
    || metadata.nlink !== 1 || metadata.size < 1 || metadata.size > 4096) fail("RECEIVER_SCHEMA_APPROVAL_FILE_INVALID");
}

export async function readRootSchemaApproval(file) {
  let handle;
  try {
    if (typeof file !== "string" || !path.isAbsolute(file) || file.includes("\0") || await realpath(file) !== file) fail("RECEIVER_SCHEMA_APPROVAL_FILE_INVALID");
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    validateSchemaFileMetadata(await handle.stat());
    return validateSchemaApproval(JSON.parse(await handle.readFile("utf8")));
  } catch {
    fail("RECEIVER_SCHEMA_APPROVAL_FILE_INVALID");
  } finally { await handle?.close(); }
}

export function selectSchemaTree(payload, requestedSha, name) {
  if (!SHA.test(requestedSha) || !["supabase", "migrations"].includes(name)
    || !payload || payload.sha !== requestedSha || payload.truncated !== false || !Array.isArray(payload.tree)) fail("RECEIVER_SCHEMA_TREE_INVALID");
  const matches = payload.tree.filter((entry) => entry?.path === name);
  if (matches.length !== 1 || matches[0].type !== "tree" || matches[0].mode !== "040000" || !SHA.test(matches[0].sha)) fail("RECEIVER_SCHEMA_TREE_INVALID");
  return matches[0].sha;
}
