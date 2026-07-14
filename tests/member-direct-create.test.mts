import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDirectMemberCreateAuditProperties,
  buildDirectMemberCreatePayload,
  validateDirectMemberCreateInput,
} from "@/lib/member-direct-create";

test("관리자 직접 회원 생성은 전용 로그인 ID와 정규화한 프로필 값을 만든다", () => {
  const result = validateDirectMemberCreateInput({
    loginId: "  MANUAL-seoul.001  ",
    displayName: "  홍길동  ",
    generation: "15",
    campus: "  서울  ",
    temporaryPassword: "SafePass1!",
    temporaryPasswordConfirmation: "SafePass1!",
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      manualLoginId: "manual-seoul.001",
      displayName: "홍길동",
      generation: 15,
      campus: "서울",
      temporaryPassword: "SafePass1!",
    },
  });
});

test("관리자 직접 회원 생성은 외부 계정명과 구분되지 않는 ID와 유효하지 않은 값을 막는다", () => {
  const result = validateDirectMemberCreateInput({
    loginId: "myknow",
    displayName: "",
    generation: "100",
    campus: "x".repeat(81),
    temporaryPassword: "short",
    temporaryPasswordConfirmation: "different",
  });

  assert.deepEqual(result, {
    ok: false,
    fieldErrors: {
      loginId: "직접 로그인 ID는 manual-로 시작해야 합니다.",
      displayName: "이름을 입력해 주세요.",
      generation: "기수는 0~99 사이의 숫자로 입력해 주세요.",
      campus: "캠퍼스는 80자 이내로 입력해 주세요.",
      temporaryPassword: "비밀번호는 8~64자, 영문/숫자/특수문자를 모두 포함해야 합니다.",
      temporaryPasswordConfirmation: "비밀번호가 일치하지 않습니다.",
    },
  });
});

test("직접 회원 생성 DB payload에는 해시된 비밀번호와 전용 ID만 포함한다", () => {
  const payload = buildDirectMemberCreatePayload({
    manualLoginId: "manual-seoul.001",
    displayName: "홍길동",
    generation: 15,
    campus: "서울",
    passwordHash: "hash",
    passwordSalt: "salt",
    now: "2026-07-14T01:00:00.000Z",
  });

  assert.deepEqual(payload, {
    manual_login_id: "manual-seoul.001",
    display_name: "홍길동",
    generation: 15,
    campus: "서울",
    password_hash: "hash",
    password_salt: "salt",
    must_change_password: true,
    updated_at: "2026-07-14T01:00:00.000Z",
  });
  assert.equal("temporaryPassword" in payload, false);
  assert.equal("password" in payload, false);
});

test("직접 회원 생성 감사 로그 속성에는 원본 ID·이름·비밀번호를 남기지 않는다", () => {
  const properties = buildDirectMemberCreateAuditProperties({
    manualLoginId: "manual-seoul.001",
    displayName: "홍길동",
    generation: 15,
    campus: "서울",
    temporaryPassword: "SafePass1!",
  });

  assert.deepEqual(properties, {
    source: "admin_direct_create",
    generation: 15,
    hasCampus: true,
    mustChangePassword: true,
  });
  assert.equal("manualLoginId" in properties, false);
  assert.equal("displayName" in properties, false);
  assert.equal("temporaryPassword" in properties, false);
});
