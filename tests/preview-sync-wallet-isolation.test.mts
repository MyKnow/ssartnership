import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const previewSyncScriptPromise = readFile(
  new URL("../scripts/supabase-sync-preview.mjs", import.meta.url),
  "utf8",
);

const WALLET_PREVIEW_LOCAL_TABLES = [
  "member_wallet_passes",
  "member_wallet_pass_revisions",
  "member_wallet_pass_operations",
  "apple_wallet_device_registrations",
] as const;

test("Preview sync excludes Preview-local Apple Wallet tables from production copy and truncate", async () => {
  const script = await previewSyncScriptPromise;

  const excludedTablesMatch = script.match(
    /const EXCLUDED_PUBLIC_TABLES = \[([\s\S]*?)\];/,
  );

  assert.ok(
    excludedTablesMatch?.[1],
    "EXCLUDED_PUBLIC_TABLES definition should exist",
  );

  const excludedTablesBody = excludedTablesMatch[1];

  for (const table of WALLET_PREVIEW_LOCAL_TABLES) {
    assert.match(
      excludedTablesBody,
      new RegExp(`"${table}"`),
      `${table} should remain excluded from Preview sync`,
    );
  }

  assert.match(
    script,
    /for \(const table of EXCLUDED_PUBLIC_TABLES\)\s*\{\s*args\.push\("-x", `\$\{PUBLIC_SCHEMA\}\.\$\{table\}`\);\s*\}/,
  );
  assert.match(
    script,
    /tables\.filter\(\(table\) => !EXCLUDED_PUBLIC_TABLES\.includes\(table\)\)/,
  );
});
