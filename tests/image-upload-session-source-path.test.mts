import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("이미지 업로드 세션은 원본 staging 경로를 별도로 보존한다", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260721120457_separate_image_upload_source_path.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /add column if not exists source_storage_path text/i);
  assert.match(migration, /source_storage_path\s*=\s*storage_path/i);
});
