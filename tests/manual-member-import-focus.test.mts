import assert from "node:assert/strict";
import test from "node:test";
import {
  getManualMemberImportErrorFocusField,
} from "@/lib/member-manual-import/focus";

test("수동 회원 가져오기 오류는 해당 입력 컨트롤로 초점을 돌린다", () => {
  assert.equal(getManualMemberImportErrorFocusField("generation_invalid"), "generation");
  assert.equal(getManualMemberImportErrorFocusField("campus_invalid"), "campus");
  assert.equal(getManualMemberImportErrorFocusField("email_invalid"), "email");
  assert.equal(getManualMemberImportErrorFocusField("photo_missing"), "photo");
  assert.equal(getManualMemberImportErrorFocusField("batch_limit_exceeded"), null);
});
