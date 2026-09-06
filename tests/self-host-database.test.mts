import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assertSafeEnvironmentOutputPath, composeEnvironment, createDatabaseEnvironment, createMigrationPlan, deriveProjectName, evaluateMigrationLedger, normalizeMigrationTransaction, parseEnvironmentText, renderMigrationRunnerSql, resolveSignedStorageUrl, validateDatabaseEnvironment, validateProjectName, writeNewEnvironmentFile } from "../scripts/self-host-database/lib.mjs";
test("init emits distinct local credentials only to a new owner-only ignored file", async () => {
  const root = await mkdtemp(join(tmpdir(), "ssartnership-self-host-"));
  try {
    const output = join(root, ".tmp", "self-host", "dev.env"),
      env = createDatabaseEnvironment({
        environmentFile: output,
        port: "58123"
      });
    assert.equal(new Set([env.POSTGRES_PASSWORD, env.JWT_SECRET, env.SUPABASE_ANON_KEY, env.SUPABASE_SERVICE_ROLE_KEY]).size, 4);
    assert.equal(env.SUPABASE_URL, "http://127.0.0.1:58123");
    assert.equal(env.SUPABASE_INTERNAL_URL, "http://gateway:8000");
    await writeNewEnvironmentFile(output, env, root);
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    assert.doesNotMatch(await readFile(output, "utf8"), /NEXT_PUBLIC_|VERCEL|PROVIDER/iu);
    await assert.rejects(() => writeNewEnvironmentFile(output, env, root), /EEXIST/u);
  } finally {
    await rm(root, {
      recursive: true,
      force: true
    });
  }
});
test("config rejects unsafe project/output paths and strips inherited self-host config", () => {
  const root = "/tmp/ssartnership-workspace";
  assert.throws(() => assertSafeEnvironmentOutputPath(join(root, ".env"), root), /environment_output_path_not_ignored/u);
  assert.throws(() => assertSafeEnvironmentOutputPath(join(root, "deploy", "data.env"), root), /environment_output_path_not_ignored/u);
  assert.equal(deriveProjectName(".tmp/self-host/demo.env"), "ssartnership-demo");
  assert.equal(validateProjectName("ssartnership-demo_2"), "ssartnership-demo_2");
  assert.throws(() => validateProjectName("other-project"), /compose_project_name_invalid/u);
  assert.deepEqual(composeEnvironment({
    NODE_ENV: "test",
    PATH: "/usr/bin",
    DOCKER_CONTEXT: "local",
    POSTGRES_PASSWORD: "poison",
    JWT_SECRET: "poison",
    SUPABASE_URL: "https://prod",
    COMPOSE_FILE: "prod.yaml",
    SELF_HOST_RUNTIME_ENV_FILE: "prod.env",
    KONG_PLUGINS: "evil",
    PGRST_DB_URI: "postgres://prod",
    STORAGE_PUBLIC_URL: "https://prod",
    PGPASSWORD: "poison"
  }), {
    NODE_ENV: "test",
    PATH: "/usr/bin",
    DOCKER_CONTEXT: "local"
  });
});
test("fixed gateway environment validates and rejects hosted targets or duplicate dotenv keys", () => {
  const env = createDatabaseEnvironment({
    environmentFile: "dev.env"
  });
  assert.deepEqual(validateDatabaseEnvironment(env), env);
  assert.throws(() => validateDatabaseEnvironment({
    ...env,
    SUPABASE_URL: "https://hosted.example.invalid"
  }), /supabase_public_url_invalid/u);
  assert.throws(() => validateDatabaseEnvironment({
    ...env,
    SUPABASE_INTERNAL_URL: "http://db:5432"
  }), /supabase_internal_url_invalid/u);
  assert.throws(() => validateDatabaseEnvironment({
    ...env,
    SUPABASE_ANON_KEY: `${env.SUPABASE_ANON_KEY}x`
  }), /anon_key_invalid/u);
  assert.throws(() => parseEnvironmentText("SUPABASE_ANON_KEY=one\nSUPABASE_ANON_KEY=two\n"), /environment_key_invalid/u);
});
test("signed Storage paths stay under the gateway Storage prefix and reject external targets", () => {
  assert.equal(resolveSignedStorageUrl("http://127.0.0.1:58000/storage/v1", "/object/sign/private/file.txt?token=one"), "http://127.0.0.1:58000/storage/v1/object/sign/private/file.txt?token=one");
  assert.throws(() => resolveSignedStorageUrl("http://127.0.0.1:58000/storage/v1", "https://external.example.invalid/object/sign/x"), /storage_signed_url_invalid/u);
});
test("migration ledger keeps raw checksums, safely unwraps only outer transactions, reruns, and detects drift", () => {
  const wrapped = "begin;\ncreate table public.example (id integer);\ncommit;\n",
    functionSource = "create function public.example_fn() returns void language plpgsql as $$\nbegin\n perform 1;\nend;\n$$;\n";
  const plan = createMigrationPlan([{
    name: "20260906100001_function.sql",
    source: functionSource
  }, {
    name: "20260906100000_wrapped.sql",
    source: wrapped
  }]);
  assert.deepEqual(plan.map(item => item.name), ["20260906100000_wrapped.sql", "20260906100001_function.sql"]);
  assert.equal(plan[0].checksum, createHash("sha256").update(wrapped).digest("hex"));
  assert.equal(plan[0].source, "create table public.example (id integer);");
  assert.equal(normalizeMigrationTransaction(functionSource), functionSource);
  assert.throws(() => normalizeMigrationTransaction("begin work;\nselect 1;\ncommit work;\n"), /unsupported top-level transaction control/u);
  assert.throws(() => normalizeMigrationTransaction("begin;\nselect 1;\nrollback to savepoint one;\n"), /unsupported top-level transaction control/u);
  assert.throws(() => normalizeMigrationTransaction("\\i unsafe.sql\n"), /psql directive/u);
  const runner = renderMigrationRunnerSql(plan);
  assert.match(runner, /pg_advisory_lock/u);
  assert.match(runner, /self_host_migration_checksum_drift/u);
  assert.match(runner, /\\if :self_host_pending/u);
  assert.match(runner, /insert into self_host\.migration_ledger/u);
  assert.deepEqual(evaluateMigrationLedger(plan), plan);
  const ledger = new Map([[plan[0].name, plan[0].checksum], [plan[1].name, plan[1].checksum]]);
  assert.deepEqual(evaluateMigrationLedger(plan, ledger), []);
  ledger.set(plan[0].name, "0".repeat(64));
  assert.throws(() => evaluateMigrationLedger(plan, ledger), /checksum drift/u);
});
test("all immutable application migrations fit the bounded transaction contract", async () => {
  const directory = new URL("../supabase/migrations/", import.meta.url);
  const migrations = await Promise.all((await readdir(directory)).filter(name => name.endsWith(".sql")).map(async name => ({
    name,
    source: await readFile(new URL(name, directory), "utf8")
  })));
  const plan = createMigrationPlan(migrations);
  assert.equal(plan.length, migrations.length);
  assert.ok(plan.length > 0);
});
test("compose pins data services and exposes only a loopback gateway", async () => {
  const compose = await readFile(new URL("../compose.supabase.yaml", import.meta.url), "utf8");
  assert.match(compose, /127\.0\.0\.1:\$\{SUPABASE_GATEWAY_PORT:-58000\}:8000/u);
  assert.doesNotMatch(compose, /5432:/u);
  assert.match(compose, /supabase\/postgres:17\.6\.1\.136@sha256:f371b5/u);
  assert.match(compose, /postgrest\/postgrest:v14\.12@sha256:54000f/u);
  assert.match(compose, /supabase\/storage-api:v1\.60\.4@sha256:c8eb985/u);
  assert.match(compose, /kong\/kong:3\.9\.3@sha256:9a2ae669/u);
  assert.match(compose, /db-data:\/var\/lib\/postgresql\/data/u);
  assert.match(compose, /storage-data:\/var\/lib\/storage/u);
  assert.match(compose, /internal: true/u);
});
