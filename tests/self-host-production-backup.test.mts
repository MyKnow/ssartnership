import assert from "node:assert/strict";
import test from "node:test";
import { parseBackupCommand, validateBackupReceipt, selectBackupRetention, backupApplicationIdentity } from "../scripts/self-host-operations/production-backup-contract.mjs";
import { assertRestoreDatabaseIdentity } from "../scripts/self-host-operations/restore-production-backup.mjs";

const id = "12345678-1234-4234-8234-123456789abc";
const receipt = { version: 1, id, createdAt: "2026-09-09T14:00:00.000Z", bytes: 2048, sha256: "a".repeat(64), recipient: `age1${"q".repeat(58)}`, databaseSystemId: "7683514695522750473", continuousPitr: false };

test("restore identity follows the verified receipt across database replacement and rejects mismatch", () => {
  for (const value of [receipt.databaseSystemId, "7683614695522750474"]) assert.doesNotThrow(() => assertRestoreDatabaseIdentity(value, value));
  for (const value of [undefined, null, 123, "", "0", "-1", "01", "1e10", "1\n", "1".repeat(21)]) assert.throws(() => assertRestoreDatabaseIdentity(value, value));
  assert.throws(() => assertRestoreDatabaseIdentity(receipt.databaseSystemId, "7683614695522750474"));
});

test("backup app identity binds a running container to its image and source revision", () => {
  const imageId = `sha256:${"a".repeat(64)}`;
  const container = { State: { Running: true }, Image: imageId };
  const image = { Id: imageId, Config: { Labels: { "org.opencontainers.image.revision": "b".repeat(40) } } };
  assert.deepEqual(backupApplicationIdentity(container, image), { sourceSha: "b".repeat(40), image: imageId });
  assert.throws(() => backupApplicationIdentity({ ...container, State: { Running: false } }, image));
  assert.throws(() => backupApplicationIdentity(container, { ...image, Id: `sha256:${"c".repeat(64)}` }));
  assert.throws(() => backupApplicationIdentity(container, { ...image, Config: { Labels: {} } }));
});

test("backup-only SSH accepts just fixed list, get and exact hash acknowledgement", () => {
  assert.deepEqual(parseBackupCommand("list"), { command: "list" });
  assert.deepEqual(parseBackupCommand(`get ${id}`), { command: "get", id });
  assert.deepEqual(parseBackupCommand(`ack ${id} ${receipt.sha256}`), { command: "ack", id, sha256: receipt.sha256 });
  for (const command of ["", "sh", "list;id", "list\n", "list extra", "get ../../etc/shadow", `get ${id}/secret`, `get ${id}\n`, `ack ${id} a`, `ack ${id} ${receipt.sha256} extra`]) {
    assert.throws(() => parseBackupCommand(command));
  }
});

test("backup receipt refuses arbitrary filenames, invalid metadata and oversized ciphertext", () => {
  assert.deepEqual(validateBackupReceipt(receipt), receipt);
  for (const bad of [{ ...receipt, file: "/etc/shadow" }, { ...receipt, id: "../other" }, { ...receipt, bytes: 0 }, { ...receipt, bytes: 21 * 1024 ** 3 }, { ...receipt, createdAt: "yesterday" }, { ...receipt, continuousPitr: true }, { ...receipt, sha256: "x".repeat(64) }]) {
    assert.throws(() => validateBackupReceipt(bad));
  }
});

test("retention selects only older validated successes and keeps newest recovery points", () => {
  const records = Array.from({ length: 9 }, (_, n) => ({ ...receipt, id: `12345678-1234-4234-8234-${String(n).padStart(12, "0")}`, createdAt: new Date(Date.UTC(2026, 8, n + 1)).toISOString() }));
  assert.deepEqual(selectBackupRetention(records.toReversed(), 7), records.slice(0, 2).map(x => x.id));
  assert.deepEqual(selectBackupRetention(records, 30), []);
  assert.throws(() => selectBackupRetention(records, 0));
  assert.throws(() => selectBackupRetention([...records, records[0]], 7));
});
