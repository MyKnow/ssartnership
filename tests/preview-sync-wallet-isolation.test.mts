import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type PreviewSyncLibModule =
  typeof import("../scripts/supabase-sync-preview-lib.mjs");
type PreviewSyncDumpModule =
  typeof import("../scripts/supabase-sync-preview-dump-lib.mjs");

const previewSyncLibPromise = import(
  new URL("../scripts/supabase-sync-preview-lib.mjs", import.meta.url).href
) as Promise<PreviewSyncLibModule>;
const previewSyncDumpModulePromise = import(
  new URL("../scripts/supabase-sync-preview-dump-lib.mjs", import.meta.url).href,
) as Promise<PreviewSyncDumpModule>;

const previewSyncScriptPromise = readFile(
  new URL("../scripts/supabase-sync-preview.mjs", import.meta.url),
  "utf8",
);

const WALLET_PREVIEW_LOCAL_TABLES = [
  "member_wallet_passes",
  "member_wallet_pass_revisions",
  "apple_wallet_device_registrations",
  "member_wallet_pass_operations",
] as const;

test("Preview sync never copies Production Apple Wallet tables", async () => {
  const script = await previewSyncScriptPromise;
  const walletTablesMatch = script.match(
    /const PREVIEW_LOCAL_WALLET_TABLES = \[([\s\S]*?)\];/,
  );
  const excludedTablesMatch = script.match(
    /const EXCLUDED_PUBLIC_TABLES = \[([\s\S]*?)\];/,
  );

  assert.ok(
    walletTablesMatch?.[1],
    "PREVIEW_LOCAL_WALLET_TABLES definition should exist",
  );
  assert.ok(
    excludedTablesMatch?.[1],
    "EXCLUDED_PUBLIC_TABLES definition should exist",
  );

  for (const table of WALLET_PREVIEW_LOCAL_TABLES) {
    assert.match(
      walletTablesMatch[1],
      new RegExp(`"${table}"`),
      `${table} should remain Preview-local`,
    );
  }

  assert.match(
    excludedTablesMatch[1],
    /\.\.\.PREVIEW_LOCAL_WALLET_TABLES/,
  );
  assert.match(script, /excludedTables:\s*EXCLUDED_PUBLIC_TABLES/);

  const { buildProductionDataDumpContainerPlan } = await previewSyncDumpModulePromise;
  const plan = buildProductionDataDumpContainerPlan({
    productionDbUrl: "postgresql://postgres:secret@db.example.test:5432/partnership",
    schema: "public",
    excludedTables: [...WALLET_PREVIEW_LOCAL_TABLES],
  });
  const dumpScript = plan.args.at(-1);

  assert.ok(dumpScript, "Docker dump command should include a shell script");

  for (const table of WALLET_PREVIEW_LOCAL_TABLES) {
    assert.match(
      dumpScript,
      new RegExp(`--exclude-table '\\"public\\"\\.\\"${table}\\"'`),
    );
  }
});

test("Preview sync executes one replacement transaction while preserving Preview-local Wallet rows", async () => {
  const script = await previewSyncScriptPromise;

  assert.match(script, /buildTransactionalPreviewRestoreSql\(/);
  assert.match(script, /"--single-transaction"/);
  assert.match(
    script,
    /await replacePreviewDatabaseData\(dumpPath, restorePath, previewDbUrl\)/,
  );
  assert.match(script, /preserving local Wallet records/i);
  assert.match(script, /preservedTables:\s*PREVIEW_LOCAL_WALLET_TABLES/);
  assert.match(
    script,
    /const missingWalletTables = PREVIEW_LOCAL_WALLET_TABLES\.filter\(/,
  );
  assert.match(
    script,
    /Preview Wallet schema is missing .* apply migrations before data sync\./,
  );
});

test("Preview sync replacement restores Preview-local Wallet rows and stays fail-closed for removed members", async () => {
  const { buildTransactionalPreviewRestoreSql } = await previewSyncLibPromise;
  const sql = buildTransactionalPreviewRestoreSql({
    productionDumpSql: "select 1;",
    schema: "public",
    targetTables: ["members"],
    preservedTables: [...WALLET_PREVIEW_LOCAL_TABLES],
  });

  for (const table of WALLET_PREVIEW_LOCAL_TABLES) {
    assert.match(
      sql,
      new RegExp(`preview_sync_backup_${table}`),
    );
    assert.match(
      sql,
      new RegExp(`insert into "public"\\."${table}"`),
    );
  }
  assert.match(sql, /set local session_replication_role = origin;/);
});
