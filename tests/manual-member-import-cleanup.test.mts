import assert from "node:assert/strict";
import test from "node:test";

import { getRetrySafeExpirableBatchIds } from "../src/lib/member-manual-import/cleanup.ts";

test("임시 파일 삭제에 실패한 수동 등록 배치는 다음 정리 작업을 위해 만료 처리하지 않는다", () => {
  assert.deepEqual(
    getRetrySafeExpirableBatchIds(
      ["batch-ready", "batch-retry", "batch-empty"],
      new Set(["batch-retry"]),
    ),
    ["batch-ready", "batch-empty"],
  );
});
