import test from "node:test";
import assert from "node:assert/strict";
import { buildAdminPushTabHref } from "../src/lib/admin-operation-paths";

test("관리자 발송 탭 이동은 기존 query를 보존하고 tab만 교체한다", () => {
  assert.equal(
    buildAdminPushTabHref("returnTo=%2Fadmin%2Fnotifications&status=ready", "send"),
    "/admin/push?returnTo=%2Fadmin%2Fnotifications&status=ready&tab=send",
  );
});

test("관리자 발송 탭 이동은 같은 tab을 중복 추가하지 않는다", () => {
  assert.equal(
    buildAdminPushTabHref(new URLSearchParams("tab=center&query=%ED%85%8C%EC%8A%A4%ED%8A%B8"), "logs"),
    "/admin/push?tab=logs&query=%ED%85%8C%EC%8A%A4%ED%8A%B8",
  );
});
