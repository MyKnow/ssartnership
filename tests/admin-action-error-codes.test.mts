import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  adminActionErrorMessages,
  adminAdCampaignErrorMessages,
  adminPartnerCouponErrorMessages,
  getAdminActionErrorMessage,
  getSafeAdminActionErrorCode,
  isAdminActionErrorCode,
} from "@/lib/admin-action-errors";
import { getAdminReviewQueueFeedback } from "@/lib/admin-review-queue";
import { getNotificationTemplateFeedback } from "@/lib/notification-templates/admin-feedback";
import { partnerFormErrorMessages } from "@/lib/partner-form-errors";
import { pickAllowedEntry, pickAllowedMessage } from "@/lib/safe-messages";

const CODE_PATTERN = /^[a-z][a-z0-9_]{0,79}$/u;
const GENERIC_REVIEW_FEEDBACK = getAdminReviewQueueFeedback({ error: "__unknown__" });
const GENERIC_TEMPLATE_FEEDBACK = getNotificationTemplateFeedback({ error: "__unknown__" });

function isKnownRedirectCode(code: string) {
  return [
    adminActionErrorMessages,
    adminPartnerCouponErrorMessages,
    adminAdCampaignErrorMessages,
    partnerFormErrorMessages,
  ].some((messages) => Object.hasOwn(messages, code))
    || getAdminReviewQueueFeedback({ error: code }) !== GENERIC_REVIEW_FEEDBACK
    || getNotificationTemplateFeedback({ error: code }) !== GENERIC_TEMPLATE_FEEDBACK;
}

function listSourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) return listSourceFiles(child);
    return /\.(?:ts|tsx)$/u.test(entry.name) ? [child] : [];
  });
}

test("관리자 오류 코드 맵은 redirect 가능한 코드 모양과 한국어 문구만 담는다", () => {
  for (const messages of [
    adminActionErrorMessages,
    adminPartnerCouponErrorMessages,
    adminAdCampaignErrorMessages,
    partnerFormErrorMessages,
  ]) {
    for (const [code, message] of Object.entries(messages)) {
      assert.match(code, CODE_PATTERN, code);
      assert.ok(message.trim().length > 0, code);
      assert.match(message, /[가-힣]/u, code);
    }
  }
});

test("오류 문구 조회는 own property만 보고 prototype 키를 문구로 쓰지 않는다", () => {
  assert.equal(
    getAdminActionErrorMessage("partner_update_failed"),
    adminActionErrorMessages.partner_update_failed,
  );
  for (const key of ["toString", "constructor", "__proto__", "hasOwnProperty", "", null, 42]) {
    assert.equal(getAdminActionErrorMessage(key), null, String(key));
    assert.equal(isAdminActionErrorCode(key), false, String(key));
  }
  assert.equal(pickAllowedEntry({ ok: "허용" }, "toString"), null);
  assert.equal(getAdminReviewQueueFeedback({ error: "constructor" }), GENERIC_REVIEW_FEEDBACK);
  assert.equal(getNotificationTemplateFeedback({ status: "toString" }), null);
});

test("pickAllowedMessage는 allowlist 문구만 통과시킨다", () => {
  assert.equal(pickAllowedMessage("허용 문구", ["허용 문구"], "기본"), "허용 문구");
  assert.equal(pickAllowedMessage("허용 문구", new Set(["허용 문구"]), "기본"), "허용 문구");
  assert.equal(pickAllowedMessage("relation does not exist", ["허용 문구"], "기본"), "기본");
  assert.equal(pickAllowedMessage(undefined, ["허용 문구"], "기본"), "기본");
});

test("getSafeAdminActionErrorCode는 코드 모양만 동적 코드로 통과시킨다", () => {
  assert.equal(getSafeAdminActionErrorCode(new Error("partner_form_missing_name"), "partner_update_failed"), "partner_form_missing_name");
  assert.equal(getSafeAdminActionErrorCode(new Error("relation \"x\" does not exist"), "partner_update_failed"), "partner_update_failed");
  assert.equal(getSafeAdminActionErrorCode("partner_form_missing_name", "partner_update_failed"), "partner_update_failed");
});

test("관리자 server action이 redirect·fallback·throw하는 정적 코드는 모두 메시지 맵에 있다", () => {
  const adminRoot = new URL("../src/app/admin/", import.meta.url);
  const unknownCodes = new Set<string>();

  for (const file of listSourceFiles(adminRoot)) {
    const source = readFileSync(file, "utf8");
    const relative = file.href.slice(adminRoot.href.length);
    const literalCodes = [
      ...source.matchAll(/redirectAdminActionError\(\s*[^,()]+(?:\([^()]*\))?,\s*"([a-z][a-z0-9_]*)"/gu),
      ...source.matchAll(/getSafeAdminActionErrorCode\(\s*\w+,\s*"([a-z][a-z0-9_]*)"/gu),
      ...(source.includes("getSafeAdminActionErrorCode")
        ? source.matchAll(/throw new Error\("([a-z][a-z0-9_]*)"\)/gu)
        : []),
    ].map((match) => match[1]);

    for (const code of literalCodes) {
      if (!isKnownRedirectCode(code)) unknownCodes.add(`${relative}: ${code}`);
    }
  }

  assert.deepEqual([...unknownCodes], []);
});
