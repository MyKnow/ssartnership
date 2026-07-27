import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ADMIN_PENDING_REQUEST_SELECT } from "../src/lib/partner-change-requests/shared.ts";

test("제휴 등록 신청 큐는 명시적 projection으로 목록 응답을 제한한다", async () => {
  const source = await readFile(
    new URL("../src/lib/admin-partner-registration-queue.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /\"\*\"/);
  for (const field of [
    "id",
    "status",
    "brand_name",
    "category_label",
    "location",
    "benefits",
    "conditions",
    "admin_note",
  ]) {
    assert.match(source, new RegExp(`\\\"${field}\\\"`));
  }
});

test("변경 요청 관리자 큐는 승인 판단에 필요한 snapshot만 조회한다", () => {
  assert.doesNotMatch(ADMIN_PENDING_REQUEST_SELECT, /\*/);
  assert.match(ADMIN_PENDING_REQUEST_SELECT, /current_conditions/);
  assert.match(ADMIN_PENDING_REQUEST_SELECT, /requested_benefits/);
  assert.match(ADMIN_PENDING_REQUEST_SELECT, /requested_by:/);
  assert.doesNotMatch(ADMIN_PENDING_REQUEST_SELECT, /current_images/);
  assert.doesNotMatch(ADMIN_PENDING_REQUEST_SELECT, /requested_images/);
  assert.doesNotMatch(ADMIN_PENDING_REQUEST_SELECT, /partner_benefits/);
});

test("등록 신청 화면은 핵심 상태 저장과 상세 증빙을 분리한다", async () => {
  const source = await readFile(
    new URL(
      "../src/components/admin/AdminPartnerRegistrationsView.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /<details className=/);
  assert.match(source, /신청 상세 확인/);
  assert.match(source, /name="status"/);
  assert.match(source, /name="adminNote"/);
});
