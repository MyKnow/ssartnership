import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type PreviewSyncDumpModule =
  typeof import("../scripts/supabase-sync-preview-dump-lib.mjs");

const previewSyncDumpModulePromise = import(
  new URL("../scripts/supabase-sync-preview-dump-lib.mjs", import.meta.url).href,
) as Promise<PreviewSyncDumpModule>;
const previewSyncScriptPromise = readFile(
  new URL("../scripts/supabase-sync-preview.mjs", import.meta.url),
  "utf8",
);

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
    excludedTables: ["admin_login_attempts", "password_reset_attempts"],
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
  assert.match(dumpScript, /--exclude-table '"public"\."admin_login_attempts"'/);
  assert.match(dumpScript, /SET session_replication_role = replica/);
  assert.match(dumpScript, /RESET ALL/);
});

test("Preview Sync suppresses only complete circular-FK pg_dump advisories", async () => {
  const { filterPgDumpCircularForeignKeyWarnings } = await previewSyncDumpModulePromise;
  const knownAdvisory = [
    "pg_dump: warning: fixture circular foreign-key constraints",
    "pg_dump: detail: fixture_a",
    "pg_dump: detail: fixture_b",
    "pg_dump: hint: use --disable-triggers for this fixture",
  ].join("\n");
  const unrelatedDiagnostic = "pg_dump: warning: retain this diagnostic\n";

  assert.equal(
    filterPgDumpCircularForeignKeyWarnings(`${knownAdvisory}\n${unrelatedDiagnostic}`),
    unrelatedDiagnostic,
  );

  const incompleteAdvisory = [
    "pg_dump: warning: fixture circular foreign-key constraints",
    "pg_dump: detail: fixture_a",
    "pg_dump: hint: retain this unfamiliar recovery guidance",
  ].join("\n");
  assert.equal(
    filterPgDumpCircularForeignKeyWarnings(`${incompleteAdvisory}\n`),
    `${incompleteAdvisory}\n`,
  );
});

test("Preview Sync filters the direct dump stderr before writing it to workflow logs", async () => {
  const script = await previewSyncScriptPromise;

  assert.match(script, /transformStderr/);
  assert.match(script, /filterPgDumpCircularForeignKeyWarnings/);
  assert.match(
    script,
    /transformStderr:\s*filterPgDumpCircularForeignKeyWarnings/,
  );
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
