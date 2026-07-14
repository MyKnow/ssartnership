import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMattermostProfileSyncPatch,
  buildMemberIdentifierReservations,
  classifyMemberLoginIdentifier,
  isActiveMember,
  normalizeMemberEmail,
  normalizeMemberGeneration,
} from "@/lib/member-domain";

test("회원 이메일은 공백을 제거하고 소문자 식별자로 정규화한다", () => {
  assert.equal(normalizeMemberEmail(" User.Name@Example.COM "), "user.name@example.com");
  assert.equal(normalizeMemberEmail(""), null);
  assert.equal(normalizeMemberEmail("not-an-email"), null);
});

test("로그인 식별자는 이메일, 직접 생성 ID, Mattermost 아이디를 명확히 구분한다", () => {
  assert.deepEqual(classifyMemberLoginIdentifier(" User@Example.com "), {
    kind: "email",
    value: "user@example.com",
  });
  assert.deepEqual(classifyMemberLoginIdentifier(" MANUAL-Seoul.001 "), {
    kind: "manual_login_id",
    value: "manual-seoul.001",
  });
  assert.deepEqual(classifyMemberLoginIdentifier(" @MyKnow "), {
    kind: "mattermost_username",
    value: "myknow",
  });
  assert.equal(classifyMemberLoginIdentifier("invalid username"), null);
});

test("기수는 0~99 정수만 허용하고 운영진 0을 보존한다", () => {
  assert.equal(normalizeMemberGeneration(0), 0);
  assert.equal(normalizeMemberGeneration("15"), 15);
  assert.equal(normalizeMemberGeneration("15.5"), null);
  assert.equal(normalizeMemberGeneration(100), null);
});

test("soft-deleted 회원은 유효한 세션 대상이 아니다", () => {
  assert.equal(isActiveMember({ id: "member-1", deletedAt: null }), true);
  assert.equal(isActiveMember({ id: "member-1", deletedAt: "2026-07-13T00:00:00.000Z" }), false);
  assert.equal(isActiveMember({ id: "", deletedAt: null }), false);
});

test("명시적 MM 동기화는 프로필 원장에 바뀐 필드만 반영한다", () => {
  assert.deepEqual(
    buildMattermostProfileSyncPatch(
      {
        displayName: "기존 이름",
        mmUsername: "old-id",
      },
      {
        displayName: "새 이름",
        campus: "서울",
        mmUsername: "new-id",
      },
    ),
    {
      member: { display_name: "새 이름" },
      mattermost: { mm_username: "new-id" },
      changedFields: ["displayName", "mmUsername"],
    },
  );
});

test("탈퇴 회원의 외부 식별자는 원문 없이 종류별 HMAC 예약값으로 만든다", () => {
  const reservations = buildMemberIdentifierReservations(
    {
      emailNormalized: "member@example.com",
      mmUserId: "mm-user-id",
      mmUsername: "member",
      ssafySub: "ssafy-subject",
    },
    "a-secure-test-secret-that-is-long-enough",
  );

  assert.deepEqual(
    reservations.map((item) => item.identifierKind),
    ["email", "mm_user_id", "mm_username", "ssafy_sub"],
  );
  assert.ok(reservations.every((item) => /^[0-9a-f]{64}$/.test(item.identifierHash)));
  assert.ok(reservations.every((item) => !item.identifierHash.includes("member")));
});
