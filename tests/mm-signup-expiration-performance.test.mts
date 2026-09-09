import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("가입 승인 만료 처리는 DB batch와 bounded cleanup을 함께 사용한다", async () => {
  const [repository, migration, schema] = await Promise.all([
    readFile(
      new URL("../src/lib/mm-signup-approval/repository.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260830234631_limit_signup_approval_expiration_batch.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  ]);

  assert.match(repository, /p_limit: EXPIRED_APPROVAL_BATCH_SIZE/);
  assert.match(repository, /EXPIRED_APPROVAL_CLEANUP_CONCURRENCY = 4/);
  assert.match(repository, /forEachWithConcurrency\(/);
  assert.doesNotMatch(repository, /for \(const row of rows\)/);

  for (const sql of [migration, schema]) {
    assert.match(sql, /p_limit integer default 100/);
    assert.match(sql, /limit least\(greatest\(coalesce\(p_limit, 100\), 1\), 100\)/);
    assert.match(sql, /profile_image_owner_id/);
    assert.match(
      sql,
      /expire_pending_member_signup_approval_requests\(timestamp with time zone, integer\)/,
    );
  }
});
