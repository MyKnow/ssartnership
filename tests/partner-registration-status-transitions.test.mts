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

test("전환 실패 뒤 상태 복원까지 실패하면 되돌렸다고 안내하지 않고 복원 여부를 감사 기록한다", async () => {
  // A request left in the terminal state cannot be reverted from the queue,
  // so the failure feedback must not claim the status was restored.
  const unrestored = getAdminReviewQueueFeedback({
    error: "partner_form_conversion_status_unrestored",
  });
  assert.equal(unrestored?.tone, "danger");
  assert.match(unrestored?.title ?? "", /되돌리지 못했습니다/);
  assert.match(unrestored?.description ?? "", /운영 담당자에게 신청 상태 복구를 요청/);
  assert.doesNotMatch(unrestored?.description ?? "", /되돌렸습니다/);

  const action = await readFile(
    new URL("src/app/admin/(protected)/partner-registrations/actions.ts", root),
    "utf8",
  );
  assert.match(
    action,
    /rollbackSucceeded\s*\?\s*"partner_form_conversion_failed"\s*:\s*"partner_form_conversion_status_unrestored"/,
  );
  assert.match(action, /statusRestored: rollbackSucceeded/);
});
