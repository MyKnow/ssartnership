import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readRootSchemaApproval, validateSchemaApproval, validateSchemaFileMetadata, selectSchemaTree } from "../scripts/self-host-ci/schema-approval.mjs";

const sha = "a".repeat(40);
const approval = {
  version: 1, repository: "MyKnow/ssartnership", environment: "original-preview",
  project: "ssartnership-original-preview-34141078185", migrationTree: sha,
  verifiedSourceSha: "b".repeat(40), migrationCount: 199, verifiedAt: "2026-09-08T10:36:49.336Z",
};

test("schema approval is exact and limited to the restored original Preview", () => {
  assert.deepEqual(validateSchemaApproval(approval), approval);
  for (const patch of [
    { version: 2 }, { repository: "other/repository" }, { environment: "production" },
    { project: "ssartnership-production" }, { migrationTree: "dev" }, { verifiedSourceSha: "main" },
    { migrationCount: 0 }, { migrationCount: 1.5 }, { verifiedAt: "invalid" }, { extra: true },
  ]) assert.throws(() => validateSchemaApproval({ ...approval, ...patch }), /RECEIVER_SCHEMA_APPROVAL_INVALID/);
  assert.throws(() => validateSchemaApproval(null), /RECEIVER_SCHEMA_APPROVAL_INVALID/);
});

test("schema approval metadata requires a bounded root-only regular file", () => {
  const valid = { isFile: () => true, uid: 0, mode: 0o100600, size: 500, nlink: 1 };
  assert.doesNotThrow(() => validateSchemaFileMetadata(valid));
  for (const patch of [{ isFile: () => false }, { uid: 1000 }, { mode: 0o100644 }, { size: 0 }, { size: 4097 }, { nlink: 2 }]) {
    assert.throws(() => validateSchemaFileMetadata({ ...valid, ...patch }), /RECEIVER_SCHEMA_APPROVAL_FILE_INVALID/);
  }
});

test("schema tree rejects incomplete, ambiguous and non-directory responses", () => {
  const entry = { path: "supabase", mode: "040000", type: "tree", sha: "c".repeat(40) };
  const tree = { sha, truncated: false, tree: [entry] };
  assert.equal(selectSchemaTree(tree, sha, "supabase"), entry.sha);
  assert.throws(() => selectSchemaTree(tree, sha, "../supabase"), /RECEIVER_SCHEMA_TREE_INVALID/);
  for (const patch of [
    { sha: "d".repeat(40) }, { truncated: true }, { truncated: undefined }, { tree: [] },
    { tree: [entry, entry] }, { tree: [{ ...entry, type: "blob" }] },
    { tree: [{ ...entry, mode: "120000" }] }, { tree: [{ ...entry, sha: "dev" }] },
  ]) assert.throws(() => selectSchemaTree({ ...tree, ...patch }, sha, "supabase"), /RECEIVER_SCHEMA_TREE_INVALID/);
});

test("schema approval reader rejects missing and symlinked operator files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ssartnership-schema-approval-"));
  try {
    await assert.rejects(() => readRootSchemaApproval(path.join(root, "missing")), /RECEIVER_SCHEMA_APPROVAL_FILE_INVALID/);
    const target = path.join(root, "approval.json");
    await writeFile(target, JSON.stringify(approval), { mode: 0o600 });
    await symlink(target, path.join(root, "linked.json"));
    await assert.rejects(() => readRootSchemaApproval(path.join(root, "linked.json")), /RECEIVER_SCHEMA_APPROVAL_FILE_INVALID/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
