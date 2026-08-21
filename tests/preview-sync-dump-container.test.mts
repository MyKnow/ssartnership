import assert from "node:assert/strict";
import test from "node:test";

type PreviewSyncDumpModule =
  typeof import("../scripts/supabase-sync-preview-dump-lib.mjs");

const previewSyncDumpModulePromise = import(
  new URL("../scripts/supabase-sync-preview-dump-lib.mjs", import.meta.url).href,
) as Promise<PreviewSyncDumpModule>;

test("Preview Sync uses a pinned PostgreSQL 17 container and disables restore triggers", async () => {
  const {
    SUPABASE_POSTGRES_DUMP_IMAGE,
    buildProductionDataDumpContainerPlan,
  } = await previewSyncDumpModulePromise;
  const productionDbUrl =
    "postgresql://postgres.user:p%40ss%2Fword@db.example.test:6543/partnership?sslmode=require&application_name=preview-sync";
  const plan = buildProductionDataDumpContainerPlan({
    productionDbUrl,
    schema: "public",
    excludedTables: ["member_wallet_passes", "password_reset_attempts"],
  });
  const serializedArgs = JSON.stringify(plan.args);
  const dumpScript = plan.args.at(-1);

  assert.equal(plan.command, "docker");
  assert.equal(SUPABASE_POSTGRES_DUMP_IMAGE.includes("@sha256:"), true);
  assert.deepEqual(plan.environment, {
    PGHOST: "db.example.test",
    PGPORT: "6543",
    PGUSER: "postgres.user",
    PGPASSWORD: "p@ss/word",
    PGDATABASE: "partnership",
    PGSSLMODE: "require",
    PGAPPNAME: "preview-sync",
  });
  assert.equal(plan.args.includes("--network"), true);
  assert.equal(plan.args.includes("host"), true);
  assert.equal(plan.args.includes("--env"), true);
  assert.equal(plan.args.includes("PGPASSWORD"), true);
  const entrypointIndex = plan.args.indexOf("--entrypoint");
  const imageIndex = plan.args.indexOf(SUPABASE_POSTGRES_DUMP_IMAGE);
  assert.ok(entrypointIndex >= 0, "Docker dump command should override the server entrypoint");
  assert.equal(plan.args[entrypointIndex + 1], "bash");
  assert.ok(entrypointIndex < imageIndex, "Docker entrypoint override must precede the image");
  assert.equal(plan.args[imageIndex + 1], "-c");
  assert.equal(serializedArgs.includes(productionDbUrl), false);
  assert.equal(serializedArgs.includes("p@ss/word"), false);
  assert.ok(dumpScript, "Docker dump command should include a shell script");
  assert.match(dumpScript, /--data-only/);
  assert.match(dumpScript, /--disable-triggers/);
  assert.match(dumpScript, /--quote-all-identifiers/);
  assert.match(dumpScript, /--exclude-table '"public"\."member_wallet_passes"'/);
  assert.match(dumpScript, /SET session_replication_role = replica/);
  assert.match(dumpScript, /RESET ALL/);
});

test("Preview Sync rejects unsupported dump inputs before starting Docker", async () => {
  const { buildProductionDataDumpContainerPlan } = await previewSyncDumpModulePromise;
  const options = {
    productionDbUrl: "postgresql://postgres:secret@db.example.test:5432/partnership",
    schema: "public",
  };

  assert.throws(
    () =>
      buildProductionDataDumpContainerPlan({
        ...options,
        excludedTables: ["members; drop table members"],
      }),
    /Unsupported Preview Sync table name/,
  );
  assert.throws(
    () =>
      buildProductionDataDumpContainerPlan({
        ...options,
        schema: "auth",
        excludedTables: [],
      }),
    /only supports the public schema/,
  );
  assert.throws(
    () =>
      buildProductionDataDumpContainerPlan({
        ...options,
        productionDbUrl: "https://db.example.test",
        excludedTables: [],
      }),
    /must use postgres or postgresql/,
  );
});
