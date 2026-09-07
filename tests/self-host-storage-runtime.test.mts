import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("self-host Storage runtime preserves the original Preview schema generation and rejects automatic history rewrites", () => {
  const compose = readFileSync(new URL("../compose.supabase.yaml", import.meta.url), "utf8");
  assert.ok(/image: supabase\/storage-api:v1\.73\.1@sha256:c24fb33cc2fa38d0f9582a30312907fc56da333fb9ba0646833186197e4982f3/.test(compose), "pin the schema-compatible Storage image");
  assert.ok(/DB_ALLOW_MIGRATION_REFRESH: "false"/.test(compose), "reject automatic migration hash refresh");
  assert.ok(/LOG_LEVEL: warn/.test(compose), "avoid routine object paths in Storage access logs");
});
