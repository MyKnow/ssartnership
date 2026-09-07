import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, stat, readdir, chmod, symlink, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { sealMigrationFile, openMigrationFile, validateTransferReceipt } from "../scripts/self-host-migration/transfer.mjs";

const recipient = "age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p";
const context = { sourceProject: "uuxzzanpxzvhauzxufuk", sha: "a".repeat(40), runId: 123 };
async function fixture(t: TestContext) {
  await mkdir(".tmp", { recursive: true });
  const root = await realpath(await mkdtemp(path.resolve(".tmp/migration-transfer-test-")));
  await chmod(root, 0o700);
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, "source.tar");
  await writeFile(source, "synthetic archive", { mode: 0o600 });
  const identity = path.join(root, "identity.txt");
  await writeFile(identity, "synthetic test key", { mode: 0o600 });
  return { root, source, identity, encrypted: path.join(root, "encrypted"), restored: path.join(root, "restored") };
}
// Doubles cover orchestration only. Real age authentication/streaming is
// exercised by the separate synthetic fixture, not inferred from these bytes.
const fakeEncrypt = async (_args: string[], output: string) => { await writeFile(output, Buffer.alloc(256, 7), { mode: 0o600, flag: "wx" }); };
test("migration transport binds Preview/SHA/run and commits only complete private files", async t => {
  const f = await fixture(t);
  const receipt = await sealMigrationFile({ source: f.source, directory: f.encrypted, recipient, context }, fakeEncrypt);
  validateTransferReceipt(receipt, context);
  assert.equal((await stat(path.join(f.encrypted, "snapshot.tar.age"))).mode & 0o777, 0o600);
  assert.equal((await stat(f.encrypted)).mode & 0o777, 0o700);
  const calls: string[][] = [];
  const result = await openMigrationFile({ directory: f.encrypted, destination: f.restored, identity: f.identity, context }, async (args: string[], output: string) => {
    calls.push(args); await writeFile(output, "synthetic archive", { mode: 0o600, flag: "wx" });
  });
  assert.deepEqual(calls[0], ["--decrypt", "--identity", f.identity, path.join(f.encrypted, "snapshot.tar.age")]);
  assert.equal(await readFile(result.file, "utf8"), "synthetic archive");
  assert.deepEqual(await readdir(f.restored), ["snapshot.tar"]);
  assert.throws(() => validateTransferReceipt(receipt, { ...context, sha: "b".repeat(40) }));
  assert.throws(() => validateTransferReceipt({ ...receipt, sourceProject: "jlcrhzmiuygqnkwmzfyr" }, context));
});
test("migration transport rejects corrupt input before decryption and preserves existing targets", async t => {
  const f = await fixture(t);
  await sealMigrationFile({ source: f.source, directory: f.encrypted, recipient, context }, fakeEncrypt);
  await writeFile(path.join(f.encrypted, "snapshot.tar.age"), Buffer.alloc(256, 8));
  let calls = 0;
  await assert.rejects(openMigrationFile({ directory: f.encrypted, destination: f.restored, identity: f.identity, context }, async () => { calls++; }));
  assert.equal(calls, 0);
  assert.deepEqual(await readdir(f.encrypted), ["receipt.json", "snapshot.tar.age"]);
  await assert.rejects(sealMigrationFile({ source: f.source, directory: f.encrypted, recipient, context }, fakeEncrypt));
  assert.deepEqual(await readFile(path.join(f.encrypted, "snapshot.tar.age")), Buffer.alloc(256, 8));
});
test("age authentication failure never exposes partial plaintext as a restore input", async t => {
  const f = await fixture(t);
  await sealMigrationFile({ source: f.source, directory: f.encrypted, recipient, context }, fakeEncrypt);
  await assert.rejects(openMigrationFile({ directory: f.encrypted, destination: f.restored, identity: f.identity, context }, async (_args: string[], output: string) => {
    await writeFile(output, "partial unauthenticated output", { mode: 0o600, flag: "wx" }); throw new Error("synthetic failure");
  }), /MIGRATION_DECRYPT_FAILED/);
  assert.deepEqual(await readdir(f.restored), []);
});
test("migration file permissions, symlinks, destination reuse and recipient plugins fail closed", async t => {
  const f = await fixture(t);
  await assert.rejects(sealMigrationFile({ source: f.source, directory: f.encrypted, recipient: "age1plugin1unsafe", context }, fakeEncrypt));
  await chmod(f.source, 0o644);
  await assert.rejects(sealMigrationFile({ source: f.source, directory: f.encrypted, recipient, context }, fakeEncrypt));
  await chmod(f.source, 0o600);
  const link = path.join(f.root, "link.tar"); await symlink(f.source, link);
  await assert.rejects(sealMigrationFile({ source: link, directory: f.encrypted, recipient, context }, fakeEncrypt));
  await assert.rejects(sealMigrationFile({ source: f.source, directory: f.encrypted, recipient, context: { ...context, runId: 0 } }, fakeEncrypt));
});
