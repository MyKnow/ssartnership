import test from "node:test";
import assert from "node:assert/strict";
import {
  getSafeAdminMessage,
  getSafeAdminResponseMessage,
} from "../src/lib/admin-safe-messages";

test("관리자 UI는 서버 내부 오류 메시지를 fallback으로 치환한다", () => {
  assert.equal(
    getSafeAdminMessage(new Error("postgres connection string: secret"), "작업에 실패했습니다."),
    "작업에 실패했습니다.",
  );
  assert.equal(
    getSafeAdminResponseMessage("relation does not exist", "발송 검토에 실패했습니다."),
    "발송 검토에 실패했습니다.",
  );
});

test("관리자 UI가 허용한 사용자 안내 문구는 유지한다", () => {
  assert.equal(
    getSafeAdminMessage(new Error("푸시 채널이 아직 설정되지 않았습니다."), "작업에 실패했습니다."),
    "푸시 채널이 아직 설정되지 않았습니다.",
  );
});

test("관리자 회원 가져오기는 계약된 오류만 필드 복구 안내로 유지한다", () => {
  assert.equal(
    getSafeAdminResponseMessage(
      "회원 생성 권한이 필요합니다.",
      "회원 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    ),
    "회원 생성 권한이 필요합니다.",
  );
  assert.equal(
    getSafeAdminResponseMessage(
      "database: member_import_batches is missing",
      "회원 행 검증에 실패했습니다. 입력 항목을 확인한 뒤 다시 시도해 주세요.",
    ),
    "회원 행 검증에 실패했습니다. 입력 항목을 확인한 뒤 다시 시도해 주세요.",
  );
});
