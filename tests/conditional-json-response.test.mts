import assert from "node:assert/strict";
import test from "node:test";
import { conditionalJsonResponse } from "../src/lib/conditional-json-response.ts";

test("조건부 JSON 응답은 사용자 전용 ETag와 재검증 헤더를 제공한다", async () => {
  const request = new Request("https://example.test/admin/items");
  const response = conditionalJsonResponse(request, { items: [1, 2] });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-cache");
  assert.equal(response.headers.get("Vary"), "Cookie");
  assert.match(response.headers.get("ETag") ?? "", /^"[A-Za-z0-9_-]+"$/);
  assert.deepEqual(await response.json(), { items: [1, 2] });
});

test("일치하는 If-None-Match에는 본문 없이 304를 반환한다", async () => {
  const firstResponse = conditionalJsonResponse(
    new Request("https://example.test/admin/items"),
    { items: [1, 2] },
  );
  const entityTag = firstResponse.headers.get("ETag");
  assert.ok(entityTag);

  const revalidatedResponse = conditionalJsonResponse(
    new Request("https://example.test/admin/items", {
      headers: { "If-None-Match": entityTag },
    }),
    { items: [1, 2] },
  );

  assert.equal(revalidatedResponse.status, 304);
  assert.equal(await revalidatedResponse.text(), "");
  assert.equal(revalidatedResponse.headers.get("ETag"), entityTag);
  assert.equal(revalidatedResponse.headers.get("Content-Type"), null);
});
