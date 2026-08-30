import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("review reaction and filtered summary queries run in parallel", async () => {
  const source = await readFile(
    new URL(
      "../src/lib/repositories/supabase/partner-review-repository.supabase.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    source,
    /const \[reactionStates, summary\] = await Promise\.all\(\[\s*getReviewReactionStates\([\s\S]*?getFilteredReviewSummary\(/,
  );
  assert.match(source, /rpc\("get_partner_review_summary"/);
  assert.doesNotMatch(source, /\.select\("rating"\)/);
});

test("review summary aggregation stays in the database and service-role boundary", async () => {
  const [migration, schema] = await Promise.all([
    readFile(
      new URL(
        "../supabase/migrations/20260831083528_add_partner_review_summary_rpc.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  ]);

  for (const source of [migration, schema]) {
    assert.match(source, /get_partner_review_summary/);
    assert.match(source, /count\(\*\) filter \(where reviews\.rating = 5\)/);
    assert.match(
      source,
      /revoke all on function public\.get_partner_review_summary\(uuid, integer, boolean\) from public/,
    );
    assert.match(
      source,
      /grant execute on function public\.get_partner_review_summary\(uuid, integer, boolean\) to service_role/,
    );
  }
});
