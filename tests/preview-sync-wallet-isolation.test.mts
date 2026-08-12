import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type PreviewSyncLibModule =
  typeof import("../scripts/supabase-sync-preview-lib.mjs");

const previewSyncLibPromise = import(
  new URL("../scripts/supabase-sync-preview-lib.mjs", import.meta.url).href
) as Promise<PreviewSyncLibModule>;

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
  assert.match(
    script,
    /for \(const table of EXCLUDED_PUBLIC_TABLES\)\s*\{\s*args\.push\("-x", `\$\{PUBLIC_SCHEMA\}\.\$\{table\}`\);\s*\}/,
  );
});

test("Preview sync restores Preview-local Wallet rows inside the same replacement transaction", async () => {
  const { buildTransactionalPreviewRestoreSql } = await previewSyncLibPromise;
  const productionDumpSql = [
    "COPY public.members (id) FROM stdin;",
    "member-1",
    "\\.",
  ].join("\n");
  const sql = buildTransactionalPreviewRestoreSql({
    productionDumpSql,
    schema: "public",
    targetTables: ["categories", "members"],
    preservedTables: [...WALLET_PREVIEW_LOCAL_TABLES],
  });

  const lockIndex = sql.indexOf("lock table");
  const firstBackupIndex = sql.indexOf("create temporary table");
  const truncateIndex = sql.indexOf("truncate table");
  const productionRestoreIndex = sql.indexOf(productionDumpSql);
  const constraintRestoreIndex = sql.indexOf(
    "set local session_replication_role = origin;",
  );
  const firstWalletRestoreIndex = sql.indexOf(
    'insert into "public"."member_wallet_passes"',
  );

  assert.ok(lockIndex >= 0, "replacement must lock the affected tables first");
  assert.ok(firstBackupIndex > lockIndex, "Wallet backup must follow the lock");
  assert.ok(truncateIndex > firstBackupIndex, "truncate must follow the backup");
  assert.ok(
    productionRestoreIndex > truncateIndex,
    "Production restore must follow truncate",
  );
  assert.ok(
    constraintRestoreIndex > productionRestoreIndex,
    "foreign-key enforcement must follow the Production restore",
  );
  assert.ok(
    firstWalletRestoreIndex > constraintRestoreIndex,
    "Wallet restore must follow foreign-key enforcement",
  );

  for (const table of WALLET_PREVIEW_LOCAL_TABLES) {
    assert.match(
      sql,
      new RegExp(
        `create temporary table "preview_sync_backup_${table}"[\\s\\S]*as table "public"\\."${table}";`,
      ),
    );
    assert.match(
      sql,
      new RegExp(
        `insert into "public"\\."${table}"[\\s\\S]*from pg_temp\\."preview_sync_backup_${table}";`,
      ),
    );
  }
});

test("Preview sync executes truncate, Production restore, and Wallet restore atomically", async () => {
  const script = await previewSyncScriptPromise;

  assert.match(script, /buildTransactionalPreviewRestoreSql\(/);
  assert.match(script, /"--single-transaction"/);
  assert.match(script, /await replacePreviewDatabaseData\(dumpPath, restorePath, previewDbUrl\)/);
});

test("Preview Wallet restore stays fail-closed for removed Production members", async () => {
  const { buildTransactionalPreviewRestoreSql } = await previewSyncLibPromise;
  const sql = buildTransactionalPreviewRestoreSql({
    productionDumpSql: "select 1;",
    schema: "public",
    targetTables: ["members"],
    preservedTables: [...WALLET_PREVIEW_LOCAL_TABLES],
  });

  assert.doesNotMatch(sql, /on conflict/i);
  assert.doesNotMatch(sql, /join\s+"public"\."members"/i);
  assert.doesNotMatch(sql, /where\s+exists/i);
});
