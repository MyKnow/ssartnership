import assert from "node:assert/strict";
import test from "node:test";
import { buildManualMemberPayload } from "@/lib/member-manual-add/provision";

test("수동 회원 추가 payload는 정규화된 MM 디렉터리 FK와 세대만 기록한다", () => {
  const payload = buildManualMemberPayload({
    mattermostAccountId: "b9a76472-8ed8-4e9a-b2c2-0339d3b81735",
    displayName: "홍길동",
    campus: "seoul",
    generation: 15,
    staffSourceGeneration: null,
    passwordHash: "hash",
    passwordSalt: "salt",
    now: "2026-07-13T12:00:00.000Z",
  });

  assert.deepEqual(payload, {
    mattermost_account_id: "b9a76472-8ed8-4e9a-b2c2-0339d3b81735",
    display_name: "홍길동",
    generation: 15,
    staff_source_generation: null,
    campus: "seoul",
    password_hash: "hash",
    password_salt: "salt",
    must_change_password: true,
    updated_at: "2026-07-13T12:00:00.000Z",
  });
  assert.equal("year" in payload, false);
  assert.equal("mm_user_id" in payload, false);
  assert.equal("mm_username" in payload, false);
  assert.equal("avatar_base64" in payload, false);
});
