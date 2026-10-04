import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PARTNER_REGISTRATION_STATUS_OPTIONS,
  canTransitionPartnerRegistrationStatus,
  getAllowedPartnerRegistrationStatusTransitions,
  isPartnerRegistrationTerminalStatus,
} from "../src/lib/partner-registration.ts";
import { getAdminReviewQueueFeedback } from "../src/lib/admin-review-queue.ts";

const root = new URL("..", import.meta.url);

test("등록 완료(converted)는 종료 상태라 다른 상태로 되돌릴 수 없다", () => {
  assert.equal(isPartnerRegistrationTerminalStatus("converted"), true);
  assert.deepEqual(getAllowedPartnerRegistrationStatusTransitions("converted"), [
    "converted",
  ]);
  for (const next of PARTNER_REGISTRATION_STATUS_OPTIONS) {
    assert.equal(
      canTransitionPartnerRegistrationStatus("converted", next),
      next === "converted",
      `converted → ${next}`,
    );
  }
});

test("종료 전 상태는 검토 흐름 안에서 자유롭게 오가고 등록 완료로 전환할 수 있다", () => {
  for (const from of ["pending", "in_review", "rejected", "archived"] as const) {
    assert.equal(isPartnerRegistrationTerminalStatus(from), false);
    assert.deepEqual(
      [...getAllowedPartnerRegistrationStatusTransitions(from)],
      [...PARTNER_REGISTRATION_STATUS_OPTIONS],
    );
    assert.equal(canTransitionPartnerRegistrationStatus(from, "converted"), true);
  }
});

test("허용되지 않은 전이 거부는 안전한 안내 문구로 표시된다", () => {
  assert.deepEqual(
    getAdminReviewQueueFeedback({ error: "partner_form_status_locked" }),
    {
      tone: "info",
      title: "등록 완료 신청은 처리 상태를 바꿀 수 없습니다",
      description:
        "이미 제휴처로 등록된 신청입니다. 제휴처 정보와 공개 상태는 제휴처 상세 화면에서 관리해 주세요.",
    },
  );
});

test("상태 저장 action은 갱신 전에 전이를 검사하고 상태 변경을 감사 기록한다", async () => {
  const [action, view] = await Promise.all([
    readFile(
      new URL("src/app/admin/(protected)/partner-registrations/actions.ts", root),
      "utf8",
    ),
    readFile(new URL("src/components/admin/AdminPartnerRegistrationsView.tsx", root), "utf8"),
  ]);

  const transitionGuard = action.indexOf(
    "canTransitionPartnerRegistrationStatus(previousStatus, status)",
  );
  const statusUpdate = action.indexOf(".update(payload)");
  assert.ok(transitionGuard >= 0);
  assert.ok(transitionGuard < statusUpdate);
  assert.match(action, /"partner_form_status_locked"/);
  assert.match(
    action,
    /logAdminAction\("partner_update", \{\s*targetType: "partner_registration_request",[\s\S]{0,200}changeType: "status"/,
  );
  assert.match(view, /getAllowedPartnerRegistrationStatusTransitions\(rowStatus\)/);
  assert.match(view, /등록 완료 후에는 처리 상태를 되돌릴 수 없습니다/);
});
