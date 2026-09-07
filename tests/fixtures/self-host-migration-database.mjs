import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, realpath, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { captureDatabase, currentStorageInventory, databaseClientPlan, previewConnection } from "../../scripts/self-host-migration/database.mjs";
import { sha256File } from "../../scripts/self-host-ci/lib.mjs";

// Explicit synthetic-only integration. Creates its own no-egress network and
// tmpfs PG17 database; no operational env/DB/volume or cloud key is discovered.
process.umask(0o077);
const root = path.resolve(process.argv[2]);
assert.match(root, /\/\.tmp\/migration-database-fixture-[a-z0-9-]+$/u);
assert.equal(await realpath(path.dirname(root)), path.dirname(root));
await mkdir(root, { mode: 0o700 });
const suffix = randomUUID().slice(0, 8), name = `ssartnership-migration-fixture-${suffix}`, network = `${name}-net`;
const env = { PATH: process.env.PATH, HOME: process.env.HOME };
function run(args, input) {
  const result = spawnSync("docker", args, { env, input, encoding: "utf8", timeout: 120_000, maxBuffer: 2 * 1024 ** 2 });
  assert.equal(result.status, 0, "synthetic Docker command failed");
  return result.stdout.trim();
}
let created = false, completed = false;
try {
  run(["network", "create", "--internal", "--label", "ssartnership.synthetic-migration=true", network]);
  run(["run", "--detach", "--name", name, "--network", network, "--label", "ssartnership.synthetic-migration=true",
    "--memory", "512m", "--cpus", "1", "--tmpfs", "/var/lib/postgresql/data:mode=0700,size=256m", "--env", "POSTGRES_HOST_AUTH_METHOD=trust",
    "postgres@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193"]);
  created = true;
  run(["exec", name, "sh", "-ec", "for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do pg_isready -U postgres >/dev/null && exit 0; sleep 1; done; exit 1"]);
  const sql = (text, database = "postgres") => run(["exec", "--interactive", name, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], text);
  sql(`CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL);
CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text REFERENCES storage.buckets(id),name text,version text,metadata jsonb);
INSERT INTO storage.buckets VALUES('private','private',false),('empty','empty',false);
INSERT INTO storage.objects VALUES('00000000-0000-0000-0000-000000000001','private','synthetic.bin','v1','{"size":3}');
CREATE ROLE migration_fixture_reader NOLOGIN;
CREATE TABLE public.members(id integer PRIMARY KEY,password_hash text);
INSERT INTO public.members VALUES(1,'synthetic-preview-password-material');
GRANT SELECT ON public.members TO migration_fixture_reader;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_policy ON public.members FOR SELECT TO migration_fixture_reader USING (true);
CREATE FUNCTION public.fixture_value() RETURNS integer LANGUAGE sql AS 'SELECT 7';
CREATE DATABASE restored;`);
  let mutationApplied = false;
  const planFor = (tool, args) => {
    if (tool === "pg_dump" && !mutationApplied) {
      // Mutate after the reader exports its snapshot. The archive and initial
      // storage inventory must retain the earlier state, not this newer data.
      sql("UPDATE public.members SET password_hash='synthetic-later-value'; UPDATE storage.objects SET version='v2',metadata='{\"size\":4}';");
      mutationApplied = true;
    }
    const connection = previewConnection("postgres://postgres:synthetic@db.uuxzzanpxzvhauzxufuk.supabase.co/postgres");
    // Only this fixture rewrites transport to its random isolated Docker host.
    Object.assign(connection, { PGHOST: name, PGSSLMODE: "disable", PGPASSWORD: "synthetic" });
    const plan = databaseClientPlan(connection, tool, args, `${name}-${randomUUID().slice(0, 8)}`);
    plan.args[plan.args.indexOf("--network") + 1] = network;
    return plan;
  };
  const captured = await captureDatabase(path.join(root, "database"), planFor);
  assert.equal(captured.storageInventory.objects[0].version, "v1");
  assert.equal((await currentStorageInventory(planFor)).objects[0].version, "v2");
  const archive = path.join(root, "database/database.dump");
  assert.equal(await sha256File(archive), captured.receipt.sha256);
  assert.equal(captured.receipt.restoreApproved, false);
  const roles = JSON.parse(await readFile(path.join(root, "database/roles.json"), "utf8"));
  assert.ok(roles.roles.some(item => item.rolname === "migration_fixture_reader"));
  assert.ok(roles.roles.every(item => !Object.hasOwn(item, "rolpassword")));
  run(["exec", "--interactive", name, "pg_restore", "--exit-on-error", "--single-transaction", "-U", "postgres", "-d", "restored"], await readFile(archive));
  assert.equal(sql("SELECT password_hash FROM public.members;", "restored"), "synthetic-preview-password-material");
  assert.equal(sql("SELECT version FROM storage.objects;", "restored"), "v1");
  assert.equal(sql("SELECT public.fixture_value();", "restored"), "7");
  assert.equal(sql("SELECT relrowsecurity FROM pg_class WHERE oid='public.members'::regclass;", "restored"), "t");
  assert.equal(sql("SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='members';", "restored"), "1");
  assert.equal(sql("SELECT has_table_privilege('migration_fixture_reader','public.members','SELECT');", "restored"), "t");
  const proof = { syntheticOnly: true, sharedSnapshotVerified: true, originalPreviewPasswordMaterialPreserved: true, schemaFunctionRlsAclRestored: true, roleDefinitionsPreservedWithoutLoginSecrets: true, freshInventoryDetectsMutation: true, archiveHashVerified: true };
  await writeFile(path.join(root, "proof.json"), JSON.stringify(proof), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify(proof)); completed = true;
} finally {
  // Names belong solely to this new synthetic fixture; no broad prune/volume
  // deletion. Keep failed fixture state for inspection rather than hiding it.
  if (completed && created) { run(["rm", "--force", name]); run(["network", "rm", network]); }
}
