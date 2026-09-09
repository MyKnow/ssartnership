import assert from "node:assert/strict";
import test from "node:test";
import { parseBackupCommand, validateBackupReceipt, selectBackupRetention } from "../scripts/self-host-operations/production-backup-contract.mjs";

const id = "12345678-1234-4234-8234-123456789abc";
const receipt = { version: 1, id, createdAt: "2026-09-09T14:00:00.000Z", bytes: 2048, sha256: "a".repeat(64), recipient: `age1${"q".repeat(58)}`, databaseSystemId: "7683514695522750473", continuousPitr: false };

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
