import assert from "node:assert/strict";
import test from "node:test";
import {
  getManualMemberImportDuplicateKind,
} from "../src/lib/member-manual-import/duplicate.ts";

test("수동 회원 추가는 MM 계정 중복을 별도 복구 가능한 도메인 상태로 분류한다", () => {
  assert.equal(
    getManualMemberImportDuplicateKind({ message: "existing_mattermost" }),
    "mattermost",
  );
});

test("수동 회원 추가는 이메일 중복을 별도 복구 가능한 도메인 상태로 분류한다", () => {
  assert.equal(
    getManualMemberImportDuplicateKind({ message: "existing_email" }),
    "email",
  );
});

test("알 수 없는 저장소 오류는 중복 회원으로 오인하지 않는다", () => {
  assert.equal(
    getManualMemberImportDuplicateKind({ message: "manual_member_import_row_lease_lost" }),
    null,
  );
});
