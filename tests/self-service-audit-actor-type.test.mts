import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

function getAuditCall(source: string, action: string) {
  const actionIndex = source.indexOf(`"${action}"`);
  assert.notEqual(actionIndex, -1, `${action} audit call must exist`);

  const callStart = source.lastIndexOf("logAdminAudit({", actionIndex);
  assert.notEqual(callStart, -1, `${action} audit call must have a start`);
  const lineStart = source.lastIndexOf("\n", callStart) + 1;
  const indentation = source.slice(lineStart, callStart).match(/^ */)?.[0] ?? "";
  const callEnd = source.indexOf(`\n${indentation}});`, actionIndex);
  assert.notEqual(callEnd, -1, `${action} audit call must have an end`);
  return source.slice(callStart, callEnd);
}

test("회원 본인 프로필 동기화 감사 로그는 회원 주체로 기록한다", () => {
  const source = read("src/app/api/mm/profile-sync/route.ts");

  for (const action of ["member_email_login_transition", "member_sync"]) {
    assert.match(getAuditCall(source, action), /actorType:\s*"member"/);
  }
});

test("파트너 자체 요청과 리뷰 처리 감사 로그는 파트너 주체로 기록한다", () => {
  const callSites = [
    {
      path: "src/app/partner/services/[partnerId]/request/_actions/cancel.ts",
      action: "partner_portal_change_request_cancel",
    },
    {
      path: "src/app/partner/services/[partnerId]/request/_actions/approval.ts",
      action: "partner_portal_change_request_submit",
    },
    {
      path: "src/app/api/partner/reviews/[reviewId]/route.ts",
      action: "partner_portal_review_hide",
    },
  ];

  for (const { path, action } of callSites) {
    assert.match(getAuditCall(read(path), action), /actorType:\s*"partner"/, path);
  }
});
