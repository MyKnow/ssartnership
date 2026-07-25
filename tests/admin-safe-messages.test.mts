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
