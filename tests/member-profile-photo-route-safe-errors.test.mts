import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("본인 사진 변경 API는 의도된 서비스 오류만 노출하고 raw error.message는 숨긴다", async () => {
  const source = await readFile(
    new URL("src/app/api/certification/photo/route.ts", root),
    "utf8",
  );

  assert.match(source, /GraduateVerificationServiceError/);
  assert.match(
    source,
    /error instanceof GraduateVerificationServiceError\s*\?\s*error\.message\s*:\s*"본인 사진 변경 요청을 저장하지 못했습니다\."/,
  );
  assert.doesNotMatch(
    source,
    /message:\s*error instanceof Error \? error\.message/,
  );
});
