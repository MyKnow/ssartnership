import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mkdtemp, mkdir, realpath, chmod, readFile, readdir, stat, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { exportStorage, validateStorageInventory, storageDownloadUrl, STORAGE_INVENTORY_SQL } from "../scripts/self-host-migration/storage.mjs";

const inventory = () => ({
  buckets: [{ id: "private", name: "private", public: false }, { id: "public", name: "public", public: true }, { id: "empty", name: "empty", public: false }],
  objects: [
    { id: "00000000-0000-0000-0000-000000000001", bucket_id: "private", name: "한 글/%?#.png", version: "v1", metadata: { size: 3, mimetype: "image/png" }, last_accessed_at: "initial" },
    { id: "00000000-0000-0000-0000-000000000002", bucket_id: "public", name: "zero.bin", version: "v2", metadata: { size: 0 } },
  ],
});
async function fixture(t: TestContext) {
  await mkdir(".tmp", { recursive: true });
  const root = await realpath(await mkdtemp(path.resolve(".tmp/migration-storage-test-")));
  await chmod(root, 0o700);
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, directory: path.join(root, "storage") };
}
function request(url: string, options: RequestInit) {
  assert.equal(new URL(url).origin, "https://uuxzzanpxzvhauzxufuk.supabase.co");
  assert.equal(options.method, "GET");
  assert.equal(options.redirect, "error");
  assert.equal(new Headers(options.headers).get("authorization"), "Bearer synthetic-only-key");
  return Promise.resolve(new Response(url.endsWith("zero.bin") ? Buffer.alloc(0) : Buffer.from("abc")));
}
test("full migration Storage export includes private, public, empty buckets and zero-byte objects", async t => {
  const f = await fixture(t); let calls = 0, reads = 0;
  const result = await exportStorage({ directory: f.directory, serviceKey: "synthetic-only-key", readInventory: async () => {
    reads++; const value = inventory(); value.objects[0].last_accessed_at = String(reads);
    if (reads > 1) { value.buckets.reverse(); value.objects.reverse(); } return value;
  } }, async (url: string, options: RequestInit) => { calls++; return request(url, options); });
  assert.deepEqual(result, { buckets: 3, objects: 2, bytes: 3, verifiedPasses: 2, inventoryReads: 3 });
  assert.equal(calls, 4); assert.equal(reads, 3);
  const ledger = JSON.parse(await readFile(path.join(f.directory, "ledger.json"), "utf8"));
  assert.equal(ledger.version, 1); assert.equal(ledger.inventory.buckets.length, 3);
  assert.equal(ledger.inventory.objects[0].last_accessed_at, "1");
  assert.equal(ledger.files[0].sha256, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(await readFile(path.join(f.directory, ledger.files[0].file), "utf8"), "abc");
  assert.equal((await stat(f.directory)).mode & 0o777, 0o700);
  for (const file of await readdir(f.directory)) {
    assert.match(file, /^(?:[0-9]{6}\.bin|ledger\.json)$/);
    assert.equal((await stat(path.join(f.directory, file))).mode & 0o777, 0o600);
  }
  await assert.rejects(exportStorage({ directory: f.directory, serviceKey: "synthetic-only-key", readInventory: async () => inventory() }, request));
});
test("Storage inventory rejects omissions, duplicates, traversal and excessive byte budgets before HTTP", async () => {
  const mutations = [
    (v: ReturnType<typeof inventory>) => { v.objects.push(v.objects[0]); },
    (v: ReturnType<typeof inventory>) => { v.buckets.push(v.buckets[0]); },
    (v: ReturnType<typeof inventory>) => { v.objects[0].bucket_id = "absent"; },
    (v: ReturnType<typeof inventory>) => { v.objects[0].name = "a/../b"; },
    (v: ReturnType<typeof inventory>) => { v.objects[0].name = "a//b"; },
    (v: ReturnType<typeof inventory>) => { v.objects[0].name = "\\u0000"; },
    (v: ReturnType<typeof inventory>) => { v.objects[0].metadata.size = -1; },
    (v: ReturnType<typeof inventory>) => { v.objects[0].metadata.size = 50 * 1024 ** 2 + 1; },
    (v: ReturnType<typeof inventory>) => { v.objects[0].version = ""; },
  ];
  for (const mutate of mutations) { const value = inventory(); mutate(value); assert.throws(() => validateStorageInventory(value)); }
  assert.throws(() => validateStorageInventory({ buckets: [], objects: inventory().objects }));
  assert.equal(storageDownloadUrl(inventory().objects[0]), "https://uuxzzanpxzvhauzxufuk.supabase.co/storage/v1/object/authenticated/private/%ED%95%9C%20%EA%B8%80/%25%3F%23.png");
  assert.match(STORAGE_INVENTORY_SQL, /to_jsonb\(o\)/);
  assert.doesNotMatch(STORAGE_INVENTORY_SQL, /where|limit|offset/i);
});
test("full Storage migration rejects changed content even if metadata and byte length stay equal", async t => {
  const f = await fixture(t); let calls = 0;
  await assert.rejects(exportStorage({ directory: f.directory, serviceKey: "synthetic-only-key", readInventory: async () => inventory() }, async (url: string, options: RequestInit) => {
    calls++; if (calls === 3) return new Response("xyz"); return request(url, options);
  }), /MIGRATION_STORAGE_CONTENT_CHANGED/);
  assert.equal(calls, 3);
  assert.ok(!(await readdir(f.directory)).includes("ledger.json"));
});
test("Storage source inventory changes in either verification interval prevent a success ledger", async t => {
  for (const changedRead of [2, 3]) {
    const f = await fixture(t); let reads = 0;
    await assert.rejects(exportStorage({ directory: f.directory, serviceKey: "synthetic-only-key", readInventory: async () => {
      const value = inventory(); if (++reads === changedRead) value.buckets[0].public = true; return value;
    } }, request), /MIGRATION_STORAGE_INVENTORY_CHANGED/);
    assert.ok(!(await readdir(f.directory)).includes("ledger.json"));
  }
});
test("HTTP failures, truncated and oversized bodies, stream errors and redirects fail without retry or raw diagnostics", async t => {
  const responders = [
    async () => new Response("private provider body", { status: 403 }),
    async () => new Response("ab"),
    async () => new Response("abcd"),
    async () => new Response(null, { status: 302, headers: { location: "https://example.invalid" } }),
    async () => { throw new Error("private provider error with synthetic key"); },
    async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(Buffer.from("a")); controller.error(new Error("private stream error")); } })),
  ];
  for (const respond of responders) {
    const f = await fixture(t); let calls = 0;
    await assert.rejects(exportStorage({ directory: f.directory, serviceKey: "synthetic-only-key", readInventory: async () => inventory() }, async () => { calls++; return respond(); }), /^Error: MIGRATION_STORAGE_[A-Z_]+$/);
    assert.equal(calls, 1); assert.deepEqual(await readdir(f.directory), []);
  }
});
test("private canonical output parent is mandatory and inventory errors never leak data", async t => {
  const f = await fixture(t); let calls = 0;
  const options = { directory: f.directory, serviceKey: "synthetic-only-key", readInventory: async () => inventory() };
  const fetcher = async (url: string, init: RequestInit) => { calls++; return request(url, init); };
  await chmod(f.root, 0o755); await assert.rejects(exportStorage(options, fetcher));
  await chmod(f.root, 0o700); await symlink(f.root, path.join(f.root, "alias"));
  await assert.rejects(exportStorage({ ...options, directory: path.join(f.root, "alias", "storage") }, fetcher));
  await assert.rejects(exportStorage({ ...options, readInventory: async () => { throw new Error("private DB row"); } }, fetcher), /^Error: MIGRATION_STORAGE_INVENTORY_FAILED$/);
  assert.equal(calls, 0);
});
