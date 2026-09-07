import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, chmod, readdir, realpath } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { sealMigrationFile, openMigrationFile } from "../../scripts/self-host-migration/transfer.mjs";
import { sha256File } from "../../scripts/self-host-ci/lib.mjs";

// Synthetic-only integration command: needs the standard age/age-keygen tools.
// No cloud or application environment is read; no real database is copied.
process.umask(0o077);
const directory = path.resolve(process.argv[2]);
assert.equal(await realpath(path.dirname(directory)), path.dirname(directory));
await mkdir(directory, { mode: 0o700 });
const run = (args) => {
  const result = spawnSync("age-keygen", args, { env: { PATH: process.env.PATH }, encoding: "utf8" });
  assert.equal(result.status, 0, "age-keygen failed");
  return result.stdout.trim();
};
const identity = path.join(directory, "synthetic-key.txt");
run(["-o", identity]); await chmod(identity, 0o600);
const recipient = run(["-y", identity]);
const other = path.join(directory, "other-synthetic-key.txt");
run(["-o", other]); await chmod(other, 0o600);
const source = path.join(directory, "synthetic-source.tar");
await writeFile(source, randomBytes(2 * 1024 ** 2), { mode: 0o600, flag: "wx" });
const encrypted = path.join(directory, "encrypted");
const context = { sourceProject: "uuxzzanpxzvhauzxufuk", sha: "a".repeat(40), runId: 1 };
const receipt = await sealMigrationFile({ source, directory: encrypted, recipient, context });
const restored = await openMigrationFile({ directory: encrypted, destination: path.join(directory, "restored"), identity, context });
assert.equal(await sha256File(restored.file), await sha256File(source));
await assert.rejects(openMigrationFile({ directory: encrypted, destination: path.join(directory, "wrong-key"), identity: other, context }));
assert.deepEqual(await readdir(path.join(directory, "wrong-key")), []);
const cipher = path.join(encrypted, "snapshot.tar.age");
const bytes = await readFile(cipher); bytes[bytes.length - 1] ^= 1;
await writeFile(cipher, bytes);
// Recompute the outer transport hash deliberately, so this must be rejected
// by age authentication after multiple chunks, not only by SHA256 comparison.
await writeFile(path.join(encrypted, "receipt.json"), JSON.stringify({ ...receipt, sha256: await sha256File(cipher) }));
await assert.rejects(openMigrationFile({ directory: encrypted, destination: path.join(directory, "tampered"), identity, context }));
assert.deepEqual(await readdir(path.join(directory, "tampered")), []);
const proof = { synthetic: true, bytes: receipt.plaintextBytes, encryptedBytes: receipt.bytes, roundTrip: true, wrongKeyRejected: true, lateTamperRejected: true, partialPlaintextPublished: false };
await writeFile(path.join(directory, "proof.json"), JSON.stringify(proof), { mode: 0o600, flag: "wx" });
console.log(JSON.stringify(proof));
