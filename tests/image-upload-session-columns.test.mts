import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { IMAGE_UPLOAD_SESSION_COLUMNS } from "../src/lib/image-upload/repository.supabase.ts";

test("업로드 세션 조회는 매핑에 쓰는 열만 명시해 상태 전이마다 전체 행을 돌려받지 않는다", async () => {
  const source = await readFile(
    new URL("../src/lib/image-upload/repository.supabase.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /\.select\("\*"\)/);
  assert.equal(new Set(IMAGE_UPLOAD_SESSION_COLUMNS).size, IMAGE_UPLOAD_SESSION_COLUMNS.length);
  for (const column of ["id", "status", "storage_path", "source_storage_path", "final_url", "failure_code"]) {
    assert.ok(IMAGE_UPLOAD_SESSION_COLUMNS.includes(column as never), column);
  }
  for (const unused of ["created_at", "updated_at", "completed_at", "attached_at"]) {
    assert.ok(!IMAGE_UPLOAD_SESSION_COLUMNS.includes(unused as never), unused);
  }
});
