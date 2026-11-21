import assert from "node:assert/strict";
import test from "node:test";
import { isRetryableManualMemberImportRow, replaceImportResultItem } from "@/lib/member-manual-import/results";
import { getSafeFailureMessage, ManualMemberImportDeliveryOutcomeUnknownError } from "@/lib/member-manual-import/errors";
import type { ManualMemberImportCommitItem, ManualMemberImportCommitResult } from "@/lib/member-manual-import/types";

const item = (rowNumber: number, status: ManualMemberImportCommitItem["status"], retryable = false): ManualMemberImportCommitItem => ({
  rowNumber, status, name: "테스트 회원", mmId: null, email: "test@example.com",
  deliveryChannel: "email", reason: null, retryable, existingMemberId: null,
});

test("가져오기 재시도는 대기 행과 일반 실패에만 열리고 중복·전송 미확인 행은 제외한다", () => {
  for (const [status, error_code, expected] of [
    ["staged", null, true], ["failed", "member_create_failed", true],
    ["failed", "delivery_outcome_unknown", false], ["failed", "already_registered", false],
    ["created", null, false], ["processing", null, false],
  ] as const) {
    assert.equal(isRetryableManualMemberImportRow({ status, error_code }), expected);
  }
});

test("재발급 성공은 해당 행과 집계만 교체하고 다른 실패와 기존 회원을 유지한다", () => {
  const original: ManualMemberImportCommitResult = {
    batchId: "batch", total: 4, success: 1, failed: 2, alreadyExists: 1, retryableFailures: 1,
    items: [item(2, "success"), item(3, "failed"), item(4, "failed", true), item(5, "already_exists")],
  };
  const replacement = item(3, "success");
  const result = replaceImportResultItem(original, replacement);
  assert.deepEqual([result.total, result.success, result.failed, result.alreadyExists, result.retryableFailures], [4, 2, 1, 1, 1]);
  assert.equal(result.items[1], replacement);
  assert.equal(result.items[2], original.items[2]);
  assert.equal(original.items[1]?.status, "failed");
  assert.equal(original.failed, 2);
  assert.equal(replaceImportResultItem(result, replacement).success, 2);
});

test("예상 가능한 오류만 안내하고 공급자 오류의 내부 내용은 노출하지 않는다", () => {
  assert.equal(getSafeFailureMessage(new Error("database password=secret")), "회원 생성에 실패했습니다.");
  assert.equal(getSafeFailureMessage(new Error("SMTP credential secret")), "이메일 알림을 보낼 수 없습니다.");
  assert.equal(getSafeFailureMessage(new Error("사진 목록이 일치하지 않습니다.")), "사진 목록이 일치하지 않습니다.");
  const unknown = new ManualMemberImportDeliveryOutcomeUnknownError();
  assert.equal(getSafeFailureMessage(unknown), unknown.message);
});
