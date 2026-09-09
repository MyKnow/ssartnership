import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { executeCli } from "../scripts/self-host-operations/cli.mjs";
import { executeOffhost, parseOffhostArguments, parseSnapshotSummary, validateOffhostEnvironment } from "../scripts/self-host-operations/offhost.mjs";
import { acquireOperationsLock, serializeEnvironment } from "../scripts/self-host-operations/lib.mjs";

function environment() {
  return {
    OFFHOST_REPOSITORY: "rest:https://backup.example.test/backup/ssartnership/",
    OFFHOST_PASSWORD: randomBytes(32).toString("hex"), OFFHOST_USERNAME: "backup",
    OFFHOST_CREDENTIAL: randomBytes(32).toString("hex"), OFFHOST_CA_FILE: "/tmp/ca.pem",
  };
}

test("offhost destination requires HTTPS, separate credentials and a scoped private repo", () => {
  assert.doesNotThrow(() => validateOffhostEnvironment(environment()));
  for (const url of ["rest:http://backup.example/backup/ssartnership/", "rest:https://user:pass@backup.example/backup/ssartnership/", "rest:https://backup.example/", "rest:https://backup.example/backup/ssartnership/?token=x", "sftp:host:/backups"]) {
    assert.throws(() => validateOffhostEnvironment({ ...environment(), OFFHOST_REPOSITORY: url }));
  }
  assert.throws(() => validateOffhostEnvironment({ ...environment(), COMPOSE_FILE: "/evil" }));
  assert.throws(() => validateOffhostEnvironment({ ...environment(), OFFHOST_CREDENTIAL: "short" }));
});

test("restore only accepts a full immutable snapshot ID and no operator-selected overwrite target", () => {
  const args = ["restore", "--env-file", "data.env", "--operations-env-file", "ops.env", "--offhost-env-file", "offhost.env"];
  for (const id of ["latest", "../existing", "--delete", "abcd"]) assert.throws(() => parseOffhostArguments([...args, "--snapshot", id]));
  assert.equal(parseOffhostArguments([...args, "--snapshot", "a".repeat(64)]).command, "restore");
  assert.throws(() => parseOffhostArguments([...args, "--snapshot", "a".repeat(64), "--target", "/"]));
  assert.equal(parseSnapshotSummary(JSON.stringify({ message_type: "summary", snapshot_id: "b".repeat(64) })), "b".repeat(64));
  assert.throws(() => parseSnapshotSummary(JSON.stringify({ message_type: "summary", snapshot_id: "latest" })));
});

test("failed offhost check is recorded and never initializes the repository or leaks backend errors", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ssartnership-offhost-"));
  const data = path.join(directory, "data.env");
  const ops = path.join(directory, "ops.env");
  const offhost = path.join(directory, "offhost.env");
  const ca = path.join(directory, "ca.pem");
  await writeFile(data, "COMPOSE_PROJECT_NAME=ssartnership-test\n", { mode: 0o600 });
  await writeFile(ca, "synthetic CA");
  const env = { ...environment(), OFFHOST_CA_FILE: ca };
  await writeFile(offhost, serializeEnvironment(env), { mode: 0o600 });
  await executeCli(["init", "--env-file", data, "--operations-env-file", ops]);
  let calls = 0;
  await assert.rejects(() => executeOffhost(["check", "--env-file", data, "--operations-env-file", ops, "--offhost-env-file", offhost], {
    run: async (_file: string, args: string[]) => {
      calls += 1;
      assert.equal(args.at(-1), "--read-data");
      assert.equal(args.includes("init"), false);
      assert.ok(!args.join(" ").includes(env.OFFHOST_CREDENTIAL));
      await assert.rejects(() => acquireOperationsLock(path.join(directory, "ops-state")), /OPERATIONS_LOCKED/);
      throw new Error(env.OFFHOST_CREDENTIAL);
    },
  }), /OFFHOST_FAILED/);
  assert.equal(calls, 1);
  const manifest = await readFile(path.join(directory, "ops-state", "backup-manifest.jsonl"), "utf8");
  assert.ok(!manifest.includes(env.OFFHOST_CREDENTIAL));
  assert.equal(JSON.parse(manifest.trim()).result, "failed");
  const release = await acquireOperationsLock(path.join(directory, "ops-state"));
  await release();
});

test("receiver is authenticated TLS append-only; client has only read-only source repositories", async () => {
  const receiver = await readFile(new URL("../deploy/self-host-operations/compose.backup-receiver.yaml", import.meta.url), "utf8");
  assert.match(receiver, /--append-only --private-repos --tls --tls-min-ver 1.3/u);
  assert.doesNotMatch(receiver, /--no-auth|--no-verify-upload|docker.sock/u);
  const client = await readFile(new URL("../compose.offhost.yaml", import.meta.url), "utf8");
  assert.match(client, /pgbackrest-repo:\/bundle\/pgbackrest:ro/u);
  assert.match(client, /restic-repo:\/bundle\/storage-repository:ro/u);
  assert.doesNotMatch(client, /operations.env|data.env|docker.sock|storage-data:/u);
});
