import assert from "node:assert/strict";
import test from "node:test";

import {
  encodeAdminLogsCursor,
  parseAdminLogsCursor,
} from "../src/lib/log-insights/cursor.ts";

test("관리자 로그 커서는 정렬 키를 불투명한 URL 값으로 왕복한다", () => {
  const cursor = {
    createdAt: "2026-07-27T06:00:00.000Z",
    id: "11111111-1111-4111-8111-111111111111",
  };
  const encoded = encodeAdminLogsCursor(cursor);

  assert.equal(parseAdminLogsCursor(encoded)?.createdAt, cursor.createdAt);
  assert.equal(parseAdminLogsCursor(encoded)?.id, cursor.id);
  assert.equal(parseAdminLogsCursor("not-a-cursor"), null);
  assert.equal(parseAdminLogsCursor(`${encodeURIComponent(cursor.createdAt)}:not-a-uuid`), null);
});
