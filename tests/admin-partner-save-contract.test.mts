import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin partner update requires the atomic RPC to confirm the requested row before redirecting", async () => {
  const source = await readFile(
    new URL(
      "../src/app/admin/(protected)/_actions/partner-actions/update.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /\.rpc\(\s*"update_partner_with_benefits_atomic"/);
  assert.match(source, /p_partner_id:\s*id/);
  assert.match(source, /if \(updatedPartnerId !== id\)/);
});
