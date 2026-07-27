import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminDataUnavailableReason,
} from "../src/lib/admin-observability.ts";

test("관리자 보조 집계 오류는 제한된 복구 reason code로 정규화한다", () => {
  assert.equal(
    getAdminDataUnavailableReason({
      code: "PGRST202",
      message: "Could not find the function in the schema cache",
    }),
    "migration_pending",
  );
  assert.equal(
    getAdminDataUnavailableReason(new DOMException("The operation was aborted", "TimeoutError")),
    "timeout",
  );
  assert.equal(
    getAdminDataUnavailableReason({ code: "57014", message: "statement failed" }),
    "query_failed",
  );
  assert.equal(getAdminDataUnavailableReason(null), "unexpected_failure");
});
