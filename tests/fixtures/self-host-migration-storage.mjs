import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile, realpath } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createDatabaseEnvironment, writeNewEnvironmentFile } from "../../scripts/self-host-database/lib.mjs";
import { previewConnection, databaseClientPlan, captureDatabase, currentStorageInventory } from "../../scripts/self-host-migration/database.mjs";
import { exportStorage } from "../../scripts/self-host-migration/storage.mjs";
import { sealMigrationFile, openMigrationFile } from "../../scripts/self-host-migration/transfer.mjs";
import { sha256File } from "../../scripts/self-host-ci/lib.mjs";

process.umask(0o077);
const root = await realpath(process.cwd()), directory = path.resolve(process.argv[2]);
assert.ok(directory.startsWith(path.join(root, ".tmp/migration-storage-fixture-")));
assert.equal(await realpath(path.dirname(directory)), path.dirname(directory));
await mkdir(directory, { mode: 0o700 });
const project = `ssartnership-migration-storage-${randomUUID().slice(0, 8)}`;
const environmentFile = path.join(directory, "fixture.env");
const data = createDatabaseEnvironment({ environmentFile, project, port: "58920" });
await writeNewEnvironmentFile(environmentFile, data, root);
const env = { PATH: process.env.PATH, HOME: process.env.HOME };
function run(command, args, input) {
  const result = spawnSync(command, args, { cwd: root, env, input, encoding: "utf8", timeout: 180_000, maxBuffer: 4 * 1024 ** 2 });
  assert.equal(result.status, 0, "synthetic fixture command failed"); return result.stdout.trim();
}
let completed = false;
try {
  run(process.execPath, ["scripts/self-host-database/cli.mjs", "up", "--env-file", environmentFile]);
  console.log('{"stage":"synthetic-storage-ready"}');
  const headers = { apikey: data.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${data.SUPABASE_SERVICE_ROLE_KEY}` };
  const api = async (route, options) => {
    const response = await fetch(`${data.SUPABASE_URL}/storage/v1/${route}`, { ...options, headers: { ...headers, ...options?.headers }, redirect: "error", signal: AbortSignal.timeout(15000) });
    assert.ok(response.ok, `synthetic Storage HTTP ${response.status}`); await response.body?.cancel();
  };
  for (const [id, isPublic] of [["private", false], ["public", true], ["empty", false]]) {
    await api("bucket", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, name: id, public: isPublic }) });
  }
  const objects = [["private/nested/fixture.txt", Buffer.from("synthetic private bytes")], ["public/fixture.txt", Buffer.from("synthetic public bytes")], ["private/zero.bin", Buffer.alloc(0)]];
  for (const [name, bytes] of objects) {
    await api(`object/${name}`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: bytes });
  }
  const planFor = (tool, args) => {
    const connection = previewConnection("postgres://postgres:synthetic@db.uuxzzanpxzvhauzxufuk.supabase.co/postgres");
    Object.assign(connection, { PGHOST: "db", PGSSLMODE: "disable", PGPASSWORD: data.POSTGRES_PASSWORD });
    const plan = databaseClientPlan(connection, tool, args, `ssartnership-migration-fixture-${randomUUID()}`);
    plan.args[plan.args.indexOf("--network") + 1] = `${project}_private`;
    return plan;
  };
  const payload = path.join(directory, "payload"); await mkdir(payload, { mode: 0o700 });
  const captured = await captureDatabase(path.join(payload, "database"), planFor);
  let reads = 0;
  const result = await exportStorage({ directory: path.join(payload, "storage"), serviceKey: data.SUPABASE_SERVICE_ROLE_KEY,
    readInventory: () => ++reads === 1 ? Promise.resolve(captured.storageInventory) : currentStorageInventory(planFor) }, async (url, init) => {
    // Transport remapping exists only in this explicit synthetic fixture. A
    // production exporter cannot choose an origin through env or CLI input.
    const parsed = new URL(url); assert.equal(parsed.origin, "https://uuxzzanpxzvhauzxufuk.supabase.co");
    return fetch(`${data.SUPABASE_URL}${parsed.pathname}`, init);
  });
  assert.deepEqual(result, { buckets: 3, objects: objects.length, bytes: objects.reduce((total, [, bytes]) => total + bytes.length, 0), verifiedPasses: 2, inventoryReads: 3 });
  const ledger = JSON.parse(await readFile(path.join(payload, "storage/ledger.json"), "utf8"));
  for (const file of ledger.files) assert.equal(await sha256File(path.join(payload, "storage", file.file)), file.sha256);
  const archive = path.join(directory, "snapshot.tar"); run("tar", ["-cf", archive, "-C", payload, "database", "storage"]);
  const identity = path.join(directory, "synthetic-identity.txt"); run("age-keygen", ["-o", identity]);
  const recipient = run("age-keygen", ["-y", identity]);
  const context = { sourceProject: "uuxzzanpxzvhauzxufuk", sha: "a".repeat(40), runId: 1 };
  const encrypted = path.join(directory, "encrypted");
  await sealMigrationFile({ source: archive, directory: encrypted, recipient, context });
  const opened = await openMigrationFile({ directory: encrypted, destination: path.join(directory, "decrypted"), identity, context });
  assert.equal(await sha256File(archive), await sha256File(opened.file));
  const proof = { syntheticOnly: true, realSupabaseDatabaseAndStorage: true, ...result, allFileHashesVerified: true, completeArchiveAgeRoundTrip: true, cloudMutated: false };
  await writeFile(path.join(directory, "proof.json"), JSON.stringify(proof), { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify(proof)); completed = true;
} finally {
  // Stop only this freshly-created fixture. Preserve its synthetic volumes
  // and encrypted export as inspection evidence; never prune existing stacks.
  if (completed) run(process.execPath, ["scripts/self-host-database/cli.mjs", "down", "--env-file", environmentFile]);
}
