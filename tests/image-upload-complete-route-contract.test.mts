import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("공통 이미지 완료 라우트는 처리 중 상태를 문자열이 아니라 안정적인 오류 코드로 판별한다", async () => {
  const [routeSource, repositorySource] = await Promise.all([
    readFile(new URL("src/app/api/uploads/images/complete/route.ts", root), "utf8"),
    readFile(new URL("src/lib/image-upload/repository.supabase.ts", root), "utf8"),
  ]);

  assert.match(routeSource, /ImageUploadError/);
  assert.match(
    routeSource,
    /error instanceof ImageUploadError\s*&& error\.code === "upload_processing"/,
  );
  assert.doesNotMatch(routeSource, /error\.message\.includes\("처리 중"\)/);

  assert.match(repositorySource, /new ImageUploadError\(\s*"upload_processing"/);
});
