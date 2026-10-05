import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  MEMBER_EMAIL_CHANGE_NOTICE_EVENT_KEY,
  maskMemberEmailForNotice,
  resolveMemberEmailChangeNotice,
} from "../src/lib/member-email-change-notice.ts";
import { getNotificationTemplateDefinition } from "../src/lib/notification-templates/catalog.ts";

const read = (relative: string) =>
  readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");

const verifiedPrevious = {
  emailNormalized: "old@example.com",
  emailVerifiedAt: "2026-09-01T00:00:00.000Z",
  displayName: "김싸피",
};

test("이메일 변경 알림은 새 주소를 일부만 보여준다", () => {
  assert.equal(maskMemberEmailForNotice("newmember@example.com"), "ne***@example.com");
  assert.equal(maskMemberEmailForNotice("ab@example.com"), "a***@example.com");
  assert.equal(maskMemberEmailForNotice("a@example.com"), "a***@example.com");
  assert.equal(maskMemberEmailForNotice("not-an-email"), "***");
  assert.equal(maskMemberEmailForNotice("@example.com"), "***");
  assert.equal(maskMemberEmailForNotice("trailing@"), "***");
});

test("이전에 인증한 이메일이 다른 주소로 바뀔 때만 이전 주소로 알린다", () => {
  assert.deepEqual(
    resolveMemberEmailChangeNotice(verifiedPrevious, "new@example.com"),
    {
      to: "old@example.com",
      displayName: "김싸피",
      maskedNewEmail: "ne***@example.com",
    },
  );
  // Same address (re-verification) is not a change.
  assert.equal(resolveMemberEmailChangeNotice(verifiedPrevious, "old@example.com"), null);
  assert.equal(resolveMemberEmailChangeNotice(verifiedPrevious, " OLD@example.com "), null);
  // First binding, unverified previous address, or unreadable state: nobody to notify.
  assert.equal(resolveMemberEmailChangeNotice(null, "new@example.com"), null);
  assert.equal(
    resolveMemberEmailChangeNotice({ ...verifiedPrevious, emailNormalized: null }, "new@example.com"),
    null,
  );
  assert.equal(
    resolveMemberEmailChangeNotice({ ...verifiedPrevious, emailVerifiedAt: null }, "new@example.com"),
    null,
  );
  assert.equal(
    resolveMemberEmailChangeNotice({ ...verifiedPrevious, displayName: "  " }, "new@example.com")
      ?.displayName,
    "회원",
  );
});

test("이메일 변경 알림 템플릿은 새 주소 원문 없이 일부 가린 값만 변수로 받는다", () => {
  const definition = getNotificationTemplateDefinition(MEMBER_EMAIL_CHANGE_NOTICE_EVENT_KEY);
  assert.ok(definition);
  assert.equal(definition.channel, "email");
  assert.deepEqual(
    definition.variables.map((variable) => variable.name),
    ["siteName", "displayName", "maskedNewEmail", "settingsUrl"],
  );
});

test("이메일 바인딩 route는 완료 전 이전 상태를 읽고 성공 뒤에만 알림을 예약한다", () => {
  for (const [relative, completion] of [
    ["src/app/api/member/email/verify/route.ts", "completeMemberEmailVerification("],
    ["src/app/api/member/recovery/email/verify/route.ts", "completeMemberEmailRecovery("],
  ] as const) {
    const source = read(relative);
    const readIndex = source.indexOf("await readPreviousMemberEmailState(");
    const completionIndex = source.indexOf(completion);
    const successLogIndex = source.indexOf('status: "success"');
    const scheduleIndex = source.indexOf("scheduleMemberEmailChangeNotice({");
    assert.ok(readIndex > 0 && readIndex < completionIndex, `${relative}: read before completion`);
    assert.ok(
      scheduleIndex > completionIndex && scheduleIndex > successLogIndex,
      `${relative}: notice only after a successful binding`,
    );
  }

  const server = read("src/lib/member-email-change-notice.server.ts");
  assert.match(server, /^import "server-only";/);
  // Delivery runs after the response and a failure is logged, never thrown.
  assert.match(server, /after\(deliver\)/);
  assert.match(server, /reason: "notice_delivery_failed"/);
  assert.match(server, /isE2eMockMutationEnabled\(\)/);
});
