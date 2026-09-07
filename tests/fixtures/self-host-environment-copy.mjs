// Explicit synthetic-only Docker rehearsal. Never discovers cloud credentials.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash, pbkdf2Sync } from "node:crypto";
import { loadPair, pairComposeArgs } from "../../scripts/self-host-environments/lib.mjs";
import { root, run, psql, withPairLock } from "../../scripts/self-host-environments/cli.mjs";
import { prepareCopy } from "../../scripts/self-host-environments/copy.mjs";

const directory = path.resolve(process.argv[2]);
assert.ok(directory.startsWith(path.join(root, ".tmp", "dual-environments-")));
const pair = await loadPair(directory);
const prod = pair.production;
const args = pairComposeArgs(root, directory, prod);
const member = randomUUID(), category = randomUUID();
const headers = { apikey: prod.data.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${prod.data.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json" };
async function api(route, init) {
  const response = await fetch(`${prod.data.SUPABASE_URL}/storage/v1/${route}`, { ...init, headers: { ...headers, ...init?.headers }, redirect: "error", signal: AbortSignal.timeout(15_000) });
  assert.ok(response.ok, `fixture Storage status ${response.status}`);
  return response;
}
await psql(args, `INSERT INTO public.categories(id,key,label) VALUES('${category}','dual-${category}','source category');
INSERT INTO public.members(id,display_name,generation,campus,password_hash,password_salt,email,email_normalized) VALUES('${member}','synthetic dual member',15,'서울','synthetic-old-hash','synthetic-old-salt','dual-${member}@example.invalid','dual-${member}@example.invalid');
INSERT INTO public.push_subscriptions(member_id,endpoint,p256dh,auth) VALUES('${member}','https://push.example.invalid/${member}','synthetic-key','synthetic-auth');`);
const bucket = `dual-${randomUUID().slice(0, 8)}`;
await api("bucket", { method: "POST", body: JSON.stringify({ id: bucket, name: bucket, public: true }) });
await api(`object/${bucket}/fixture.txt`, { method: "POST", headers: { "content-type": "text/plain" }, body: "independent storage fixture" });
const privateBucket = "member-profile-images";
const bucketList = await (await api("bucket")).json();
if (!bucketList.some(item => item.id === privateBucket)) await api("bucket", { method: "POST", body: JSON.stringify({ id: privateBucket, name: privateBucket, public: false }) });
const privatePath = `synthetic/${member}.webp`;
const privateBytes = Buffer.from("synthetic private image fixture; not a real member photo");
const imageId = randomUUID();
await api(`object/${privateBucket}/${privatePath}`, { method: "POST", headers: { "content-type": "image/webp" }, body: privateBytes });
await psql(args, `INSERT INTO public.member_profile_images(id,member_id,storage_path,sha256) VALUES('${imageId}','${member}','${privatePath}','${createHash("sha256").update(privateBytes).digest("hex")}');`);
const before = await psql(args, `SELECT row_to_json(m) FROM public.members m WHERE id='${member}';`);
console.log(JSON.stringify({ stage: "synthetic-source-seeded" }));
await run(process.execPath, ["scripts/self-host-operations/cli.mjs", "backup", "--type", "full", "--env-file", path.join(directory, "production/data.env"), "--operations-env-file", path.join(directory, "production/operations.env")], { timeout: 600_000 });
console.log(JSON.stringify({ stage: "paired-backup-created" }));
const job = path.join(directory, `copy-fixture-${randomUUID()}`);
await mkdir(job, { mode: 0o700 });
try {
  const result = await withPairLock(directory, () => prepareCopy(directory, job));
  const candidate = (await loadPair(result.candidate)).preview;
  const candidateArgs = pairComposeArgs(root, result.candidate, candidate);
  const sanitized = JSON.parse(await psql(candidateArgs, `SELECT json_build_object('hash',password_hash,'salt',password_salt,'email',email,'normalized',email_normalized,'reset',must_change_password) FROM public.members WHERE id='${member}';`));
  assert.equal(sanitized.hash, null); assert.equal(sanitized.salt, null); assert.equal(sanitized.reset, true);
  assert.match(sanitized.email, /@preview\.invalid$/); assert.equal(sanitized.email, sanitized.normalized);
  assert.equal(await psql(candidateArgs, "SELECT count(*) FROM public.push_subscriptions;"), "0");
  const copied = await fetch(`${candidate.data.SUPABASE_URL}/storage/v1/object/public/${bucket}/fixture.txt`);
  assert.equal(copied.status, 200); assert.equal(await copied.text(), "independent storage fixture");
  const candidateHeaders = { apikey: candidate.data.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${candidate.data.SUPABASE_SERVICE_ROLE_KEY}` };
  const privateCopy = await fetch(`${candidate.data.SUPABASE_URL}/storage/v1/object/${privateBucket}/${privatePath}`, { headers: candidateHeaders });
  assert.equal(privateCopy.status, 200); assert.deepEqual(Buffer.from(await privateCopy.arrayBuffer()), privateBytes);
  assert.equal(await psql(candidateArgs, `SELECT count(*) FROM public.member_profile_images WHERE id='${imageId}' AND member_id='${member}';`), "1");
  const publicLeak = await fetch(`${candidate.data.SUPABASE_URL}/storage/v1/object/public/${privateBucket}/${privatePath}`);
  assert.equal(publicLeak.ok, false); await publicLeak.body?.cancel();
  const credentialFile = path.join(job, "test-credential.json");
  const testPassword = `Preview-${randomUUID()}!`;
  await writeFile(credentialFile, JSON.stringify({ memberId: member, password: testPassword }), { flag: "wx", mode: 0o600 });
  await run(process.execPath, ["scripts/self-host-environments/cli.mjs", "seed-preview-member", result.candidate, credentialFile]);
  const seeded = JSON.parse(await psql(candidateArgs, `SELECT json_build_object('hash',password_hash,'salt',password_salt,'reset',must_change_password) FROM public.members WHERE id='${member}';`));
  assert.equal(seeded.hash, pbkdf2Sync(testPassword, seeded.salt, 120_000, 64, "sha256").toString("hex"));
  assert.equal(seeded.reset, false);
  const crossKey = await fetch(`${prod.data.SUPABASE_URL}/rest/v1/categories`, { headers: { apikey: candidate.data.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${candidate.data.SUPABASE_SERVICE_ROLE_KEY}` } });
  assert.equal(crossKey.ok, false);
  await psql(candidateArgs, `DELETE FROM public.categories WHERE id='${category}';`);
  assert.equal(await psql(args, `SELECT count(*) FROM public.categories WHERE id='${category}';`), "1");
  const removed = await fetch(`${candidate.data.SUPABASE_URL}/storage/v1/object/${bucket}`, { method: "DELETE", headers: { "content-type": "application/json", apikey: candidate.data.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${candidate.data.SUPABASE_SERVICE_ROLE_KEY}` }, body: JSON.stringify({ prefixes: ["fixture.txt"] }) });
  assert.equal(removed.ok, true);
  assert.equal(await (await api(`object/public/${bucket}/fixture.txt`)).text(), "independent storage fixture");
  assert.equal(await psql(args, `SELECT row_to_json(m) FROM public.members m WHERE id='${member}';`), before);
  const proof = { ...result, syntheticOnly: true, memberPasswordsRemoved: true, emailsMasked: true, outboundTokensRemoved: true, privateProfileImageAndLedgerCopied: true, privateImagePublicAccessDenied: true, previewOnlyPasswordSeedVerified: true, crossEnvironmentKeyRejected: true, previewDatabaseDeleteIsolated: true, previewStorageDeleteIsolated: true, sourceMemberUnchanged: true };
  await writeFile(path.join(job, "proof.json"), JSON.stringify(proof), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify(proof));
} catch (error) {
  // Only fixed internal error identifiers; never operator stderr or payloads.
  console.error(JSON.stringify({ failed: true, code: /^[A-Z_]+$/u.test(error.message) ? error.message : "FIXTURE_ASSERTION_FAILED", job }));
  process.exitCode = 1;
}
