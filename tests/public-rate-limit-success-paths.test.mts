import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("공개 제휴 등록 성공 경로는 rate limit 실패 카운트를 누적하지 않는다", async () => {
  const source = await read("src/app/(site)/partner-registration/actions.ts");

  assert.match(
    source,
    /await recordAttempt\(identifier, true, PARTNER_REGISTRATION_RATE_LIMIT\);/,
  );
  assert.equal(
    source.match(
      /await recordAttempt\(identifier, true, PARTNER_REGISTRATION_RATE_LIMIT\);/g,
    )?.length,
    2,
  );
});

test("제휴 제안 성공 경로는 rate limit 실패 카운트를 해제한다", async () => {
  const source = await read("src/app/api/suggest/route.ts");

  assert.match(
    source,
    /await recordAttempt\(identifier, true, SUGGEST_RATE_LIMIT\);/,
  );
});
