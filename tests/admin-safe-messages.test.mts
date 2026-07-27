import test from "node:test";
import assert from "node:assert/strict";
import {
  getSafeAdminMessage,
  getSafeAdminResponseMessage,
} from "../src/lib/admin-safe-messages";
import { getSafeAdminActionErrorCode } from "../src/lib/admin-action-errors";
import { readFile } from "node:fs/promises";

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

test("관리자 redirect 경계는 내부 오류 문장을 오류 코드로 전달하지 않는다", () => {
  assert.equal(
    getSafeAdminActionErrorCode(new Error("relation ad_coupons does not exist"), "admin_action_failed"),
    "admin_action_failed",
  );
  assert.equal(
    getSafeAdminActionErrorCode(new Error("partner_form_missing_name"), "partner_form_invalid_request"),
    "partner_form_missing_name",
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

test("관리자 API는 내부 오류 원문 대신 안전한 복구 문구를 반환한다", async () => {
  const [couponCodesSource, pushSubscribeSource] = await Promise.all([
    readFile(
      new URL("../src/app/api/admin/ad-coupons/[couponId]/codes/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/app/api/admin/push/subscribe/route.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.doesNotMatch(couponCodesSource, /error\.message/);
  assert.doesNotMatch(pushSubscribeSource, /error\.message/);
  assert.match(couponCodesSource, /코드 업로드에 실패했습니다\./);
  assert.match(pushSubscribeSource, /알림 구독에 실패했습니다\./);
});
