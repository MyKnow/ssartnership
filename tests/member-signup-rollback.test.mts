import assert from "node:assert/strict";
import test from "node:test";

import { rollbackCreatedSignupMember } from "../src/lib/member-signup-rollback.ts";

test("회원가입 후속 단계 실패 시 생성 회원을 삭제한다", async () => {
  const deleted: string[] = [];

  await rollbackCreatedSignupMember({
    memberId: "member-1",
    originalError: new Error("policy_failed"),
    deleteMember: async (memberId) => {
      deleted.push(memberId);
      return { error: null };
    },
  });

  assert.deepEqual(deleted, ["member-1"]);
});

test("회원가입 생성 회원 삭제 실패를 성공으로 숨기지 않는다", async () => {
  await assert.rejects(
    rollbackCreatedSignupMember({
      memberId: "member-2",
      originalError: new Error("session_failed"),
      deleteMember: async () => ({
        error: { code: "XX001", message: "delete failed" },
      }),
    }),
    (error: unknown) => {
      assert.equal((error as Error).message, "signup_member_cleanup_failed");
      return true;
    },
  );
});

test("회원가입 생성 회원 삭제가 예외를 던져도 정리 실패 코드로 수렴한다", async () => {
  await assert.rejects(
    rollbackCreatedSignupMember({
      memberId: "member-3",
      originalError: new Error("session_failed"),
      deleteMember: async () => {
        throw new Error("transport failed");
      },
    }),
    (error: unknown) => {
      assert.equal((error as Error).message, "signup_member_cleanup_failed");
      return true;
    },
  );
});
